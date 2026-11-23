// POST /api/auth/signup — create a student, company or college account.
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, dbTx } from '@/lib/server/db';
import { colleges, companies, studentProfiles, users } from '@/lib/server/db/schema';
import { SignupSchema } from '@/lib/validation';
import { isReservedEmail, newAnonCode, newJoinCode } from '@/lib/server/codes';
import { methods } from '@/lib/server/guard';
import { isLimited, record } from '@/lib/server/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methods(req, res, ['POST'])) return;
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'local').split(',')[0];
  if (await isLimited(`signup:${ip}`, 10, 3600_000)) return res.status(429).json({ error: 'Too many sign-ups from this network. Try again later.' });

  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fieldErrors });
  }
  const input = parsed.data;
  if (isReservedEmail(input.email)) return res.status(400).json({ error: 'This email domain is reserved.', fieldErrors: { email: ['This email domain is reserved.'] } });

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (exists) return res.status(409).json({ error: 'An account with this email already exists. Try logging in.', fieldErrors: { email: ['Already registered.'] } });

  let collegeId: string | null = null;
  if (input.role === 'student' && input.joinCode) {
    const [c] = await db.select({ id: colleges.userId }).from(colleges).where(eq(colleges.joinCode, input.joinCode));
    if (!c) return res.status(400).json({ error: 'That college join code was not found.', fieldErrors: { joinCode: ['Code not found. Leave empty to add it later.'] } });
    collegeId = c.id;
  }

  await record(`signup:${ip}`, 3600_000);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const displayName = input.role === 'student' ? input.name : input.role === 'company' ? `${input.companyName} hiring team` : input.collegeName;

  await dbTx().transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email: input.email, passwordHash, role: input.role, name: displayName }).returning({ id: users.id });
    if (input.role === 'student') {
      await tx.insert(studentProfiles).values({ userId: u.id, collegeId, gradYear: input.gradYear, educationLevel: input.educationLevel, anonCode: newAnonCode() });
    } else if (input.role === 'company') {
      await tx.insert(companies).values({ userId: u.id, companyName: input.companyName, website: input.website || null, industry: input.industry, sizeBand: input.sizeBand });
    } else {
      await tx.insert(colleges).values({ userId: u.id, collegeName: input.collegeName, city: input.city, state: input.state, joinCode: newJoinCode(input.collegeName) });
    }
  });
  return res.status(201).json({ ok: true });
}
