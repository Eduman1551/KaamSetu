import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { requireRole, type AuthUser } from '@/lib/server/guard';
import { Logo } from '@/components/NavBar';
import LightTheme from '@/components/LightTheme';
import { Alert, Confirm, Skeleton } from '@/components/ui';
import QuestionText, { looksLikeCode } from '@/components/student/QuestionText';
import { SubBar } from '@/components/Results';
import { CheckIcon, XIcon } from '@/components/Icons';
import { fetcher, send } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';
import { PASS_MARK, TOTAL_QUESTIONS } from '@/lib/server/testConfig';

export const getServerSideProps = requireRole('student', async (ctx) => ({
  props: { attemptId: String(ctx.params?.id ?? ''), passMark: PASS_MARK, total: TOTAL_QUESTIONS },
}));

interface Q {
  id: string;
  idx: number;
  skill: string;
  question: string;
  options: string[];
  answer: number | null;
  marked: boolean;
}
interface Live {
  status: 'in_progress';
  questions: Q[];
  endsAt: string;
  serverNow: string;
  tabSwitches: number;
  warnAt: number;
  flagAt: number;
}
interface Result {
  status: string;
  correct: number;
  total: number;
  scorePct: number;
  verified: boolean;
  distinction: boolean;
  flagged: boolean;
  tabSwitches: number;
  durationSec: number;
  skills: { skill: string; correct: number; total: number; scorePct: number; verified: boolean }[];
  nextAttemptAt: string | null;
  review: { idx: number; skill: string; difficulty: string; question: string; options: string[]; answer: number | null; correctIndex: number; isCorrect: boolean; explanation: string }[];
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Runner({ attemptId, live, onDone }: { attemptId: string; live: Live; onDone: () => void }) {
  const [qs, setQs] = useState<Q[]>(live.questions);
  const [i, setI] = useState(() => Math.max(0, live.questions.findIndex((q) => q.answer === null)));
  const [left, setLeft] = useState(0);
  const [tabs, setTabs] = useState(live.tabSwitches);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Offset between server and browser clocks so the countdown matches the server.
  const offset = useMemo(() => new Date(live.serverNow).getTime() - Date.now(), [live.serverNow]);
  const endsAt = useMemo(() => new Date(live.endsAt).getTime(), [live.endsAt]);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await send(`/api/student/test/${attemptId}/submit`, 'POST');
    } catch {
      /* the server auto-submits at the deadline anyway */
    }
    onDone();
  }, [attemptId, onDone]);

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.round((endsAt - (Date.now() + offset)) / 1000));
      setLeft(s);
      if (s === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt, offset, submit]);

  // Integrity: tab switches and paste events are counted on the server.
  useEffect(() => {
    const report = (type: 'tab' | 'paste') =>
      send<{ tabSwitches: number }>(`/api/student/test/${attemptId}/event`, 'POST', { type })
        .then((r) => setTabs(r.tabSwitches))
        .catch(() => {});
    const onVis = () => document.visibilityState === 'hidden' && report('tab');
    const onPaste = () => report('paste');
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('paste', onPaste);
    };
  }, [attemptId]);

  const save = async (q: Q, patch: Partial<Pick<Q, 'answer' | 'marked'>>) => {
    const next = { ...q, ...patch };
    setQs((prev) => prev.map((x) => (x.id === q.id ? next : x)));
    try {
      await send(`/api/student/test/${attemptId}/answer`, 'POST', { questionId: q.id, answer: next.answer, marked: next.marked });
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message);
      if (/submitted|no longer/i.test((e as Error).message)) onDone();
    }
  };

  const q = qs[i];
  const answered = qs.filter((x) => x.answer !== null).length;
  const low = left <= 300;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-navy/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Logo href="/dashboard/student?tab=verify" />
          <div className="flex items-center gap-4">
            <span className="meta num hidden sm:inline">
              {answered}/{qs.length} answered
            </span>
            <span className={`num rounded-lg px-3 py-1 font-mono text-lg font-semibold ${low ? 'bg-miss/15 text-miss' : 'bg-ink/5'}`} role="timer" aria-label={`Time left ${mmss(left)}`}>
              {mmss(left)}
            </span>
          </div>
        </div>
        <div className="h-1 bg-ink/10">
          <div className="h-full bg-saffron transition-[width] duration-300" style={{ width: `${((i + 1) / qs.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {tabs >= live.warnAt && (
          <div className="mb-4">
            <Alert>
              {tabs >= live.flagAt
                ? `You left the test ${tabs} times. This attempt is flagged and cannot verify you.`
                : `Please stay on this tab. Leaving or pasting has been logged ${tabs} times; at ${live.flagAt} the attempt is flagged.`}
            </Alert>
          </div>
        )}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="meta">
            Question <span className="num">{i + 1}</span> of {qs.length} · {displaySkill(q.skill)}
          </p>
          <button
            className={`chip ${q.marked ? 'bg-saffron/20 text-saffron' : 'bg-ink/5 text-ink/70 hover:text-ink'}`}
            onClick={() => save(q, { marked: !q.marked })}
            aria-pressed={q.marked}
          >
            {q.marked ? 'Marked for review' : 'Mark for review'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <div className="card mb-4 p-5">
              <QuestionText text={q.question} className="space-y-2 text-[16px] leading-relaxed" />
            </div>
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Choose one answer</legend>
              {q.options.map((o, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    q.answer === oi ? 'border-saffron bg-navy-700' : 'border-sand bg-navy-800 hover:border-saffron/60'
                  }`}
                >
                  <input type="radio" name={q.id} checked={q.answer === oi} onChange={() => save(q, { answer: oi })} className="mt-1 h-4 w-4 shrink-0 accent-saffron" />
                  <span className="mr-1 font-mono text-sm text-ink/60">{String.fromCharCode(65 + oi)}</span>
                  <span className={`whitespace-pre-wrap wrap-any text-[15px] ${looksLikeCode(o) ? 'font-mono text-[13.5px]' : ''}`}>{o}</span>
                </label>
              ))}
            </fieldset>
          </motion.div>
        </AnimatePresence>
        {saveError && (
          <div className="mt-3">
            <Alert>{saveError}</Alert>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button className="btn-secondary" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
            Previous
          </button>
          {i < qs.length - 1 ? (
            <button className="btn-primary" onClick={() => setI((x) => Math.min(qs.length - 1, x + 1))}>
              Next
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setConfirm(true)}>
              Review and submit
            </button>
          )}
        </div>

        <nav className="mt-8" aria-label="Question navigator">
          <p className="meta mb-2">Jump to a question (orange = answered, ring = marked)</p>
          <div className="flex flex-wrap gap-1.5">
            {qs.map((x, xi) => (
              <button
                key={x.id}
                onClick={() => setI(xi)}
                aria-label={`Question ${xi + 1}${x.answer !== null ? ', answered' : ''}${x.marked ? ', marked' : ''}`}
                className={`num h-9 w-9 rounded-lg font-mono text-sm ${xi === i ? 'outline outline-2 outline-ink' : ''} ${
                  x.answer !== null ? 'bg-saffron text-navy' : 'bg-ink/5 text-ink/75'
                } ${x.marked ? 'ring-2 ring-sky ring-offset-1' : ''}`}
              >
                {xi + 1}
              </button>
            ))}
          </div>
          <button className="btn-ghost btn-sm mt-4" onClick={() => setConfirm(true)}>
            Submit test now
          </button>
        </nav>
      </main>

      <Confirm
        open={confirm}
        title="Submit your test?"
        confirmLabel="Submit"
        busy={submitting}
        onConfirm={submit}
        onCancel={() => setConfirm(false)}
      >
        You answered <b className="num">{answered}</b> of {qs.length} questions
        {qs.some((x) => x.marked) ? ` and marked ${qs.filter((x) => x.marked).length} for review` : ''}. You cannot change answers after submitting.
      </Confirm>
    </div>
  );
}

function ResultView({ r, passMark }: { r: Result; passMark: number }) {
  const wrong = r.review.filter((q) => !q.isCorrect);
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const tone = r.flagged ? 'text-miss' : r.verified ? 'text-teal' : 'text-saffron';
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Logo href="/dashboard/student" />
          <Link href="/dashboard/student?tab=verify" className="btn-ghost btn-sm">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 text-center">
          <p className="kicker mb-2">Your result</p>
          <p className="num font-mono text-[44px] font-semibold">
            {r.correct}
            <span className="text-2xl text-ink/50">/{r.total}</span>
          </p>
          <p className={`mt-1 font-heading text-xl font-semibold ${tone}`}>
            {r.flagged ? 'Flagged: not counted for verification' : r.distinction ? 'Verified with Distinction' : r.verified ? 'Verified' : 'Not verified this time'}
          </p>
          <p className="meta num mt-2">
            {r.scorePct}% · pass mark {passMark}/{r.total} · {Math.round(r.durationSec / 60)} min · {r.tabSwitches} tab switch{r.tabSwitches === 1 ? '' : 'es'}
          </p>
          {r.verified && (
            <div className="mx-auto mt-4 max-w-md">
              <Alert tone="success">
                Turn on <Link href="/dashboard/student?tab=settings" className="font-semibold underline">company visibility</Link> so employers can find your verified profile.
              </Alert>
            </div>
          )}
          {!r.verified && r.nextAttemptAt && <p className="mt-3 text-[15px] text-ink/80">You can retake from {fmt(r.nextAttemptAt)} with brand-new questions.</p>}
        </motion.section>

        <section className="card p-5">
          <h2 className="h3 mb-4">By skill</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {r.skills.map((s) => (
              <div key={s.skill}>
                <SubBar label={`${displaySkill(s.skill)} · ${s.correct}/${s.total}${s.verified ? ' · verified' : ''}`} value={s.scorePct} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="h3 mb-3">{wrong.length ? `Review: ${wrong.length} question${wrong.length > 1 ? 's' : ''} to learn from` : 'Perfect score, nothing to review'}</h2>
          <div className="space-y-3">
            {wrong.map((q) => (
              <div key={q.idx} className="card p-4">
                <p className="meta mb-2">
                  {displaySkill(q.skill)} · {q.difficulty}
                </p>
                <QuestionText text={q.question} className="space-y-2 text-[15px]" />
                <ul className="mt-3 space-y-1.5 text-sm">
                  {q.options.map((o, oi) => (
                    <li
                      key={oi}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                        oi === q.correctIndex ? 'bg-teal/10 text-teal' : oi === q.answer ? 'bg-miss/10 text-miss' : 'text-ink/70'
                      }`}
                    >
                      {oi === q.correctIndex ? <CheckIcon width={15} height={15} className="mt-0.5 shrink-0" /> : oi === q.answer ? <XIcon width={15} height={15} className="mt-0.5 shrink-0" /> : <span className="w-[15px] shrink-0" />}
                      <span className={`whitespace-pre-wrap wrap-any ${looksLikeCode(o) ? 'font-mono text-[13px]' : ''}`}>{o}</span>
                    </li>
                  ))}
                </ul>
                {q.answer === null && <p className="meta mt-2">Not answered.</p>}
                <p className="mt-3 border-l-2 border-saffron pl-3 text-sm text-ink/85">{q.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function TestPage({ attemptId, passMark }: { user: AuthUser; attemptId: string; passMark: number }) {
  const [live, setLive] = useState<Live | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const t = await fetcher(`/api/student/test/${attemptId}`);
      if (t.status === 'in_progress') {
        setLive(t);
        return;
      }
      setLive(null);
      if (t.status === 'submitted' || t.status === 'flagged') setResult(await fetcher(`/api/student/test/${attemptId}/result`));
      else setError(t.status === 'ready' ? 'This test has not been started yet. Start it from your dashboard.' : 'This test is no longer available.');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <LightTheme>
      <Head>
        <title>Skills test · KaamSetu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {error ? (
        <div className="mx-auto max-w-xl px-4 py-16">
          <Alert>{error}</Alert>
          <Link href="/dashboard/student?tab=verify" className="btn-secondary mt-4">
            Back to dashboard
          </Link>
        </div>
      ) : live ? (
        <Runner attemptId={attemptId} live={live} onDone={load} />
      ) : result ? (
        <ResultView r={result} passMark={passMark} />
      ) : (
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-10" aria-busy="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
    </LightTheme>
  );
}
