import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import crypto from "crypto";

// [Method 1] Generate a unique ID for this server instance.
// Using global to persist across hot-reloads, but it resets on a full server restart.
const globalForAuth = global as unknown as { launchId: string };
if (!globalForAuth.launchId) {
    globalForAuth.launchId = crypto.randomBytes(16).toString('hex');
    console.log(`🚀 [Auth] Server started with Launch ID: ${globalForAuth.launchId}`);
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
            // When signing in, add the current server's LAUNCH_ID to the token
            if (user) {
                token.launchId = LAUNCH_ID;
            }
            
            // If the token's LAUNCH_ID doesn't match the current server's, it's an old session
            if (token.launchId !== LAUNCH_ID) {
                console.log(`⚠️ [Auth] Session invalidated: Token ID (${token.launchId}) != Server ID (${LAUNCH_ID})`);
                return {}; // Return empty to effectively invalidate
            }
            
            return token;
        },
        async session({ session, token }) {
            // If token is empty (invalidated in jwt callback), do not provide a session
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
        maxAge: 30 * 60, // [Method 2] 30 minutes
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev",
};
