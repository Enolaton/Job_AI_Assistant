import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('--- GLOBAL HELLO CALLED ---');
    return NextResponse.json({ message: 'hello' });
}
