import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import NavBar from '@/components/NavBar';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import UploadZone from '@/components/UploadZone';
import ProgressBridge, { type Step } from '@/components/ProgressBridge';
import Results, { DeletedNotice } from '@/components/Results';
import Footer from '@/components/Footer';
import { fadeUp, inView } from '@/components/motion';
import type { AnalysisResult, ProgressEvent } from '@/lib/types';
import demoResultJson from '@/demo/result.json';

const demoResult = demoResultJson as AnalysisResult;

type Phase = 'idle' | 'analyzing' | 'results' | 'deleted';

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

function scrollToId(id: string) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hadData, setHadData] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollPending = useRef(false);

  // Elapsed-seconds timer while a live analysis is running.
  useEffect(() => {
    if (phase !== 'analyzing' || runError) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, runError]);

  /** Stop any running live analysis (the server cleans up when the stream closes). */
  const stopRun = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const showResult = useCallback((r: AnalysisResult) => {
    setResult(r);
    setPhase('results');
    // Scroll once the results have faded in (see onAnimationComplete below),
    // with a timer as a safety net.
    scrollPending.current = true;
    setTimeout(() => {
      if (!scrollPending.current) return;
      scrollPending.current = false;
      scrollToId('results');
    }, 900);
  }, []);

  const loadDemo = useCallback(() => {
    stopRun();
    setRunError(null);
    setSteps([]);
    // The demo is pre-saved (from a real run), so it is instant.
    showResult(demoResult);
  }, [showResult]);

  const analyse = useCallback(async () => {
    if (!file) return;
    stopRun();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('analyzing');
    setSteps([]);
    setPct(0);
    setElapsed(0);
    setRunError(null);
    setTimeout(() => scrollToId('analyse'), 50);

    const form = new FormData();
    form.append('resume', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'The server could not start the analysis.');
      }
      // Read the SSE stream: events are separated by a blank line, each "data: {json}".
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotResult = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const ev = JSON.parse(line.slice(5)) as ProgressEvent;
          if (ev.type === 'step') {
            setSteps((prev) => {
              const others = prev.filter((s) => s.id !== ev.id);
              const exists = prev.some((s) => s.id === ev.id);
              const next = { id: ev.id, label: ev.label, status: ev.status };
              return exists ? prev.map((s) => (s.id === ev.id ? next : s)) : [...others, next];
            });
          } else if (ev.type === 'progress') {
            setPct(ev.pct);
          } else if (ev.type === 'result') {
            gotResult = true;
            setPct(100);
            setHadData(true);
            showResult(ev.result);
          } else if (ev.type === 'error') {
            throw new Error(ev.message);
          }
        }
      }
      if (!gotResult) throw new Error('The connection closed before the analysis finished.');
    } catch (err) {
      if (controller.signal.aborted) return; // user reset or switched to demo
      setRunError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [file, showResult]);

  /** Wipe server data (if any) and clear the UI. */
  const deleteData = useCallback(async () => {
    stopRun();
    const live = result && !result.demo ? result.sessionId : null;
    setDeleting(true);
    try {
      if (live) await fetch(`/api/session/${encodeURIComponent(live)}`, { method: 'DELETE' });
    } catch {
      /* the server also auto-deletes after the TTL */
    }
    setHadData(!!live || hadData);
    setDeleting(false);
    setResult(null);
    setFile(null);
    setSteps([]);
    setRunError(null);
    setPhase('deleted');
    setTimeout(() => scrollToId('analyse'), 50);
  }, [result, hadData]);

  /** Back to the very start (presenter shortcut "R"). */
  const reset = useCallback(() => {
    stopRun();
    if (result && !result.demo) {
      fetch(`/api/session/${encodeURIComponent(result.sessionId)}`, { method: 'DELETE' }).catch(() => {});
    }
    setResult(null);
    setFile(null);
    setUploadError(null);
    setSteps([]);
    setPct(0);
    setRunError(null);
    setHadData(false);
    setPhase('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [result]);

  // Presenter shortcuts: D = demo result, R = reset.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'd' || e.key === 'D') loadDemo();
      if (e.key === 'r' || e.key === 'R') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadDemo, reset]);

  return (
    <>
      <Head>
        <title>KaamSetu — Bridge your degree to your first job</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <NavBar onDemo={loadDemo} hasResults={phase === 'results'} />

      <main>
        <Hero onUpload={() => scrollToId('analyse')} onDemo={loadDemo} />
        <HowItWorks />

        <section id="analyse" className="mx-auto min-h-[70vh] max-w-7xl scroll-mt-24 px-5 py-16 md:px-8 md:py-24">
          {phase === 'idle' && (
            <motion.div {...inView} variants={fadeUp} className="mb-12 text-center">
              <p className="kicker mb-3">Analyse</p>
              <h2 className="section-title">Upload your resume</h2>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div key="upload" {...fade}>
                <UploadZone
                  file={file}
                  onFile={setFile}
                  onAnalyse={analyse}
                  error={uploadError}
                  onError={setUploadError}
                />
              </motion.div>
            )}
            {phase === 'analyzing' && (
              <motion.div key="progress" {...fade}>
                <ProgressBridge
                  steps={steps}
                  pct={pct}
                  elapsed={elapsed}
                  error={runError}
                  onSwitchDemo={loadDemo}
                  onRetry={file ? analyse : reset}
                />
              </motion.div>
            )}
            {phase === 'results' && result && (
              <motion.div
                key={`results-${result.sessionId}`}
                {...fade}
                onAnimationComplete={() => {
                  if (!scrollPending.current) return;
                  scrollPending.current = false;
                  scrollToId('results');
                }}
              >
                <Results result={result} onDelete={deleteData} deleting={deleting} />
              </motion.div>
            )}
            {phase === 'deleted' && (
              <motion.div key="deleted" {...fade}>
                <DeletedNotice hadData={hadData} onRestart={reset} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <Footer onDelete={deleteData} />
    </>
  );
}
