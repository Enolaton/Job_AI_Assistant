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
    globalForAuth.launchId = IS_PRODUCTION
        ? crypto.randomBytes(16).toString('hex')
        : 'dev-stable';
    console.log(`🚀 [Auth] Launch ID: ${globalForAuth.launchId} (${IS_PRODUCTION ? 'production' : 'development'})`);
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
            
            // Only enforce LAUNCH_ID check in production
            if (IS_PRODUCTION && token.launchId && token.launchId !== LAUNCH_ID) {
                console.log(`⚠️ [Auth] Session invalidated: Token ID (${token.launchId}) != Server ID (${LAUNCH_ID})`);
                return {};
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
