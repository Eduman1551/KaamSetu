import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileIcon, ShieldIcon, UploadIcon, WarnIcon, XIcon } from './Icons';
import { pressable } from './motion';

export const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  file: File | null;
  onFile: (f: File | null) => void;
  onAnalyse: () => void;
  error: string | null;
  onError: (msg: string | null) => void;
}

/** Check a file before upload; returns a friendly message or null. */
export function validateFile(f: File): string | null {
  const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'That file isn’t a PDF. Please export your resume as a PDF and try again.';
  if (f.size > MAX_BYTES) return 'That PDF is larger than 5 MB. Try a smaller export (one or two pages is ideal).';
  if (f.size === 0) return 'That file looks empty. Please pick your resume PDF again.';
  return null;
}

function prettySize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Big drag-and-drop zone: idle, drag-over, file selected and error states. */
export default function UploadZone({ file, onFile, onAnalyse, error, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const problem = validateFile(f);
    if (problem) {
      onFile(null);
      onError(problem);
    } else {
      onError(null);
      onFile(f);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const border = error ? 'border-miss/70' : dragOver ? 'border-saffron shadow-glow' : 'border-ink/30 hover:border-saffron/70';

  return (
    <div className="mx-auto max-w-3xl">
      <div
        // Acts as a button only while empty (so the "remove" button isn't nested inside another button).
        role={file ? undefined : 'button'}
        tabIndex={file ? undefined : 0}
        aria-label={file ? undefined : 'Upload your resume PDF. Click or drop a file here.'}
        onClick={() => !file && inputRef.current?.click()}
        onKeyDown={file ? undefined : onKey}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`card flex min-h-[240px] flex-col ${file ? '' : 'cursor-pointer'} items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-[border-color,box-shadow,background-color] duration-200 ${border} ${
          dragOver ? 'bg-saffron/10' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = ''; // allow re-picking the same file
          }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="flex w-full max-w-lg items-center gap-3 rounded-xl border border-teal/40 bg-teal/10 px-4 py-3 text-left"
            >
              <FileIcon className="shrink-0 text-teal" width={28} height={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" title={file.name}>
                  {file.name}
                </p>
                <p className="meta">{prettySize(file.size)} · ready to analyse</p>
              </div>
              <button
                onClick={() => onFile(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink/80 transition-colors hover:bg-ink/10 hover:text-miss"
                aria-label="Remove selected file"
              >
                <XIcon />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              <div
                className={`grid h-14 w-14 place-items-center rounded-full bg-saffron/15 text-saffron ${dragOver ? '' : 'pulse-soft'}`}
              >
                <UploadIcon width={28} height={28} />
              </div>
              <p className="font-heading text-lg font-semibold">
                {dragOver ? 'Drop it here' : 'Drag your resume PDF here'}
              </p>
              <p className="text-sm text-ink/70">
                or <span className="font-semibold text-saffron underline underline-offset-4">browse files</span> · PDF, up
                to 5 MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-start gap-2.5 rounded-xl border border-miss/40 bg-miss/10 px-4 py-2.5 text-[15px] text-ink"
          >
            <WarnIcon className="mt-0.5 shrink-0 text-miss" /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-ink/75">
        <ShieldIcon className="shrink-0 text-teal" width={16} height={16} /> Your resume file and raw text are processed in memory and never stored.
      </p>

      <div className="mt-6 flex justify-center">
        <motion.button {...pressable} onClick={onAnalyse} disabled={!file} className="btn-primary min-w-[220px] px-6 py-3">
          Analyse my resume
        </motion.button>
      </div>
    </div>
  );
}
