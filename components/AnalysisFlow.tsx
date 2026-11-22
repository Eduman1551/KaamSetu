import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import UploadZone from './UploadZone';
import ProgressBridge, { type Step } from './ProgressBridge';
import Results from './Results';
import type { AnalysisResult, ProgressEvent } from '@/lib/types';

type Phase = 'idle' | 'analyzing' | 'results';

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

interface Props {
  /** Saved analysis to show first (re-opened on later visits). */
  initialResult: AnalysisResult | null;
  /** Called when a new analysis has been saved. */
  onDone?: (r: AnalysisResult) => void;
}

/** Upload → live progress (SSE) → results. Uploading again replaces the saved result. */
export default function AnalysisFlow({ initialResult, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>(initialResult ? 'results' : 'idle');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(initialResult);
  const abortRef = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Elapsed-seconds timer while a live analysis is running.
  useEffect(() => {
    if (phase !== 'analyzing' || runError) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, runError]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const analyse = useCallback(async () => {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('analyzing');
    setSteps([]);
    setPct(0);
    setElapsed(0);
    setRunError(null);
    setTimeout(scrollTop, 50);

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
              const next = { id: ev.id, label: ev.label, status: ev.status };
              return prev.some((s) => s.id === ev.id) ? prev.map((s) => (s.id === ev.id ? next : s)) : [...prev, next];
            });
          } else if (ev.type === 'progress') {
            setPct(ev.pct);
          } else if (ev.type === 'result') {
            gotResult = true;
            setPct(100);
            setResult(ev.result);
            setPhase('results');
            setFile(null);
            onDone?.(ev.result);
            setTimeout(scrollTop, 450);
          } else if (ev.type === 'error') {
            throw new Error(ev.message);
          }
        }
      }
      if (!gotResult) throw new Error('The connection closed before the analysis finished.');
    } catch (err) {
      if (controller.signal.aborted) return;
      setRunError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [file, onDone]);

  return (
    <div ref={topRef} className="scroll-mt-4">
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="upload" {...fade}>
            {result && (
              <div className="mb-4 flex justify-end">
                <button className="btn-ghost btn-sm" onClick={() => setPhase('results')}>
                  Back to my saved results
                </button>
              </div>
            )}
            <UploadZone file={file} onFile={setFile} onAnalyse={analyse} error={uploadError} onError={setUploadError} />
          </motion.div>
        )}
        {phase === 'analyzing' && (
          <motion.div key="progress" {...fade}>
            <ProgressBridge steps={steps} pct={pct} elapsed={elapsed} error={runError} onRetry={() => setPhase('idle')} />
          </motion.div>
        )}
        {phase === 'results' && result && (
          <motion.div key={`results-${result.generatedAt}`} {...fade}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="meta">Saved to your account. Uploading a new resume replaces this analysis.</p>
              <button className="btn-secondary btn-sm" onClick={() => setPhase('idle')}>
                Analyse a new resume
              </button>
            </div>
            <Results result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
