// NextAuth v4 options: email + password (bcrypt), JWT sessions carrying id + role.
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { users } from './db/schema';
import { LOGIN_LIMIT, isLimited, record, reset } from './rateLimit';

import type { Role } from '@/lib/roles';
export type { Role } from '@/lib/roles';
export { DASHBOARD } from '@/lib/roles';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

function clientIp(headers: Record<string, unknown> | undefined) {
  const xf = headers?.['x-forwarded-for'];
  return (Array.isArray(xf) ? xf[0] : typeof xf === 'string' ? xf.split(',')[0] : '') || 'local';
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 3600 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(credentials, req) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) throw new Error('Enter a valid email and password.');
        const { email, password } = parsed.data;
        const key = `login:${email}:${clientIp(req?.headers as Record<string, unknown>)}`;
        if (await isLimited(key, LOGIN_LIMIT.max, LOGIN_LIMIT.windowMs)) {
          throw new Error('Too many failed attempts. Please wait 15 minutes and try again.');
        }
        const [user] = await db.select().from(users).where(eq(users.email, email));
        // Synthetic seed accounts have a non-bcrypt hash and can never log in.
        const ok = !!user && user.passwordHash.startsWith('$2') && (await bcrypt.compare(password, user.passwordHash));
        if (!ok) {
          await record(key, LOGIN_LIMIT.windowMs);
          throw new Error('Incorrect email or password.');
        }
        await reset(key);
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
