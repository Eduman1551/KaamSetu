import DashboardLayout from '@/components/DashboardLayout';
import { requireRole, type AuthUser } from '@/lib/server/guard';

export const getServerSideProps = requireRole('student');

export default function StudentDashboard({ user }: { user: AuthUser }) {
  return (
    <DashboardLayout title="Student dashboard" role="student" userName={user.name}>
      <h1 className="page-title">Student dashboard</h1>
    </DashboardLayout>
  );
}
