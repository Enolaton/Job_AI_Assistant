import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { companyName, jobTitle, analysis, dart, news, interviewPatterns } = body;

        if (!companyName) {
            return NextResponse.json({ error: '기업 정보가 부족합니다.' }, { status: 400 });
        }

        // 1. 임괄 경로 및 임시 JSON 데이터 생성
        const tempId = Date.now().toString();
        const tempDir = path.join(process.cwd(), '.tmp');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempJsonPath = path.join(tempDir, `report_${tempId}.json`);
        const pdfOutputPath = path.join(tempDir, `report_${tempId}.pdf`); // PDF 저장 경로를 미리 결정
        
        await fs.writeFile(tempJsonPath, JSON.stringify(body, null, 2), 'utf-8');

        // 2. Python 스크립트 실행 (출력 경로 인자 추가)
        const scriptPath = path.join(process.cwd(), 'scripts', 'generate_company_report_pdf.py');
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        
        // JSON 경로와 함께 PDF 출력 경로를 인자로 전달하여 인코딩 의존성 제거
        await execAsync(`${pythonCmd} "${scriptPath}" "${tempJsonPath}" "${pdfOutputPath}"`);

        // 3. 생성된 PDF 파일 읽기 및 응답 (Streaming)
        const pdfBuffer = await fs.readFile(pdfOutputPath);
        
        // 4. 임시 파일 정리
        await fs.unlink(tempJsonPath).catch(() => {});
        await fs.unlink(pdfOutputPath).catch(() => {});
        // 생성된 PDF 파일은 시연을 위해 남겨두거나 필요 시 여기서 삭제 가능 (여기서는 우선 유지)

        const response = new NextResponse(pdfBuffer);
        response.headers.set('Content-Type', 'application/json'); // response body로 파일을 보내는 대신 스트림 방식으로 전송
        
        // 응답 헤더 설정 (브라우저에서 파일 다운로드 트리거)
        const safeFileName = encodeURIComponent(`${companyName}_기업분석리뷰.pdf`);
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename*=UTF-8''${safeFileName}`,
            },
        });

    } catch (error: any) {
        console.error('PDF Download API Error:', error);
        return NextResponse.json({ 
            error: 'PDF 생성 중 오류가 발생했습니다.',
            details: error.message 
        }, { status: 500 });
    }
}
