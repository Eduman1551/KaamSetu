import { useCallback } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import AnalysisFlow from '@/components/AnalysisFlow';
import Overview from '@/components/student/Overview';
import { EmptyState } from '@/components/ui';
import type { StudentData } from '@/components/student/types';
import { requireRole, type AuthUser } from '@/lib/server/guard';
import { getStudentDashboard } from '@/lib/server/student';
import { generationProgress } from '@/lib/server/testGen';
import { fetcher } from '@/lib/fetcher';

export const getServerSideProps = requireRole('student', async (_ctx, user) => {
  const data = { ...(await getStudentDashboard(user.id)), generation: generationProgress(user.id) };
  return { props: { initial: JSON.parse(JSON.stringify(data)) as StudentData } };
});

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'analysis', label: 'Resume Analysis' },
  { id: 'verify', label: 'Verify My Skills' },
  { id: 'demand', label: 'What Companies Want' },
  { id: 'invites', label: 'Invites' },
  { id: 'settings', label: 'Settings' },
];

export default function StudentDashboard({ user, initial }: { user: AuthUser; initial: StudentData }) {
  const router = useRouter();
  const tab = TABS.some((t) => t.id === router.query.tab) ? String(router.query.tab) : 'overview';
  const { data, mutate } = useSWR<StudentData>('/api/student/dashboard', fetcher, { fallbackData: initial, revalidateOnFocus: true });
  const d = data ?? initial;

  const go = useCallback(
    (id: string) => {
      router.replace({ pathname: router.pathname, query: id === 'overview' ? {} : { tab: id } }, undefined, { shallow: true, scroll: false });
      window.scrollTo({ top: 0 });
    },
    [router],
  );

  const nav = TABS.map((t) => ({ ...t, badge: t.id === 'invites' ? d.pendingInvites : undefined }));
  const title = TABS.find((t) => t.id === tab)!.label;

  return (
    <DashboardLayout title={title} role="student" userName={user.name} nav={nav} active={tab} onNav={go}>
      <h1 className="page-title mb-5">{tab === 'overview' ? `Hi, ${user.name.split(' ')[0]}` : title}</h1>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {tab === 'overview' && <Overview d={d} go={go} />}
          {tab === 'analysis' && <AnalysisFlow initialResult={d.analysis} onDone={() => mutate()} />}
          {tab === 'verify' && <EmptyState title="Skills test">Coming soon.</EmptyState>}
          {tab === 'demand' && <EmptyState title="What companies want">Coming soon.</EmptyState>}
          {tab === 'invites' && <EmptyState title="Invites">Coming soon.</EmptyState>}
          {tab === 'settings' && <EmptyState title="Settings">Coming soon.</EmptyState>}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
