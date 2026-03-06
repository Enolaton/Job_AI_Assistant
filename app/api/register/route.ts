import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 1. 이름 검증
    const nameRegex = /^[a-zA-Z가-힣]{1,19}$/;
    if (!nameRegex.test(name)) {
      return NextResponse.json({ message: "이름은 한글 또는 영어 1~19자 이하여야 합니다." }, { status: 400 });
    }

    // 2. 이메일 검증
    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      return NextResponse.json({ message: "올바르지 않은 이메일 형식입니다." }, { status: 400 });
    }
    const [emailPrefix, emailDomain] = emailParts;

    // admin 사용 제한 확인
    const adminRegex = /^admin\d*$/i;
    if (adminRegex.test(name) || adminRegex.test(emailPrefix)) {
      return NextResponse.json({ message: "admin은 사용 할수 없습니다" }, { status: 400 });
    }

    // 상세 형식 검증 (RFC 준수 및 사용자 요청 반영)
    const localRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
    const domainPartRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const tldRegex = /^[a-zA-Z]{2,}$/;

    const domainLabels = emailDomain.split('.');
    const isDomainValid =
      domainLabels.length >= 2 &&
      domainLabels.every(label => domainPartRegex.test(label)) &&
      tldRegex.test(domainLabels[domainLabels.length - 1]);

    if (
      email.includes(" ") ||
      email.length > 320 ||
      emailDomain.includes("xn--") ||
      !localRegex.test(emailPrefix) ||
      !isDomainValid
    ) {
      return NextResponse.json({ message: "올바르지 않은 이메일 형식입니다." }, { status: 400 });
    }

    // 3. 비밀번호 검증
    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ message: "비밀번호는 8~16자 사이의 영문 또는 숫자여야 하며, 특수기호는 사용할 수 없습니다." }, { status: 400 });
    }

    // 4. 이메일 중복 확인 (PostgreSQL via Prisma)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ message: "이미 가입된 이메일입니다." }, { status: 400 });
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 사용자 데이터 저장 (PostgreSQL via Prisma)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: email === 'admin@bunny.com' || name === 'admin' ? 'ADMIN' : 'USER'
      }
    });

    console.log("회원가입 완료:", newUser.id);

    return NextResponse.json({ message: "회원가입에 성공했습니다!" }, { status: 201 });
  } catch (error) {
    console.error("회원가입 에러:", error);
    return NextResponse.json({ message: "회원가입 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

