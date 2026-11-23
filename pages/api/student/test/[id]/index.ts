// GET /api/student/test/[id] — questions for an in-progress test (no answer key).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { getTestForClient } from '@/lib/server/testRun';

export default handler('student', ['GET'], async (req, _res, user) => getTestForClient(user.id, z.string().uuid().parse(req.query.id)));
