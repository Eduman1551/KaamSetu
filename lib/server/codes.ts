// Human-friendly random codes.
import crypto from 'crypto';

const hex = (n: number) => crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n).toUpperCase();

/** Anonymous candidate code shown to companies, e.g. "KS-7F3A9C". */
export function newAnonCode() {
  return `KS-${hex(6)}`;
}

/** College join code, e.g. "KIT-7F3A9" (3 letters from the college name + 5 hex chars). */
export function newJoinCode(collegeName: string) {
  const letters =
    collegeName
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for|&)$/i.test(w))
      .map((w) => w[0].toUpperCase())
      .join('')
      .slice(0, 3)
      .padEnd(3, 'X');
  return `${letters}-${hex(5)}`;
}

/** Emails reserved for seed / demo data. Real signups may not use them. */
export const RESERVED_EMAIL_DOMAINS = ['kaamsetu.test', 'seed.kaamsetu.test'];
export function isReservedEmail(email: string) {
  const domain = email.toLowerCase().split('@')[1] ?? '';
  return RESERVED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}
