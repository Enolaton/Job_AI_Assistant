import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 1. MongoDB 연결
    const client = await clientPromise;
    const db = client.db("job_ai_database");

    // 2. 이메일 중복 확인
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "이미 가입된 이메일입니다." }, { status: 400 });
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 사용자 데이터 저장
    const result = await db.collection("users").insertOne({
      email,
      password: hashedPassword,
      name,
      createdAt: new Date(),
    });

    console.log("회원가입 완료:", result.insertedId);

    return NextResponse.json({ message: "회원가입에 성공했습니다!" }, { status: 201 });
  } catch (error) {
    console.error("회원가입 에러:", error);
    return NextResponse.json({ message: "회원가입 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
