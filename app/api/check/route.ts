import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ message: 'Routing is working!', path: '/api/check' });
}
