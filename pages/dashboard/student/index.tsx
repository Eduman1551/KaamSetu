import { useCallback } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import AnalysisFlow from '@/components/AnalysisFlow';
import Overview from '@/components/student/Overview';
import type { StudentData } from '@/components/student/types';
import { requireRole, type AuthUser } from '@/lib/server/guard';
import { getStudentDashboard } from '@/lib/server/student';
import { generationProgress } from '@/lib/server/testGen';
import { fetcher } from '@/lib/fetcher';
import { Briefcase, FileText, LayoutDashboard, Mail, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import Verify, { type TestRules } from '@/components/student/Verify';
import Invites from '@/components/student/Invites';
import DemandView from '@/components/student/Demand';
import Settings from '@/components/student/Settings';
import * as T from '@/lib/server/testConfig';

export const getServerSideProps = requireRole('student', async (_ctx, user) => {
  const data = { ...(await getStudentDashboard(user.id)), generation: generationProgress(user.id) };
  const rules: TestRules = {
    total: T.TOTAL_QUESTIONS,
    minutes: T.TEST_DURATION_SEC / 60,
    passMark: T.PASS_MARK,
    distinctionMark: T.DISTINCTION_MARK,
    cooldownDays: T.RETAKE_COOLDOWN_DAYS,
    maxPer30: T.MAX_ATTEMPTS_PER_30_DAYS,
    warnAt: T.TAB_SWITCH_WARN,
    flagAt: T.TAB_SWITCH_FLAG,
  };
  return { props: { initial: JSON.parse(JSON.stringify(data)) as StudentData, rules } };
});

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analysis', label: 'Resume Analysis', icon: FileText },
  { id: 'verify', label: 'Verify My Skills', icon: ShieldCheck },
  { id: 'demand', label: 'What Companies Want', icon: Briefcase },
  { id: 'invites', label: 'Invites', icon: Mail },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function StudentDashboard({ user, initial, rules }: { user: AuthUser; initial: StudentData; rules: TestRules }) {
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
          {tab === 'verify' && <Verify d={d} rules={rules} refresh={() => mutate()} />}
          {tab === 'demand' && <DemandView go={go} />}
          {tab === 'invites' && <Invites onChange={() => mutate()} />}
          {tab === 'settings' && <Settings d={d} refresh={() => mutate()} />}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
