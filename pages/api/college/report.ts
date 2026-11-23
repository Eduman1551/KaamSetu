// GET /api/college/report?year= — aggregate CSV download.
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { reportCsv } from '@/lib/server/college';

export default handler('college', ['GET'], async (req, res, user) => {
  const year = z.coerce.number().int().min(2000).max(2100).nullable().catch(null).parse(req.query.year ?? null);
  const csv = await reportCsv(user.id, year);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="kaamsetu-cohort-report${year ? `-${year}` : ''}.csv"`);
  res.send(csv);
});
