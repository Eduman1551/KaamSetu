// GET /api/student/invites — own invites. POST {id, action} — accept or decline.
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { getInvites, respondInvite } from '@/lib/server/studentExtras';

const Body = z.object({ id: z.string().uuid(), action: z.enum(['accept', 'decline']) });

export default handler('student', ['GET', 'POST'], async (req, _res, user) => {
  if (req.method === 'POST') {
    const b = Body.parse(req.body);
    await respondInvite(user.id, b.id, b.action === 'accept');
  }
  return { invites: await getInvites(user.id) };
});
