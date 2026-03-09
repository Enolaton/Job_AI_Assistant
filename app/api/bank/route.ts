import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from "@/lib/prisma";
import fs from 'fs/promises';
import path from 'path';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

console.log('[[ BANK ROUTE LOADED ]]');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromFile(fileUrl: string): Promise<string> {
    console.log(`[bank] Extracting text from: ${fileUrl}`);
    try {
        const fileName = fileUrl.split('/').pop();
        if (!fileName) return '';
        const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(fileName).toLowerCase();

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

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const fileName = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
        const filePath = path.join(uploadDir, fileName);
        await fs.writeFile(filePath, buffer);

        const fileUrl = `/uploads/${fileName}`;

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
            },
        });

        console.log(`[bank] POST: Saved doc ${document.id}`);
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
                    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
                    await fs.unlink(filePath);
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
    console.log('--- PUT /api/bank (Analyze) START ---');
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

        const texts = await Promise.all(user.documents.map((doc: any) => extractTextFromFile(doc.fileUrl)));
        const combinedText = texts.filter(t => t.length > 0).join('\n\n---\n\n');

        if (!combinedText.trim()) return NextResponse.json({ error: '텍스트 추출 실패' }, { status: 400 });

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `너는 취업 컨설팅 전문가이자 커리어 분석가이다. 사용자가 제공한 텍스트(이력서, 자기소개서 등)에서 주요 '경험'들을 추출하여 STARI 기법으로 요약해라.

[STARI 기법 지침]
- Title: 경험의 핵심을 보여주는 매력적인 소제목 (예: '데이터 분석을 통한 고객 이탈률 15% 감소')
- Situation: 어떤 환경이나 배경에서 발생한 일인지 간결하게 설명
- Task: 본인이 해결해야 했던 문제나 맡았던 구체적인 목표
- Action: 문제를 해결하기 위해 본인이 '직접' 수행한 행동 (구체적인 방법, 툴 활용 등)
- Result: 행동의 결과로 나타난 성과 (가능한 한 숫자나 지표로 표현, 예: '매출 10% 증대', '처리 시간 20% 단축')
- Insight: 이 경험을 통해 배운 점이나 회사에서 어떻게 기여할 수 있는지에 대한 통찰
- Tags: 경험의 성격과 핵심 역량을 나타내는 키워드 3~5개 (예: '문제해결', '데이터분석', '협업', '적응력', 'Java')

[출력 규칙]
1. 반드시 한국어로 답변할 것.
2. 문장은 공손하면서도 전문적인 어조(평어체 권장)로 작성할 것.
3. 불필요한 사족 없이 정확히 지정된 JSON 구조로만 응답할 것.
4. 추출할 경험이 여러 개인 경우 리스트에 담을 것.

JSON 구조:
{
  "experiences": [
    {
      "title": "strings",
      "situation": "strings",
      "task": "strings",
      "action": "strings",
      "result": "strings",
      "insight": "strings",
      "tags": ["strings"]
    }
  ]
}`
                },
                { role: "user", content: `다음은 사용자의 서류 내용이다. 여기서 핵심 경험들을 추출해라:\n\n${combinedText.substring(0, 12000)}` }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || '{"experiences": []}');

        // 1. Delete existing experiences for this user to avoid duplicates on re-analysis
        await prisma.experience.deleteMany({
            where: { userId: user.id }
        });

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

        console.log(`[bank] PUT: Analyzed and saved ${saved.length} experiences`);
        return NextResponse.json({ success: true, experiences: saved });

    } catch (error: any) {
        console.error('Analysis failed:', error);
        return NextResponse.json({ error: 'Analysis failed', detail: error.message }, { status: 500 });
    }
}
