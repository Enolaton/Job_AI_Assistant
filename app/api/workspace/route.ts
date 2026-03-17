import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// GET: 특정 직무에 대한 자기소개서 초안 리스트 불러오기
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const roleTitle = url.searchParams.get('roleTitle');
        const companyName = url.searchParams.get('companyName');

        if (!roleTitle || !companyName) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // 1. 유저 확인
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // 2. 직무(Role) 찾기 (공고 분석 결과 기반)
        const role = await (prisma as any).jobRole.findFirst({
            where: {
                roleTitle: roleTitle,
                jobAnalysis: {
                    companyName: companyName,
                    userId: user.id
                }
            },
            include: {
                selfIntroductions: {
                    include: {
                        items: {
                            orderBy: { orderIndex: 'asc' }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!role) {
            return NextResponse.json({ drafts: [] });
        }

        // 3. 프론트엔드 형식으로 변환
        const formattedDrafts = role.selfIntroductions.map(si => ({
            id: String(si.id),
            name: si.name || si.title,
            isFinal: si.isFinal,
            tabs: si.items.map(item => item.question),
            questions: si.items.map(item => item.aiGuide || ''),
            contents: si.items.map(item => item.answer || ''),
            charLimits: si.items.map(item => (item as any).charLimit || 700)
        }));

        return NextResponse.json({ drafts: formattedDrafts, roleId: role.id });
    } catch (error) {
        console.error('Workspace Load Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: 자기소개서 초안 리스트 저장하기 (Upsert)
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { drafts, roleTitle, companyName } = await req.json();

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // 1. 해당 직무(Role) 찾기 또는 생성
        let role = await (prisma as any).jobRole.findFirst({
            where: {
                roleTitle: roleTitle,
                jobAnalysis: {
                    companyName: companyName,
                    userId: user.id
                }
            }
        });

        // 만약 예외적으로 Role이 없다면 (기존 데이터 등), 생성 시도
        if (!role) {
            const analysis = await prisma.jobAnalysis.findFirst({
                where: { companyName, userId: user.id }
            });
            if (!analysis) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
            
            role = await (prisma as any).jobRole.create({
                data: {
                    analysisId: analysis.id,
                    roleTitle: roleTitle
                }
            });
        }

        // 2. 트랜잭션으로 초안들 저장
        await (prisma as any).$transaction(async (tx: any) => {
            // 기존 초안들을 모두 지우고 새로 생성 (동기화의 단순화)
            // 실제 서비스라면 개별 업데이트가 좋지만, 현재는 전체 상태를 한꺼번에 저장하는 구조임
            await tx.selfIntroduction.deleteMany({
                where: { roleId: role!.id, userId: user.id }
            });

            for (const draft of drafts) {
                const newIntro = await tx.selfIntroduction.create({
                    data: {
                        userId: user.id,
                        roleId: role!.id,
                        title: draft.name,
                        name: draft.name,
                        isFinal: draft.isFinal || false,
                    }
                });

                // 문항들 생성
                if (draft.tabs && draft.tabs.length > 0) {
                    await tx.selfIntroItem.createMany({
                        data: draft.tabs.map((tab: string, idx: number) => ({
                            selfIntroductionId: newIntro.id,
                            question: tab,
                            aiGuide: draft.questions ? draft.questions[idx] : '',
                            answer: draft.contents[idx] || '',
                            charLimit: draft.charLimits ? draft.charLimits[idx] : 700,
                            orderIndex: idx
                        }))
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Workspace Save Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
