import DashboardLayout from '@/components/DashboardLayout';
import { requireRole, type AuthUser } from '@/lib/server/guard';

export const getServerSideProps = requireRole('college');

export default function CollegeDashboard({ user }: { user: AuthUser }) {
  return (
    <DashboardLayout title="College dashboard" role="college" userName={user.name}>
      <h1 className="page-title">College dashboard</h1>
    </DashboardLayout>
  );
}
