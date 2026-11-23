// GET /api/student/demand — what companies want (aggregate, no company names).
import { handler } from '@/lib/server/apiHandler';
import { getDemand } from '@/lib/server/studentExtras';

export default handler('student', ['GET'], async (_req, _res, user) => getDemand(user.id));
