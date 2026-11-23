// POST /api/college/workshop {skill, regenerate?} — Groq workshop plan for a priority gap (cached).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { workshopFor } from '@/lib/server/college';
import { isLimited, record } from '@/lib/server/rateLimit';

const Body = z.object({ skill: z.string().trim().toLowerCase().min(1).max(40), regenerate: z.boolean().optional() });

export default handler('college', ['POST'], async (req, res, user) => {
  const b = Body.parse(req.body);
  if (b.regenerate) {
    if (isLimited(`workshop:${user.id}`, 10, 3600_000)) return res.status(429).json({ error: 'Please wait a little before regenerating more plans.' });
    record(`workshop:${user.id}`);
  }
  return { plan: await workshopFor(user.id, b.skill, b.regenerate) };
});
