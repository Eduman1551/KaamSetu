// GET /api/student/analysis-status — status of the student's latest analysis run.
import { handler } from '@/lib/server/apiHandler';
import { getRunStatus } from '@/lib/server/analysisRuns';

export default handler('student', ['GET'], async (_req, _res, user) => ({ run: await getRunStatus(user.id) }));
