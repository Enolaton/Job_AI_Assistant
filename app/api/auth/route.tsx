import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // 실제 구현 시에는 DB(MongoDB)에서 사용자 정보를 확인해야 합니다.
        const user = { id: "admin", name: "관리자", email: "admin@naver.com" };
        
        if (credentials?.email === user.email && credentials?.password === "1234") {
          return user;
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/login', // 커스텀 로그인 페이지 지정
  }
});

export { handler as GET, handler as POST };