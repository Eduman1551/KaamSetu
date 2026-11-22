// DELETE /api/session/[id] — wipe a session's results and screenshot files.
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteSession } from '@/lib/server/sessions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Use DELETE.' });
  }
  const id = String(req.query.id || '');
  if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).json({ error: 'Invalid session id.' });
  const existed = await deleteSession(id);
  // Same answer either way: after this call nothing from the session remains.
  return res.status(200).json({ deleted: true, existed });
}
