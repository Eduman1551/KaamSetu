// GET /api/college/workshops — workshop plans for the 3 priority gaps.
// Generated automatically (Groq) when missing or when the data changed meaningfully, then cached.
import { handler } from '@/lib/server/apiHandler';
import { ensureWorkshops } from '@/lib/server/college';

export default handler('college', ['GET'], async (_req, _res, user) => ({ plans: await ensureWorkshops(user.id) }));
