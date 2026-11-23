// POST /api/student/test/prepare — generate a fresh test on demand (rate-limited).
import { handler } from '@/lib/server/apiHandler';
import { queueTestGeneration } from '@/lib/server/testGen';

export default handler('student', ['POST'], async (_req, _res, user) => queueTestGeneration(user.id));
