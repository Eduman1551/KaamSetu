// GET /api/shot/[token] — serve a proof screenshot.
// Live screenshots: random token -> temp file (deleted with the session).
import fs from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import { lookupShot } from '@/lib/server/shots';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = String(req.query.token || '');
  let file: string | null = null;
  const cache = 'private, no-store';

  if (/^[a-f0-9]{36}$/.test(token)) {
    file = lookupShot(token)?.file ?? null;
  }
  if (!file) return res.status(404).json({ error: 'Screenshot not found (it may have been deleted).' });

  try {
    const buf = await fs.readFile(file);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', cache);
    return res.send(buf);
  } catch {
    return res.status(404).json({ error: 'Screenshot not found (it may have been deleted).' });
  }
}
