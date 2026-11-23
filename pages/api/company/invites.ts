// POST /api/company/invites — send an interest invite (max 20 per day).
import { handler } from '@/lib/server/apiHandler';
import { sendInvite } from '@/lib/server/company';
import { InviteSchema } from '@/lib/validation';

export default handler('company', ['POST'], async (req, _res, user) => {
  await sendInvite(user.id, InviteSchema.parse(req.body));
  return { ok: true };
});
