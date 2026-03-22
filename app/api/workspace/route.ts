import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// GET: 자기소개서 목록 또는 상세 데이터 불러오기
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        // 특정 ID가 있는 경우 상세 조회
        if (id) {
            const si = await (prisma as any).selfIntroduction.findUnique({
                where: { id: parseInt(id) },
                include: {
                    items: { orderBy: { orderIndex: 'asc' } },
                    jobAnalysis: true,
                    jobRole: true
                }
            });
            if (!si || si.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

            return NextResponse.json({
                draft: {
                    id: String(si.id),
                    name: si.title,
                    status: si.status,
                    companyName: si.jobAnalysis?.companyName || si.manualCompanyName || '',
                    jobTitle: si.jobRole?.roleTitle || si.manualJobTitle || '',
                    analysisId: si.analysisId,
                    roleId: si.roleId,
                    updatedAt: si.updatedAt,
                    tabs: si.items.map((it: any) => it.question),
                    questions: si.items.map((it: any) => it.aiGuide || ''),
                    contents: si.items.map((it: any) => it.answer || ''),
                    charLimits: si.items.map((it: any) => it.charLimit || 700)
                }
            });
        }

        // 전체 목록 조회 (Drive View용)
        const documents = await (prisma as any).selfIntroduction.findMany({
            where: { userId: user.id },
            include: {
                jobAnalysis: true,
                jobRole: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        const formattedDocs = documents.map((si: any) => ({
            id: String(si.id),
            title: si.title,
            company: si.jobAnalysis?.companyName || si.manualCompanyName || '미지정',
            job: si.jobRole?.roleTitle || si.manualJobTitle || '직무 미지정',
            status: si.status,
            lastModified: si.updatedAt
        }));

        return NextResponse.json({ documents: formattedDocs });
    } catch (error) {
        console.error('Workspace API Load Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: 단일 자기소개서 저장/생성 (Drive 중심)
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

        const { 
            id, name, status, tabs, questions, contents, charLimits, 
            roleId, analysisId, companyName, jobTitle 
        } = await req.json();

        // 트랜잭션으로 저장
        const result = await (prisma as any).$transaction(async (tx: any) => {
            let si;
            if (id && !id.startsWith('temp-')) {
                // 기존 문서 업데이트
                si = await tx.selfIntroduction.update({
                    where: { id: parseInt(id) },
                    data: {
                        title: name,
                        status: status || '작성전',
                        roleId: roleId ? parseInt(roleId) : null,
                        analysisId: analysisId ? parseInt(analysisId) : null,
                        manualCompanyName: companyName || null,
                        manualJobTitle: jobTitle || null
                    }
                });

                // 기존 문항 일괄 삭제 후 재생성 (동기화 단순화)
                await tx.selfIntroItem.deleteMany({ where: { selfIntroductionId: si.id } });
            } else {
                // 신규 문서 생성
                si = await tx.selfIntroduction.create({
                    data: {
                        userId: user.id,
                        title: name || '새 자기소개서',
                        status: status || '작성전',
                        roleId: roleId ? parseInt(roleId) : null,
                        analysisId: analysisId ? parseInt(analysisId) : null,
                        manualCompanyName: companyName || null,
                        manualJobTitle: jobTitle || null
                    }
                });
            }

            // 문항 저장
            if (tabs && tabs.length > 0) {
                await tx.selfIntroItem.createMany({
                    data: tabs.map((tab: string, idx: number) => ({
                        selfIntroductionId: si.id,
                        question: tab,
                        aiGuide: questions ? questions[idx] : '',
                        answer: contents ? contents[idx] : '',
                        charLimit: charLimits ? charLimits[idx] : 700,
                        orderIndex: idx
                    }))
                });
            }
            return si;
        });

        return NextResponse.json({ success: true, id: String(result.id) });
    } catch (error: any) {
        console.error('Workspace Save Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// DELETE: 자기소개서 삭제
export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // 해당 사용자의 문서인지 확인 후 삭제
        const si = await (prisma as any).selfIntroduction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!si || si.userId !== user.id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // 연관된 문항들과 함께 삭제 (On cascade delete 설정에 따라 다르지만 명시적 처리 권장)
        await (prisma as any).$transaction(async (tx: any) => {
            await tx.selfIntroItem.deleteMany({ where: { selfIntroductionId: si.id } });
            await tx.selfIntroduction.delete({ where: { id: si.id } });
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Workspace Delete Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
