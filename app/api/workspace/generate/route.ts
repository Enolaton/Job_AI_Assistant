import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { selfIntroId, activeTabIndex } = await req.json();

        // 1. 자기소개서 데이터 조회
        const si = await prisma.selfIntroduction.findUnique({
            where: { id: parseInt(selfIntroId), userId: user.id },
            include: {
                items: { orderBy: { orderIndex: 'asc' } },
                jobAnalysis: true,
                jobRole: true
            }
        });
        if (!si) return NextResponse.json({ error: 'Self-introduction not found' }, { status: 404 });

        const currentItem = si.items[activeTabIndex];
        if (!currentItem) return NextResponse.json({ error: 'Question not found' }, { status: 400 });

        // 2. 공고 분석 데이터 조회 (연결된 경우)
        let jobAnalysisData: any = {};
        if (si.jobRole) {
            jobAnalysisData = {
                모집직무: si.jobRole.roleTitle,
                주요업무: si.jobRole.tasks,
                자격요건: si.jobRole.requirements,
                우대사항: si.jobRole.preferred
            };
        } else if (si.jobAnalysis?.analysisResult) {
            const allResults = si.jobAnalysis.analysisResult as any[];
            jobAnalysisData = allResults[0] || {};
        }

        // 3. 경험 뱅크 데이터 조회 (Experience 모델)
        const experiences = await prisma.experience.findMany({
            where: { userId: user.id }
        });

        // 4. 기업 상세 분석 데이터 조회 (Optional)
        const companyAnalysis = si.jobAnalysis?.companyName ? await prisma.companyAnalysis.findUnique({
            where: { companyName: si.jobAnalysis.companyName }
        }) : null;

        // 5. Python 스크립트 호출 준비
        const pythonPath = process.env.PYTHON_PATH || 'python';
        const scriptPath = path.join(process.cwd(), 'scripts', 'self_introduction_generator.py');

        const inputPayload = {
            api_key: process.env.GOOGLE_API_KEY,
            question: currentItem.question,
            max_chars: currentItem.charLimit,
            job_data: jobAnalysisData,
            experiences: experiences.map(e => ({
                title: e.title,
                content: `상황: ${e.situation || ""}\n과제: ${e.task || ""}\n행동: ${e.action || ""}\n결과: ${e.result || ""}\n인사이트: ${e.insight || ""}`,
                tags: e.tags
            })),
            dart_data: companyAnalysis ? {
                business_overview: companyAnalysis.businessSummary,
                products_services: companyAnalysis.productSummary,
                ideal_candidate: companyAnalysis.idealCandidate,
                culture: companyAnalysis.corporateCulture
            } : null
        };

        const result = await new Promise((resolve, reject) => {
            const pyProcess = spawn(pythonPath, [scriptPath, JSON.stringify(inputPayload)]);
            let stdout = '';
            let stderr = '';

            pyProcess.stdout.on('data', (data) => stdout += data.toString());
            pyProcess.stderr.on('data', (data) => stderr += data.toString());

            pyProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Python Error:', stderr);
                    reject(new Error(stderr || 'Generation failed'));
                } else {
                    try {
                        resolve(jsonCleaner(stdout));
                    } catch (e) {
                        reject(new Error('Failed to parse Python output'));
                    }
                }
            });
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('SI Generation API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// JSON 결과에서 불필요한 로그가 섞여있을 경우를 대비한 클리너
function jsonCleaner(str: string) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}') + 1;
    return JSON.parse(str.substring(start, end));
}
