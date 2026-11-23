import type { ReactNode } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './NavBar';
import type { RoleName } from './ui';

const VALUE: Record<RoleName, { title: string; line: string }> = {
  student: {
    title: 'For students',
    line: 'See what real employers ask for, close the gaps, and earn a Verified badge companies trust.',
  },
  company: {
    title: 'For companies',
    line: 'Meet anonymous, test-verified freshers ranked against your own hiring requirements.',
  },
  college: {
    title: 'For colleges',
    line: 'See cohort-level skill gaps from real test data and plan the workshops that matter.',
  },
};

/** Split auth layout: bridge photo + value line on the left, form on the right. */
export default function AuthLayout({ title, role, children }: { title: string; role: RoleName; children: ReactNode }) {
  return (
    <>
      <Head>
        <title>{`${title} · KaamSetu`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(440px,520px)]">
        <aside className="relative isolate hidden overflow-hidden lg:block">
          <Image src="/bg.jpg" alt="A suspension bridge at sunrise" fill priority sizes="60vw" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy via-navy/70 to-navy/40" />
          <div className="flex h-full flex-col justify-between p-10">
            <Logo />
            <AnimatePresence mode="wait">
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="max-w-md"
              >
                <p className="kicker mb-2">{VALUE[role].title}</p>
                <p className="font-heading text-[28px] font-semibold leading-tight">{VALUE[role].line}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
        <main className="flex flex-col justify-center bg-navy px-4 py-10 sm:px-10">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="mx-auto w-full max-w-md">{children}</div>
        </main>
      </div>
    </>
  );
}
