// app/api/register/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 1. 여기서 기획서에 명시된 DB(예: MongoDB)에 사용자 저장 로직이 들어갑니다.
    // 예: const newUser = await db.user.create({ data: { email, password, name } });
    
    console.log("회원가입 시도:", { email, name });

    // 2. 성공 응답 반환
    return NextResponse.json({ message: "회원가입 성공" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "회원가입 중 오류 발생" }, { status: 500 });
  }
}