import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from "@/lib/prisma";
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

const pythonPath = process.platform === 'win32'
    ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : path.join(process.cwd(), '.venv', 'bin', 'python');

export const dynamic = 'force-dynamic';

console.log('[[ BANK ROUTE LOADED ]]');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function extractTextFromFile(fileUrl: string): Promise<string> {
    console.log(`[bank] Extracting text from: ${fileUrl}`);
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const fileName = fileUrl.split('/').pop() || '';
        const ext = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : '';

        if (ext === '.pdf') {
            const pdfModule = require('pdf-parse');
            const pdfFunc = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
            const data = await pdfFunc(buffer);
            return data.text;
        } else if (ext === '.docx') {
            const mammothModule = require('mammoth');
            const extractFunc = typeof mammothModule.extractRawText === 'function' ? mammothModule.extractRawText : mammothModule.default.extractRawText;
            const result = await extractFunc({ buffer });
            return result.value;
        } else {
            return buffer.toString('utf-8');
        }
    } catch (error: any) {
        console.error(`[bank] Error extracting text from ${fileUrl}:`, error?.message || error);
        console.error(`[bank] Stack trace:`, error?.stack);
        return '';
    }
}

export async function GET(request: Request) {
    console.log('--- GET /api/bank START ---');
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            console.log('[bank] Unauthorized: No session email');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            console.log('[bank] User not found in DB:', session.user.email);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch both documents and experiences
        const [documents, experiences] = await Promise.all([
            // @ts-ignore
            prisma.userDocument.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.experience.findMany({
                where: { userId: user.id },
                orderBy: { id: 'desc' },
            })
        ]);

        console.log(`[bank] GET: Found ${documents.length} docs and ${experiences.length} exps for user ${user.email}`);
        return NextResponse.json({ documents, experiences });
    } catch (error: any) {
        console.error('Error fetching documents:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    console.log('--- POST /api/bank START ---');
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string | null;

        if (!file || !type) {
            return NextResponse.json({ error: 'Missing file or type' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const tempPath = path.join(process.cwd(), '.tmp', `upload_${uniqueSuffix}.pdf`);
        const tmpDir = path.dirname(tempPath);

        let contentJson = null;

        try {
            if (!fs.existsSync(tmpDir)) {
                await mkdirAsync(tmpDir, { recursive: true });
            }
            await writeFileAsync(tempPath, buffer);
            // 파일 타입(RESUME/PORTFOLIO)에 따라 판독 스크립트 선택
            const scriptName = type === 'RESUME' ? 'resume_parser.py' : 'portfolio_parser.py';
            const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
            const failureReason = type === 'RESUME' ? '이력서가 아닙니다.' : '포트폴리오가 아닙니다.';
            
            const pythonProcess = spawn(pythonPath, [scriptPath, tempPath, 'full']);

            let outputData = '';
            let errorData = '';
            await new Promise((resolve, reject) => {
                pythonProcess.stdout.on('data', (d) => outputData += d.toString());
                pythonProcess.stderr.on('data', (d) => errorData += d.toString());
                pythonProcess.on('close', (code) => {
                    if (code === 0) resolve(outputData);
                    else reject(new Error(errorData || `Python script exited with code ${code}`));
                });
            });

            const analysisResult = JSON.parse(outputData);
            console.log(`[bank] Upload Validation & Parsing Result (${type}):`, analysisResult);
            
            // 유효성 키 통일 (Script에서 호환성을 위해 추가해둔 is_valid_resume 사용)
            if (analysisResult.is_valid_resume !== true) {
                // 부적합한 파일일 경우 즉시 중단 및 임시 파일 삭제
                if (fs.existsSync(tempPath)) await unlinkAsync(tempPath);
                return NextResponse.json({ 
                    error: 'Invalid document type', 
                    reason: failureReason 
                }, { status: 400 });
            }

            // 업로드 즉시 핵심 데이터(JSONB) 준비
            contentJson = analysisResult.extracted_data || null;

        } catch (error: any) {
            console.error('[bank] Analysis failed:', error.message);
            // 분석 실패 시(파이썬 스크립트 실행 불가 등)에도 사용자에게는 부적합 안내로 통일
            if (fs.existsSync(tempPath)) await unlinkAsync(tempPath);
            return NextResponse.json({ 
                error: 'Analysis Error', 
                reason: '파일 분석 중 오류가 발생했습니다.' 
            }, { status: 400 });
        } finally {
            if (fs.existsSync(tempPath)) {
                await unlinkAsync(tempPath).catch(err => console.error('[bank] Failed to delete temp file:', err));
            }
        }

        const fileName = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('experience_uploads')
            .upload(fileName, buffer, {
                contentType: file.type || 'application/octet-stream',
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload to cloud storage', detail: uploadError.message }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('experience_uploads')
            .getPublicUrl(fileName);

        const fileUrl = publicUrl;

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // @ts-ignore
        const document = await prisma.userDocument.create({
            data: {
                userId: user.id,
                type: type,
                fileName: file.name,
                fileUrl: fileUrl,
                contentJson: contentJson
            } as any,
        });

        console.log(`[bank] POST: Saved doc ${document.id} with JSON content`);
        return NextResponse.json(document);
    } catch (error: any) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    console.log('--- DELETE /api/bank START ---');
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const documentId = url.searchParams.get('id');
        const expId = url.searchParams.get('expId');

        if (!documentId && !expId) {
            return NextResponse.json({ error: 'Missing id or expId' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (expId) {
            await prisma.experience.delete({
                where: { id: parseInt(expId), userId: user.id },
            });
            console.log(`[bank] DELETE: Removed exp ${expId}`);
            return NextResponse.json({ success: true });
        }

        if (documentId) {
            // @ts-ignore
            const document = await prisma.userDocument.findFirst({
                where: {
                    id: documentId,
                    userId: user.id,
                },
            });

            if (!document) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            try {
                const fileName = document.fileUrl.split('/').pop();
                if (fileName) {
                    const { error: removeError } = await supabase.storage
                        .from('experience_uploads')
                        .remove([fileName]);
                    if (removeError) {
                        console.error('Supabase remove error:', removeError);
                    }
                }
            } catch (err) {
                console.error('File deletion error:', err);
            }

            // @ts-ignore
            await prisma.userDocument.delete({
                where: { id: document.id },
            });

            console.log(`[bank] DELETE: Removed doc ${documentId}`);
            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    console.log('--- PUT /api/bank (Full Analysis & JSONB Save) START ---');
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            // @ts-ignore
            include: { documents: true }
        }) as any;

        if (!user || !user.documents || user.documents.length === 0) {
            return NextResponse.json({ error: '분석할 서류가 없습니다.' }, { status: 400 });
        }

        const scriptPath = path.join(process.cwd(), 'scripts', 'resume_parser.py');
        const tmpDir = path.join(process.cwd(), '.tmp');
        if (!fs.existsSync(tmpDir)) await mkdirAsync(tmpDir, { recursive: true });

        // === 1. 미분석 서류에 대한 정밀 분석 수행 (JSONB 보완) ===
        // 업로드 시 이미 분석되었다면 스킵, 아니면 수행 (단계 2 보장)
        for (const doc of user.documents) {
            if (!doc.contentJson) {
                console.log(`[bank] Late parsing for missing JSONB: ${doc.fileName}`);
                const response = await fetch(doc.fileUrl);
                const buffer = Buffer.from(await response.arrayBuffer());
                const tempPath = path.join(tmpDir, `analyze_${doc.id}.pdf`);
                await writeFileAsync(tempPath, buffer);

                try {
                    const pythonProcess = spawn(pythonPath, [scriptPath, tempPath, 'full']);
                    let outputData = '';
                    let errorData = '';
                    await new Promise((resolve, reject) => {
                        pythonProcess.stdout.on('data', (d) => outputData += d.toString());
                        pythonProcess.stderr.on('data', (d) => errorData += d.toString());
                        pythonProcess.on('close', (code) => {
                            if (code === 0) resolve(outputData);
                            else reject(new Error(errorData || `Python script exited with code ${code}`));
                        });
                    });

                    const result = JSON.parse(outputData);
                    // @ts-ignore
                    await prisma.userDocument.update({
                        where: { id: doc.id },
                        data: { contentJson: result.extracted_data } as any
                    });
                    doc.contentJson = result.extracted_data;
                } catch (err) {
                    console.error(`[bank] Failed to late parse ${doc.fileName}:`, err);
                } finally {
                    if (fs.existsSync(tempPath)) await unlinkAsync(tempPath);
                }
            }
        }

        // === 2. 이미 구축된 JSONB(팩트)를 바탕으로 STARI 카드 통합 생성 ===
        const allFacts = user.documents
            .map((doc: any) => doc.contentJson ? JSON.stringify(doc.contentJson) : '')
            .filter((t: string) => t.length > 0)
            .join('\n\n');

        if (!allFacts.trim()) {
            return NextResponse.json({ error: '분석할 구조화된 데이터(JSONB)가 없습니다.' }, { status: 400 });
        }

        // OpenAI를 통해 카드 리스트 형태(JSON)로 STARI 요약본 추출
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: "너는 취업 컨설팅 전문가다. 제공된 '구조화된 이력서 데이터(JSON)'를 바탕으로 주요 실무 경험을 STARI 기법으로 요약해라. 각 경험은 반드시 매력적인 제목을 포함한 카드 형태로 출력할 수 있도록 아래 지침에 맞게 JSON 형식으로 반환해라." 
                },
                { 
                    role: "user", 
                    content: `다음은 추출된 팩트 데이터다. 여기서 핵심 경험 3~5개를 찾아 STARI 카드로 요약해:\n\n${allFacts.substring(0, 10000)}

출력 JSON 형식:
{
  "experiences": [
    {
      "title": "핵심 성과 위주 제목",
      "situation": "상황",
      "task": "내 역할과 과제",
      "action": "구체적 행동",
      "result": "정량적 성과 (숫자 포함)",
      "insight": "배운 점 및 인사이트",
      "tags": ["기술", "역량", "태도"]
    }
  ]
}` 
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.0
        });

        const result = JSON.parse(aiResponse.choices[0].message.content || '{"experiences": []}');
        
        // 기존 경험 카드 정보를 비우고 새로 생성 (통합 분석 품질 보장)
        await prisma.experience.deleteMany({ where: { userId: user.id } });
        
        const saved = [];
        for (const exp of result.experiences) {
            const s = await prisma.experience.create({
                data: {
                    userId: user.id,
                    title: exp.title || '제목 없음',
                    situation: exp.situation || '분석된 상황 내용이 없습니다.',
                    task: exp.task || '분석된 과제 내용이 없습니다.',
                    action: exp.action || '분석된 행동 내용이 없습니다.',
                    result: exp.result || '분석된 결과 내용이 없습니다.',
                    insight: exp.insight || '분석된 인사이트 내용이 없습니다.',
                    tags: JSON.stringify(Array.isArray(exp.tags) ? exp.tags : [])
                }
            });
            saved.push(s);
        }

        console.log(`[bank] PUT: Integrated STARI analysis saved to Experience table (${saved.length} units)`);
        return NextResponse.json({ success: true, experiences: saved });

    } catch (error: any) {
        console.error('Analysis failed:', error);
        return NextResponse.json({ error: 'Analysis failed', detail: error.message }, { status: 500 });
    }
}
