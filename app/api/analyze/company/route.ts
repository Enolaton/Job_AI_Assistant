import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { companyName, jobTitle } = await req.json();

        if (!companyName) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

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

        // 통합 서비스 실행 (뉴스 + 인재상 + 조직문화)
        const result = await runPython(serviceScriptPath, [companyName, jobTitle || '']);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Company Info API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
