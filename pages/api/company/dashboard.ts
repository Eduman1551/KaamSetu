// GET /api/company/dashboard?req=<requirementId> — company dashboard data (anonymous DTOs only).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { getCompanyDashboard } from '@/lib/server/company';

export default handler('company', ['GET'], async (req, _res, user) => {
  const reqId = z.string().uuid().nullable().catch(null).parse(req.query.req ?? null);
  return getCompanyDashboard(user.id, reqId);
});
