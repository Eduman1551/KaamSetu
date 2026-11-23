import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { StudentData } from './types';
import { Alert, EmptyState } from '../ui';
import { VerificationBadge } from './Overview';
import { send } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';

export interface TestRules {
  total: number;
  minutes: number;
  passMark: number;
  distinctionMark: number;
  cooldownDays: number;
  maxPer30: number;
  warnAt: number;
  flagAt: number;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function Verify({ d, rules, refresh }: { d: StudentData; rules: TestRules; refresh: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inProgress = d.attempts.find((a) => a.status === 'in_progress');
  const history = d.attempts.filter((a) => a.status === 'submitted' || a.status === 'flagged');
  const gen = d.generation;

  // While a test is being prepared, poll the dashboard data for progress.
  useEffect(() => {
    if (!preparing) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [preparing, refresh]);

  const goToTest = (id: string) => {
    void router.push(`/dashboard/student/test/${id}`);
  };

  /** Ask the server to prepare the test (runs inside that request), then start it. */
  async function prepareAndStart(tries = 0): Promise<void> {
    try {
      const p = await send<{ status: 'ready' | 'generating' | 'blocked'; reason?: string }>('/api/test/prepare', 'POST');
      if (p.status === 'blocked') {
        setPreparing(false);
        setError(p.reason ?? 'Your test could not be prepared right now.');
        return;
      }
      if (p.status === 'ready') {
        const r = await send<{ attemptId: string | null }>('/api/student/test/start', 'POST');
        if (r.attemptId) return goToTest(r.attemptId);
      }
      // Another request is still generating it: check again shortly.
      if (tries < 60) setTimeout(() => prepareAndStart(tries + 1), 3000);
      else throw new Error('Preparing your test is taking too long. Please try again.');
    } catch (e) {
      setPreparing(false);
      setError((e as Error).message);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await send<{ attemptId: string | null }>('/api/student/test/start', 'POST');
      if (r.attemptId) return goToTest(r.attemptId);
      setPreparing(true);
      void prepareAndStart();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!d.analysis) {
    return <EmptyState title="Analyse your resume first">The skills test is built from the skills on your resume that employers ask for.</EmptyState>;
  }
  if (!d.canTest) {
    return (
      <EmptyState title="Add more skills to your resume to unlock verification">
        We need at least 3 technical, testable skills from your resume that also appear in today&apos;s listings. Found: {d.coreSkills.map((s) => displaySkill(s)).join(', ') || 'none'}.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h3">How the test works</h2>
          <VerificationBadge state={d.verification} />
        </div>
        <ul className="grid gap-x-6 gap-y-2 text-[15px] text-ink/85 sm:grid-cols-2">
          <li>
            <b className="num">{rules.total}</b> hard questions on: {d.coreSkills.map((s) => displaySkill(s)).join(', ')}
          </li>
          <li>
            <b className="num">{rules.minutes} minutes</b>, the timer keeps running if you leave
          </li>
          <li>
            Pass mark <b className="num">{rules.passMark} of {rules.total}</b> (73%). Distinction at <b className="num">{rules.distinctionMark}</b>.
          </li>
          <li>A skill is verified with at least 2 of its 3 questions right</li>
          <li>
            Retake after <b className="num">{rules.cooldownDays} days</b>, max <b className="num">{rules.maxPer30}</b> attempts in 30 days, always new questions
          </li>
          <li>Verification lasts 12 months</li>
        </ul>
        <div className="mt-4 rounded-xl border border-saffron/30 bg-saffron/5 px-4 py-3 text-sm text-ink/85">
          <b>Fair-play rule:</b> switching tabs or pasting is logged. You get a warning at {rules.warnAt}. At {rules.flagAt} or more the
          attempt is flagged and <b>cannot verify you</b>. No webcam, no recording.
        </div>

        <div className="mt-5">
          {inProgress ? (
            <Link href={`/dashboard/student/test/${inProgress.id}`} className="btn-primary">
              Resume my test
            </Link>
          ) : preparing ? (
            <div aria-live="polite">
              <p className="mb-2 text-[15px] font-medium">Preparing your test…</p>
              <p className="meta mb-3">Our AI writes fresh questions and double-checks every answer. This takes about a minute.</p>
              <div className="h-2 max-w-md overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-saffron transition-[width] duration-500" style={{ width: `${gen ? Math.round((gen.done / gen.total) * 100) : 5}%` }} />
              </div>
              <p className="meta num mt-1">{gen ? `${gen.done} of ${gen.total} questions ready` : 'Starting…'}</p>
            </div>
          ) : !d.retake.allowed ? (
            <Alert tone="info">
              {d.retake.reason} Your next attempt opens on <b>{fmt(d.retake.nextAt)}</b>.
            </Alert>
          ) : (
            <button className="btn-primary px-6 py-3" onClick={start} disabled={busy}>
              {busy ? 'Starting…' : history.length ? 'Start a new attempt' : 'Start the test'}
            </button>
          )}
          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <h2 className="h3 border-b border-ink/10 px-5 py-3">Attempt history</h2>
        {history.length === 0 ? (
          <p className="px-5 py-5 text-[15px] text-ink/70">No attempts yet.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>{fmt(a.submittedAt)}</span>
                <span className="num font-mono">
                  {a.correct}/{a.totalQ} · {a.scorePct}%
                </span>
                <span className={a.flagged ? 'text-miss' : a.verified ? 'text-teal' : 'text-saffron'}>
                  {a.flagged ? 'Flagged' : a.distinction ? 'Distinction' : a.verified ? 'Passed' : 'Below pass mark'}
                </span>
                <Link href={`/dashboard/student/test/${a.id}`} className="font-medium text-saffron hover:underline">
                  View result
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
