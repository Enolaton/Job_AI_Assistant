import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import crypto from "crypto";

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// [Security] Generate a unique ID per server deployment.
// This is ONLY used in production to invalidate old sessions after a new deployment.
// In development, Next.js recompiles modules in multiple contexts (middleware, API routes, pages),
// each getting their own `global`, which causes constant LAUNCH_ID mismatches and session drops.
const globalForAuth = global as unknown as { launchId: string };
if (!globalForAuth.launchId) {
    // [보안] 서버 실행 시마다 고유한 ID를 생성합니다. 
    // 이를 통해 서버가 재시작되면 기존 브라우저의 세션 쿠키를 무효화(Invalidate) 처리합니다.
    globalForAuth.launchId = crypto.randomBytes(16).toString('hex');
    console.log(`🚀 [Auth] Launch ID 생성: ${globalForAuth.launchId} (${IS_PRODUCTION ? '운영' : '개발'})`);
}
const LAUNCH_ID = globalForAuth.launchId;

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                });

                if (!user) {
                    return null;
                }

                const isPasswordCorrect = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordCorrect) {
                    return null;
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.launchId = LAUNCH_ID;
            }
            
            // Session invalidation logic via LAUNCH_ID check
            // If the server has restarted (new LAUNCH_ID), we invalidate old tokens.
            if (token.launchId && token.launchId !== LAUNCH_ID) {
                console.log(`⚠️ [Auth] Session invalidated: Token ID mismatch (${token.launchId} != ${LAUNCH_ID})`);
                return null as any; 
            }
            
            return token;
        },
        async session({ session, token }) {
            if (!token.email) {
                return null as any;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 60, // 30 minutes
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev",
};
