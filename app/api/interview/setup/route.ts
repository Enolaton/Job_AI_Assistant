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

        const { jdId, selfIntroId } = await req.json();

        // 1. 공고 데이터 조회 (JobAnalysis + JobRole)
        const jd = await prisma.jobAnalysis.findUnique({
            where: { id: parseInt(jdId), userId: user.id },
            include: { jobRoles: true }
        });
        if (!jd) return NextResponse.json({ error: 'JD not found' }, { status: 404 });

        // 2. 자기소개서 데이터 조회 (SelfIntroduction + Items)
        const si = await prisma.selfIntroduction.findUnique({
            where: { id: parseInt(selfIntroId), userId: user.id },
            include: { 
                items: { orderBy: { orderIndex: 'asc' } },
                jobRole: true 
            }
        });
        if (!si) return NextResponse.json({ error: 'Self-introduction not found' }, { status: 404 });

        // 3. 이력서/포트폴리오 조회 (UserDocument - RESUME)
        const documents = await prisma.userDocument.findMany({
            where: { userId: user.id, type: 'RESUME' }
        });

        // 4. 경험 뱅크 조회 (Experience - STAR)
        const experiences = await prisma.experience.findMany({
            where: { userId: user.id }
        });

        // Python 스크립트 호출 준비
        const venvPythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
        const pythonExecutable = require('fs').existsSync(venvPythonPath) ? venvPythonPath : 'python';
        const scriptPath = path.join(process.cwd(), 'scripts', 'mock_interview_setup.py');

        // JD 통합 (연결된 role 우선)
        const roleInfo = si.jobRole || (jd.jobRoles.length > 0 ? jd.jobRoles[0] : null);

        const inputPayload = {
            api_key: process.env.GOOGLE_API_KEY,
            jd_data: {
                companyName: jd.companyName,
                roleTitle: roleInfo?.roleTitle || "직무 미상",
                requirements: roleInfo?.requirements || "",
                tasks: roleInfo?.tasks || ""
            },
            intro_data: {
                title: si.title,
                qna: si.items.map(it => ({ question: it.question, answer: it.answer })),
                evaluation: si.evaluationResult ? JSON.stringify(si.evaluationResult) : "평가 결과 없음"
            },
            resume_data: documents.map(doc => doc.contentJson || { fileName: doc.fileName }),
            experiences: experiences.map(e => ({
                title: e.title,
                content: `상황: ${e.situation || ""}\n과제: ${e.task || ""}\n행동: ${e.action || ""}\n결과: ${e.result || ""}\n인사이트: ${e.insight || ""}`
            }))
        };

        const result = await new Promise((resolve, reject) => {
            const pyProcess = spawn(pythonExecutable, [scriptPath, JSON.stringify(inputPayload)], {
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });
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
                        // JSON만 걸러내기 위해 정제
                        const cleanedOutput = stdout.trim();
                        const start = cleanedOutput.indexOf('[');
                        const end = cleanedOutput.lastIndexOf(']') + 1;
                        if (start === -1 || end === 0) { 
                            // 엣지 케이스 (Error JSON인 경우)
                            resolve(JSON.parse(cleanedOutput));
                        } else {
                            resolve(JSON.parse(cleanedOutput.substring(start, end)));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse Python output'));
                    }
                }
            });
        });

        const processedResult = result as any;
        if (processedResult.error) {
            throw new Error(processedResult.error);
        }

        return NextResponse.json({ success: true, questions: processedResult });

    } catch (error: any) {
        console.error('Interview Setup API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
