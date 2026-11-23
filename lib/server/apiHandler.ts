// Wraps an API handler: role check + friendly error responses (never leaks internals).
import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { apiUser, methods, type AuthUser } from './guard';
import type { Role } from './auth';

export function handler(
  role: Role,
  allowed: string[],
  fn: (req: NextApiRequest, res: NextApiResponse, user: AuthUser) => Promise<unknown>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!methods(req, res, allowed)) return;
    const user = await apiUser(req, res, role);
    if (!user) return;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const out = await fn(req, res, user);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input.' });
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) return res.status(status).json({ error: (err as Error).message });
      console.error('[api]', req.url, err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}
