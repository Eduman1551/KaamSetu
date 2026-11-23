// Role guards for pages (getServerSideProps) and API routes.
// Every check re-reads the user from the DB, so a deleted account is locked out at once.
import type { GetServerSidePropsContext, GetServerSidePropsResult, NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { eq } from 'drizzle-orm';
import { authOptions, DASHBOARD, type Role } from './auth';
import { db } from './db';
import { users } from './db/schema';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

async function loadUser(id: string | undefined): Promise<AuthUser | null> {
  if (!id) return null;
  const [u] = await db.select({ id: users.id, role: users.role, name: users.name, email: users.email }).from(users).where(eq(users.id, id));
  return u ?? null;
}

/**
 * Page guard: `export const getServerSideProps = requireRole('student', async (ctx, user) => ({ props: {...} }))`.
 * Not logged in -> /login. Wrong role -> own dashboard.
 */
export function requireRole<P extends Record<string, unknown>>(
  role: Role,
  inner?: (ctx: GetServerSidePropsContext, user: AuthUser) => Promise<GetServerSidePropsResult<P>>,
) {
  return async (ctx: GetServerSidePropsContext): Promise<GetServerSidePropsResult<P & { user: AuthUser }>> => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    const user = await loadUser(session?.user?.id);
    if (!user) return { redirect: { destination: `/login?next=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } };
    if (user.role !== role) return { redirect: { destination: DASHBOARD[user.role], permanent: false } };
    if (!inner) return { props: { user } as P & { user: AuthUser } };
    const r = await inner(ctx, user);
    if ('props' in r) return { props: { ...(await r.props), user } };
    return r;
  };
}

/** API guard: returns the user, or sends 401/403 and returns null. */
export async function apiUser(req: NextApiRequest, res: NextApiResponse, role: Role | Role[]): Promise<AuthUser | null> {
  const session = await getServerSession(req, res, authOptions);
  const user = await loadUser(session?.user?.id);
  if (!user) {
    res.status(401).json({ error: 'Please log in again.' });
    return null;
  }
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(user.role)) {
    res.status(403).json({ error: 'You do not have access to this.' });
    return null;
  }
  return user;
}

/** Allow only the given HTTP methods. */
export function methods(req: NextApiRequest, res: NextApiResponse, allowed: string[]) {
  if (allowed.includes(req.method ?? '')) return true;
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ error: `Use ${allowed.join(' or ')}.` });
  return false;
}
