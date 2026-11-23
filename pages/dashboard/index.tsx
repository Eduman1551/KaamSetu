// /dashboard -> each role's own dashboard.
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions, DASHBOARD } from '@/lib/server/auth';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const role = session?.user?.role;
  return { redirect: { destination: role ? DASHBOARD[role] : '/login', permanent: false } };
};

export default function DashboardRedirect() {
  return null;
}
