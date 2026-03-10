import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Python 스크립트 경로 설정
        const scriptPath = path.join(process.cwd(), 'app', 'analysis_JD.py');

        // Python 실행 (환경에 따라 'python' 또는 'python3' 또는 특정 경로일 수 있음)
        // 현재 사용자가 'saramin' 콘다 환경을 사용 중이므로 시스템의 python을 호출하도록 시도
        const pythonProcess = spawn('python', [scriptPath, url], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let stdoutData = '';
        let stderrData = '';

        return new Promise<NextResponse>((resolve) => {
            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Python script error (code ${code}):`, stderrData);
                    resolve(NextResponse.json({ error: 'Analysis failed', details: stderrData }, { status: 500 }));
                    return;
                }

                try {
                    // 스크립트 출력 결과에서 JSON 부분만 추출
                    // 스크립트가 "=== 추출된 채용 정보(JSON) ===\n{...}" 형식으로 출력함
                    const jsonMarker = '=== 추출된 채용 정보(JSON) ===';
                    const jsonStartIndex = stdoutData.indexOf(jsonMarker);

                    if (jsonStartIndex === -1) {
                        resolve(NextResponse.json({ error: 'Could not find JSON in output', output: stdoutData }, { status: 500 }));
                        return;
                    }

                    const jsonString = stdoutData.substring(jsonStartIndex + jsonMarker.length).trim();
                    const result = JSON.parse(jsonString);

                    resolve(NextResponse.json({ result }));
                } catch (parseError) {
                    console.error('Failed to parse Python output:', stdoutData);
                    resolve(NextResponse.json({ error: 'Failed to parse result', output: stdoutData }, { status: 500 }));
                }
            });
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
