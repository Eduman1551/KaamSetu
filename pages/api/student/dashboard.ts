// GET /api/student/dashboard — the logged-in student's own dashboard data.
import type { NextApiRequest, NextApiResponse } from 'next';
import { apiUser, methods } from '@/lib/server/guard';
import { getStudentDashboard } from '@/lib/server/student';
import { generationProgress } from '@/lib/server/testGen';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methods(req, res, ['GET'])) return;
  const user = await apiUser(req, res, 'student');
  if (!user) return;
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ...(await getStudentDashboard(user.id)), generation: generationProgress(user.id) });
}
