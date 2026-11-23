import DashboardLayout from '@/components/DashboardLayout';
import { requireRole, type AuthUser } from '@/lib/server/guard';

export const getServerSideProps = requireRole('company');

export default function CompanyDashboard({ user }: { user: AuthUser }) {
  return (
    <DashboardLayout title="Company dashboard" role="company" userName={user.name}>
      <h1 className="page-title">Company dashboard</h1>
    </DashboardLayout>
  );
}
