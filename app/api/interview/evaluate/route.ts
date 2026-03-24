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

        const { jdId, selfIntroId, qna } = await req.json();

        // 1. 공고 및 자소서 데이터 재조회 (평가 컨텐츠 구성용)
        const jd = await prisma.jobAnalysis.findUnique({
            where: { id: parseInt(jdId), userId: user.id },
            include: { jobRoles: true }
        });
        const si = await prisma.selfIntroduction.findUnique({
            where: { id: parseInt(selfIntroId), userId: user.id },
            include: { items: true, jobRole: true }
        });

        if (!jd || !si) return NextResponse.json({ error: 'Data not found' }, { status: 404 });

        // Python 스크립트 호출 준비
        const venvPythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
        const pythonExecutable = require('fs').existsSync(venvPythonPath) ? venvPythonPath : 'python';
        const scriptPath = path.join(process.cwd(), 'scripts', 'mock_interview_evaluate.py');

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
                evaluation: si.evaluationResult
            },
            qna: qna // 면접 대화 스크립트
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
                    console.error('Python Error (Eval):', stderr);
                    reject(new Error(stderr || 'Evaluation failed'));
                } else {
                    try {
                        const cleanedOutput = stdout.trim();
                        const start = cleanedOutput.indexOf('{');
                        const end = cleanedOutput.lastIndexOf('}') + 1;
                        if (start === -1 || end === 0) {
                            resolve(JSON.parse(cleanedOutput));
                        } else {
                            resolve(JSON.parse(cleanedOutput.substring(start, end)));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse Python evaluate output'));
                    }
                }
            });
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Interview Evaluate API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
