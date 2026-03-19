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
        const dartScriptPath = path.join(process.cwd(), 'dart', 'run_pipeline.py');
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

        // --- 1. 데이터 수집 및 분석 (병렬 실행) ---
        // 기존 분석 결과가 있는지 확인
        const existingReport = await (prisma as any).companyReport.findUnique({
            where: {
                userId_companyName: {
                    userId: user.id,
                    companyName: companyName
                }
            }
        });

        const reportData = (existingReport?.reportData as any) || {};
        let finalAnalysis = reportData.analysis;
        let finalDart = reportData.dart;

        // 분석이 필요한 항목들 선별하여 병렬 실행
        const tasks: Promise<any>[] = [
            runPython(serviceScriptPath, [companyName, jobTitle || '', 'news']) // 뉴스는 항상 실시간
        ];

        // 인재상/조직문화 분석은 DB에 없을 경우에만 최초 1회 실행 (새로고침 시 재분석 제외)
        if (!finalAnalysis) {
            tasks.push(runPython(serviceScriptPath, [companyName, jobTitle || '', 'analysis']));
        }

        if (!finalDart || forceRefresh) {
            tasks.push(runPython(dartScriptPath, [companyName]));
        }

        const results = await Promise.all(tasks);
        
        // 결과 매핑 (구조적 불일치 전수 교정)
        let realTimeNews = results[0]?.news || [];
        let updated = false;

        results.slice(1).forEach(res => {
            // 1. 기업 문화 및 인재상 분석 결과 매핑
            if (res.analysis) {
                finalAnalysis = res.analysis;
                updated = true;
            }
            // 2. DART 기업 공시 분석 결과 매핑 (status: success 체크 및 키값 정규화)
            if (res.status === 'success') {
                finalDart = {
                    companyName: res.company_name,
                    reportYear: res.report_year,
                    business: res.business_summary,
                    products: res.products_services_summary,
                    financial: res.financial_summary
                };
                updated = true;
            }
        });

        // 결과가 업데이트되었거나 캐시가 없었던 경우, 혹은 DART 데이터가 여전히 비어있는 경우 DB 갱신
        if (updated || !existingReport || !finalDart) {
            await (prisma as any).companyReport.upsert({
                where: {
                    userId_companyName: {
                        userId: user.id,
                        companyName: companyName
                    }
                },
                update: {
                    reportData: { 
                        analysis: finalAnalysis || { "인재상": [], "조직문화": [] },
                        dart: finalDart || null
                    }
                },
                create: {
                    userId: user.id,
                    companyName: companyName,
                    reportData: { 
                        analysis: finalAnalysis || { "인재상": [], "조직문화": [] },
                        dart: finalDart || null
                    }
                }
            });
            console.log(`💡 [DB UPDATED] '${companyName}' 기업 분석 및 DART 데이터를 캐싱했습니다.`);
        }

        return NextResponse.json({
            news: realTimeNews,
            analysis: finalAnalysis,
            dart: finalDart
        });

    } catch (error) {
        console.error('Company Info API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
