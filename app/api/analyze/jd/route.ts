import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // --- 1. 클라우드 DB(PostgreSQL) 캐싱 확인 ---
        const existingAnalysis = await prisma.jobAnalysis.findFirst({
            where: { jdUrl: url }
        });

        if (existingAnalysis && existingAnalysis.analysisResult) {
            const results = existingAnalysis.analysisResult as any[];
            // 새로운 필드인 '공고요약'이 있는지 확인 (하나라도 없으면 새로 분석)
            const hasBriefSummary = results.length > 0 && results.every(job => job["공고요약"]);
            
            if (hasBriefSummary) {
                console.log(`💡 [CACHE HIT] DB에서 최신 분석 결과를 가져왔습니다: ${url}`);
                return NextResponse.json({ result: existingAnalysis.analysisResult, id: existingAnalysis.id });
            }
            console.log(`ℹ️ [CACHE BYPASS] 기존 결과에 '공고요약'이 없어 새로 분석을 진행합니다.`);
        }

        // --- 2. DB에 없다면 파이썬 스크립트 실행 ---
        const scriptPath = path.join(process.cwd(), 'app', 'analysis_JD.py');
        const venvPythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
        const pythonExecutable = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

        const pythonProcess = spawn(pythonExecutable, [scriptPath, url], {
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
                // stderr를 Node 진영의 콘솔에도 찍어줌
                console.log(`[Python Log] ${data.toString().trim()}`);
            });

            pythonProcess.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`Python script error (code ${code}):`, stderrData);
                    resolve(NextResponse.json({ error: 'Analysis failed', details: stderrData }, { status: 500 }));
                    return;
                }

                try {
                    // stdoutData에 오직 JSON만 들어있으므로 통째로 파싱
                    const parsedData = JSON.parse(stdoutData.trim());
                    const { raw_text, structured } = parsedData;

                    // --- 3. 클라우드 DB에 결과 저장 (Prisma 활용) ---
                    // 기업명 정제 로직 (주식회사, (주), ㈜ 등 법인 접사 및 변칙 공백 제거)
                    const cleanName = (name: string) => {
                        return name.replace(/\( ?주 ?\)|주식회사|㈜|\( ?유 ?\)|유한회사|\( ?사 ?\)|사단법인|\( ?재 ?\)|재단법인|\( ?의 ?\)|의료법인/g, '').trim();
                    };
                    const rawCompanyName = structured[0]?.["회사명"] || "알수없음";
                    const companyName = cleanName(rawCompanyName);

                    // Transaction을 사용하여 JobAnalysis와 JobRoles를 함께 저장
                    const newAnalysis = await (prisma as any).$transaction(async (tx: any) => {
                        const analysis = await tx.jobAnalysis.create({
                            data: {
                                userId: user.id,
                                companyName,
                                jdUrl: url,
                                jdRawText: raw_text,
                                analysisResult: structured // 하위 호환성을 위해 유지
                            }
                        });

                        // 개별 직무(Role) 레코드 생성
                        if (Array.isArray(structured)) {
                            await tx.jobRole.createMany({
                                data: structured.map((job: any) => ({
                                    analysisId: analysis.id,
                                    roleTitle: job["모집직무"] || "직무 미상",
                                    department: job["모집부문"] || "부문 미상",
                                    location: job["근무지"] || "정보 없음",
                                    requirements: job["자격요건"] || "",
                                    tasks: job["주요업무"] || "",
                                    preferred: job["우대사항"] || ""
                                }))
                            });
                        }

                        return analysis;
                    });

                    console.log(`💡 [DB SAVED] 분석 결과 및 ${structured.length}개의 직무를 DB에 저장했습니다: ${url}`);

                    resolve(NextResponse.json({ result: structured, id: newAnalysis.id }));
                } catch (parseError) {
                    console.error('Failed to parse Python output. Raw output:', stdoutData);
                    resolve(NextResponse.json({ error: 'Failed to parse result', output: stdoutData }, { status: 500 }));
                }
            });
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const history = await prisma.jobAnalysis.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ history });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const url = new URL(req.url);
        const idParam = url.searchParams.get('id');

        if (!idParam) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const id = parseInt(idParam, 10);

        // Delete only if it belongs to the user
        await prisma.jobAnalysis.deleteMany({
            where: { 
                id: id,
                userId: user.id
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { id, remainingJobs } = await req.json();

        if (!id || !Array.isArray(remainingJobs)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        if (remainingJobs.length === 0) {
            // Delete entire record if no jobs left
            await prisma.jobAnalysis.deleteMany({
                where: { id: id, userId: user.id }
            });
        } else {
            // Update the array
            await prisma.jobAnalysis.updateMany({
                where: { id: id, userId: user.id },
                data: { analysisResult: remainingJobs }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Patch API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
