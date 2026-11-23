// GET /api/college/dashboard?year=2026 — aggregate cohort data (k>=5 suppressed).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { getCollegeDashboard } from '@/lib/server/college';

export default handler('college', ['GET'], async (req, _res, user) => {
  const year = z.coerce.number().int().min(2000).max(2100).nullable().catch(null).parse(req.query.year ?? null);
  return getCollegeDashboard(user.id, year);
});
