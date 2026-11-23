// POST /api/account/password {current, next} — any logged-in role.
import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { apiUser, methods } from '@/lib/server/guard';
import { changePassword } from '@/lib/server/studentExtras';
import { ChangePasswordSchema } from '@/lib/validation';
import { isLimited, record } from '@/lib/server/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methods(req, res, ['POST'])) return;
  const user = await apiUser(req, res, ['student', 'company', 'college']);
  if (!user) return;
  const key = `pw:${user.id}`;
  if (isLimited(key, 5, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes.' });
  try {
    const b = ChangePasswordSchema.parse(req.body);
    await changePassword(user.id, b.current, b.next);
    return res.json({ ok: true });
  } catch (e) {
    record(key);
    if (e instanceof ZodError) return res.status(400).json({ error: e.issues[0]?.message ?? 'Invalid input.' });
    const status = (e as { status?: number }).status ?? 500;
    return res.status(status).json({ error: status < 500 ? (e as Error).message : 'Something went wrong.' });
  }
}
