import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProofCardData } from '@/lib/types';
import { ExternalIcon, XIcon } from './Icons';
import { fadeUp } from './motion';

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Full-size screenshot overlay. Esc or click outside to close. */
function Lightbox({ card, onClose }: { card: ProofCardData; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/90 p-4 backdrop-blur-md md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshot proof for ${card.skill}`}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute -top-14 right-0 grid h-12 w-12 place-items-center rounded-xl bg-ink/10 text-ink hover:bg-ink/20"
          aria-label="Close screenshot"
        >
          <XIcon />
        </button>
        <Image
          src={card.shotUrl!}
          alt={`Screenshot of the ${card.jobTitle} listing at ${card.company}, with the sentence mentioning ${card.skill} highlighted`}
          width={1350}
          height={630}
          unoptimized
          className="h-auto w-full rounded-2xl border border-ink/15 bg-ink shadow-glass"
        />
        <p className="mt-4 text-center text-ink/80">
          {card.company} · {card.jobTitle} · scanned {formatDate(card.scannedAt)}
        </p>
      </motion.div>
    </motion.div>
  );
}

/**
 * One proof card: a real screenshot of a live listing with the skill sentence
 * highlighted, or a same-size text fallback when no screenshot was possible.
 */
export default function ProofCard({ card }: { card: ProofCardData }) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const hasShot = !!card.shotUrl && !imgFailed;

  return (
    <motion.article variants={fadeUp} whileHover={{ y: -4 }} className="glass flex flex-col overflow-hidden">
      {/* Media area: same aspect ratio for screenshot and fallback, so nothing jumps. */}
      <div className="relative aspect-[900/420] w-full overflow-hidden border-b border-ink/10 bg-navy-950">
        {hasShot ? (
          <button
            onClick={() => setOpen(true)}
            className="group block h-full w-full"
            aria-label={`Open full screenshot for ${card.skill}`}
          >
            <Image
              src={card.shotUrl!}
              alt={`Real screenshot of the ${card.jobTitle} listing at ${card.company}, sentence mentioning ${card.skill} highlighted`}
              width={900}
              height={420}
              unoptimized
              onError={() => setImgFailed(true)}
              className="h-full w-full bg-ink object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <span className="absolute bottom-3 right-3 rounded-lg bg-navy/80 px-3 py-1 text-sm text-ink/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Click to enlarge
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col justify-center p-5">
            <span className="absolute right-3 top-3 rounded-md bg-ink/10 px-2 py-0.5 text-sm text-ink/75">
              Screenshot unavailable
            </span>
            <blockquote className="line-clamp-4 border-l-4 border-saffron pl-4 italic text-ink/90">
              “{card.sentence}”
            </blockquote>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="text-2xl font-semibold">{card.skill}</h3>
        <p className="text-lg">
          <span className="font-semibold text-saffron">{card.skill}</span> appears in{' '}
          <span className="font-semibold">
            {card.count} of {card.total}
          </span>{' '}
          listings
        </p>
        <p className="truncate text-ink/80" title={`${card.company} · ${card.jobTitle}`}>
          {card.company} · {card.jobTitle}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-ink/70">
          <span className="text-base">Scanned {formatDate(card.scannedAt)}</span>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-saffron hover:text-ink"
          >
            View source <ExternalIcon />
          </a>
        </div>
      </div>

      {/* Portal to <body>: the card's transform/blur would otherwise trap position:fixed. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>{open && hasShot && <Lightbox card={card} onClose={() => setOpen(false)} />}</AnimatePresence>,
          document.body,
        )}
    </motion.article>
  );
}
