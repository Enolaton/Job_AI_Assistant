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

        const { selfIntroId, activeTabIndex, currentAnswer } = await req.json();
        
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
                우대사항: si.jobRole.preferred,
                인재상: "" // 필요 시 CompanyAnalysis에서 보강 가능
            };
        } else if (si.jobAnalysis?.analysisResult) {
            const allResults = si.jobAnalysis.analysisResult as any[];
            jobAnalysisData = allResults[0] || {};
        }

        // 3. Python Evaluator 호출 준비
        const pythonPath = process.env.PYTHON_PATH || 'python';
        const scriptPath = path.join(process.cwd(), 'scripts', 'self_introduction_evaluator.py');
        
        const inputPayload = {
            api_key: process.env.GOOGLE_API_KEY,
            question: currentItem.question,
            answer: currentAnswer || currentItem.answer || '', // 작성 중인 텍스트 우선 (content -> answer 필드명 확인)
            job_data: jobAnalysisData
        };

        const result = await new Promise((resolve, reject) => {
            const pyProcess = spawn(pythonPath, [scriptPath, JSON.stringify(inputPayload)]);
            let stdout = '';
            let stderr = '';

            pyProcess.stdout.on('data', (data) => stdout += data.toString());
            pyProcess.stderr.on('data', (data) => stderr += data.toString());

            pyProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Python Evaluation Error:', stderr);
                    reject(new Error(stderr || 'Evaluation failed'));
                } else {
                    try {
                        resolve(jsonCleaner(stdout));
                    } catch (e) {
                        reject(new Error('Failed to parse Evaluation output'));
                    }
                }
            });
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('SI Evaluation API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

function jsonCleaner(str: string) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}') + 1;
    return JSON.parse(str.substring(start, end));
}
