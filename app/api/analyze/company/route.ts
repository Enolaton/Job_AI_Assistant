import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { companyName: rawCompanyName, jobTitle, forceRefresh } = await req.json();

        if (!rawCompanyName) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

        // 기업명 정제 로직 (주식회사, (주), ㈜ 등 법인 접사 및 변칙 공백 제거)
        const cleanName = (name: string) => {
            // (주), (주 ), ㈜ 등 공백이 섞이거나 변칙적인 법인 표기를 모두 제거
            return name.replace(/\( ?주 ?\)|주식회사|㈜|\( ?유 ?\)|유한회사|\( ?사 ?\)|사단법인|\( ?재 ?\)|재단법인|\( ?의 ?\)|의료법인/g, '').trim();
        };

        const companyName = cleanName(rawCompanyName);

        const serviceScriptPath = path.join(process.cwd(), 'company_info', 'company_service.py');
        const venvPythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
        const pythonExecutable = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

        // Python 스크립트 실행 헬퍼
        const runPython = (scriptPath: string, args: string[]): Promise<any> => {
            return new Promise((resolve) => {
                const proc = spawn(pythonExecutable, [scriptPath, ...args], {
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdoutData = '';
                let stderrData = '';

                proc.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });

                proc.stderr.on('data', (data) => {
                    stderrData += data.toString();
                    console.log(`[${path.basename(scriptPath)}] ${data.toString().trim()}`);
                });

                proc.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`${path.basename(scriptPath)} exited with code ${code}`);
                        resolve({ error: `Script failed (code ${code})` });
                    } else {
                        try {
                            const trimmed = stdoutData.trim();
                            if (!trimmed) {
                                resolve({ error: 'Empty output from script' });
                            } else {
                                resolve(JSON.parse(trimmed));
                            }
                        } catch (e) {
                            console.error(`Failed to parse output from ${path.basename(scriptPath)}:`, stdoutData.substring(0, 200));
                            resolve({ error: 'JSON parse failure' });
                        }
                    }
                });
            });
        };

        // --- 1. 뉴스 데이터 실시간 수집 (Always Real-time News) ---
        const newsResult = await runPython(serviceScriptPath, [companyName, jobTitle || '', 'news']);
        const realTimeNews = newsResult.news || [];

        // --- 2. 기업 분석 데이터 처리 (Analysis Data: DB Cache) ---
        let finalAnalysis = null;

        if (!forceRefresh) {
            const existingReport = await (prisma as any).companyReport.findUnique({
                where: {
                    userId_companyName: {
                        userId: user.id,
                        companyName: companyName
                    }
                }
            });

            if (existingReport && existingReport.reportData?.analysis) {
                console.log(`💡 [CACHE HIT] '${companyName}' 기업 분석 정보를 DB에서 추출했습니다.`);
                finalAnalysis = existingReport.reportData.analysis;
            }
        }

        if (!finalAnalysis) {
            console.log(`🚀 [NEW ANALYSIS] '${companyName}' 기업 정보를 새로 분석합니다.`);
            const analysisResult = await runPython(serviceScriptPath, [companyName, jobTitle || '', 'analysis']);
            finalAnalysis = analysisResult.analysis || { "인재상": [], "조직문화": [] };

            await (prisma as any).companyReport.upsert({
                where: {
                    userId_companyName: {
                        userId: user.id,
                        companyName: companyName
                    }
                },
                update: {
                    reportData: { analysis: finalAnalysis }
                },
                create: {
                    userId: user.id,
                    companyName: companyName,
                    reportData: { analysis: finalAnalysis }
                }
            });
            console.log(`💡 [DB SAVED] '${companyName}' 기업 분석 데이터(Analysis)를 캐싱했습니다.`);
        }

        return NextResponse.json({
            news: realTimeNews,
            analysis: finalAnalysis
        });

    } catch (error) {
        console.error('Company Info API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
