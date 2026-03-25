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
        // [수정] DART 전용 엔진으로 분리된 company_dart.py 호출
        const dartScriptPath = path.join(process.cwd(), 'company_info', 'company_dart.py');
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

        // --- 1. 글로벌 캐시(Global DB) 및 개인 열람 내역(History) 확인 ---
        const globalCache = await prisma.companyAnalysis.findUnique({
            where: { companyName }
        });

        const existingReport = await (prisma as any).companyReport.findUnique({
            where: {
                userId_companyName: {
                    userId: user.id,
                    companyName: companyName
                }
            }
        });

        // 글로벌 캐시가 있고 강제 새로고침이 아닐 경우 캐시 사용
        let finalAnalysis = (globalCache && !forceRefresh && (globalCache.idealCandidate || globalCache.corporateCulture)) ? {
            "인재상": globalCache.idealCandidate || [],
            "조직문화": globalCache.corporateCulture || []
        } : null;

        let finalDart = (globalCache && globalCache.businessSummary && !forceRefresh) ? {
            companyName: globalCache.companyName,
            reportYear: globalCache.reportYear,
            business: globalCache.businessSummary,
            products: globalCache.productSummary,
            financial: globalCache.financialSummary
        } : null;

        // --- 2. 데이터 수집 (병렬 실행) ---
        const tasks: Promise<any>[] = [
            runPython(serviceScriptPath, [companyName, jobTitle || '', 'news']) // 뉴스는 항상 실시간
        ];

        let needsAnalysisUpdate = false;
        let needsDartUpdate = false;

        // 캐시가 비어있거나 강제 새로고침일 때만 API/크롤링 재호출
        if (!finalAnalysis) {
            tasks.push(runPython(serviceScriptPath, [companyName, jobTitle || '', 'analysis']));
            needsAnalysisUpdate = true;
        }

        if (!finalDart) {
            tasks.push(runPython(dartScriptPath, [companyName]));
            needsDartUpdate = true;
        }

        const results = await Promise.all(tasks);

        // 결과 매핑
        let realTimeNews = results[0]?.news || [];
        let freshAnalysis: any = null;
        let freshDart: any = null;
        let updateGlobalCache = false;

        results.slice(1).forEach(res => {
            if (res.analysis) {
                freshAnalysis = res.analysis;
                finalAnalysis = res.analysis;
                updateGlobalCache = true;
            }
            if (res.status === 'success') {
                freshDart = {
                    companyName: res.company_name || companyName,
                    reportYear: res.report_year || new Date().getFullYear().toString(),
                    business: res.business || res.business_summary || null,
                    products: res.products || res.products_services_summary || null,
                    financial: res.financial || res.financial_summary || null
                };
                finalDart = freshDart;
                updateGlobalCache = true;
            }
        });

        // --- 3. 글로벌 캐시 DB 및 개인 리포트 DB 갱신 ---
        if (updateGlobalCache) {
            // 다른 사람들도 볼 수 있는 공용 DB에 즉각 업데이트 (글로벌 캐시 복구)
            await prisma.companyAnalysis.upsert({
                where: { companyName },
                update: {
                    ...(freshAnalysis && {
                        idealCandidate: freshAnalysis["인재상"] || [],
                        corporateCulture: freshAnalysis["조직문화"] || []
                    }),
                    ...(freshDart && {
                        businessSummary: freshDart.business,
                        productSummary: freshDart.products,
                        financialSummary: freshDart.financial,
                        reportYear: freshDart.reportYear
                    })
                },
                create: {
                    companyName,
                    idealCandidate: (freshAnalysis || finalAnalysis || {})["인재상"] || [],
                    corporateCulture: (freshAnalysis || finalAnalysis || {})["조직문화"] || [],
                    businessSummary: (freshDart || finalDart)?.business || null,
                    productSummary: (freshDart || finalDart)?.products || null,
                    financialSummary: (freshDart || finalDart)?.financial || null,
                    reportYear: (freshDart || finalDart)?.reportYear || null
                }
            });
            console.log(`[DB UPDATED] '${companyName}' 기업 글로벌 캐시(CompanyAnalysis) 업데이트 완료`);
        }

        // 개인별 리포트 보기 이력 갱신 (핵심 분석 결과들을 통합하여 저장)
        const reportData = {
            companyName,
            news: realTimeNews,
            analysis: finalAnalysis,
            dart: finalDart
        };

        await (prisma as any).companyReport.upsert({
            where: {
                userId_companyName: {
                    userId: user.id,
                    companyName: companyName
                }
            },
            update: {
                reportData: reportData
            },
            create: {
                userId: user.id,
                companyName,
                reportData: reportData
            }
        });

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
