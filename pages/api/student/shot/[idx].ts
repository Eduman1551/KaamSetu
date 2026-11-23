// GET /api/student/shot/[idx] — the logged-in student's own proof screenshot (webp).
import type { NextApiRequest, NextApiResponse } from 'next';
import { apiUser, methods } from '@/lib/server/guard';
import { getShot } from '@/lib/server/student';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methods(req, res, ['GET'])) return;
  const user = await apiUser(req, res, 'student');
  if (!user) return;
  const idx = Number(req.query.idx);
  if (!Number.isInteger(idx) || idx < 0 || idx > 2) return res.status(400).json({ error: 'Invalid screenshot.' });
  const bytes = await getShot(user.id, idx);
  if (!bytes) return res.status(404).json({ error: 'Screenshot not found.' });
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  return res.send(bytes);
}
