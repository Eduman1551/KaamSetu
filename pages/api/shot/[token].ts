// GET /api/shot/[token] — serve a proof screenshot.
// Live screenshots: random token -> temp file (deleted with the session).
// Demo screenshots: "demo-<name>" -> /demo/shots/<name>.jpg (pre-saved).
import fs from 'fs/promises';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { lookupShot } from '@/lib/server/shots';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = String(req.query.token || '');
  let file: string | null = null;
  let cache = 'private, no-store';

  if (/^[a-f0-9]{36}$/.test(token)) {
    file = lookupShot(token)?.file ?? null;
  } else if (/^demo-[a-z0-9-]{1,40}$/.test(token)) {
    // Strict pattern above means no path traversal is possible.
    file = path.join(process.cwd(), 'demo', 'shots', `${token.slice(5)}.jpg`);
    cache = 'public, max-age=3600';
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
