// The analysis pipeline. Each step reports progress through `send` (SSE).
// Core rule: every number shown comes from real listings fetched in this run.
import type { AnalysisResult, AtsTip, ProgressEvent, SkillCount, SkillToAdd } from '@/lib/types';
import { env } from './env';
import { atsChecks, extractPdfText } from './resume';
import { readProfile } from './profile';
import { analyseListing, findListingUrls, roleWords, type Listing } from './listings';
import { isNoise, skillDisplay, skillKey, textMentions } from './skills';
import { findCourses } from './courses';
import { writeReport } from './report';
import { buildProofCards, type ProofCandidate } from './proof';
import { fetchPageText } from './browser';

type Send = (ev: ProgressEvent) => void;

export class FriendlyError extends Error {}
class Cancelled extends Error {}

/** Map low-level errors to messages a first-time user understands. */
export function friendly(err: unknown): Error {
  if (err instanceof FriendlyError || err instanceof Cancelled) return err;
  const e = err as { status?: number; message?: string };
  if (e?.status === 429) return new FriendlyError('The AI service is busy right now (rate limit). Please try again in a minute, or use the demo result.');
  if (e?.status === 401) return new FriendlyError('The AI key on the server is invalid. Check GROQ_API_KEY in .env.local.');
  if (e?.status && e.status >= 400) return new FriendlyError('The AI service had a hiccup. Please try again, or use the demo result.');
  return new FriendlyError(e?.message || 'Something went wrong during analysis.');
}

interface SkillAgg {
  key: string;
  names: Map<string, number>; // original spellings -> votes (for display)
  listings: Set<number>; // indexes into the listings array
}

/** Most common original spelling, e.g. "Power BI" rather than "power bi". */
function displayName(a: SkillAgg) {
  return skillDisplay(a.key, [...a.names.entries()].sort((x, y) => y[1] - x[1])[0][0]);
}

export async function runPipeline(
  pdf: Buffer,
  sessionId: string,
  send: Send,
  isCancelled: () => boolean,
): Promise<AnalysisResult> {
  const step = (id: string, label: string, status: 'active' | 'done' = 'active') => send({ type: 'step', id, label, status });
  const progress = (pct: number) => send({ type: 'progress', pct: Math.round(pct) });
  const checkCancel = () => {
    if (isCancelled()) throw new Cancelled('Cancelled');
  };
  let waitingLabel = '';
  const waitNote = (id: string) => (s: number) => step(id, `${waitingLabel} (AI is busy, waiting ${s}s…)`);

  try {
    // ── 1. Read the PDF in memory ────────────────────────────────────────────
    waitingLabel = 'Reading your resume…';
    step('read', waitingLabel);
    const { text: resumeText, pages } = await extractPdfText(pdf);
    if (resumeText.split(/\s+/).length < 40) {
      throw new FriendlyError('We could not read text from this PDF. If it is a scanned image, please export a text-based PDF.');
    }
    const ats = atsChecks(resumeText, pages);
    progress(4);

    // ── 2. AI reads the resume ───────────────────────────────────────────────
    const profile = await readProfile(resumeText, waitNote('read'));
    step('read', `Read your resume — aiming for ${profile.targetRoles.join(' / ')}`, 'done');
    progress(10);
    checkCancel();

    // ── 3a. Find live listings ───────────────────────────────────────────────
    step('search', 'Searching the web for fresher jobs in India…');
    const max = env.maxListings;
    const candidates = await findListingUrls(profile.targetRoles, Math.ceil(max * 2.5));
    if (candidates.length < 5) {
      throw new FriendlyError('We could not find enough live job listings for your target roles right now. Please try again, or use the demo result.');
    }
    step('search', `Found ${candidates.length} live job pages to open`, 'done');
    progress(16);
    checkCancel();

    // ── 3b. Open + read each listing, 3 at a time ────────────────────────────
    waitingLabel = `Scanning ${max} job listings…`;
    step('scan', `Scanning ${max} job listings…`);
    const listings: Listing[] = [];
    const words = roleWords(profile.targetRoles);
    const reasons: Record<string, number> = {};
    let next = 0;
    let droppedQuotes = 0;
    // Page loads are slow, AI calls are rate-limited: open a few pages ahead of the
    // 3 AI workers so they never sit waiting for a browser.
    const PREFETCH = 3;
    const pageLoads = new Map<number, ReturnType<typeof fetchPageText>>();
    const pageFor = (i: number) => {
      if (i < candidates.length && !pageLoads.has(i)) pageLoads.set(i, fetchPageText(candidates[i].url, 10_000));
      return pageLoads.get(i);
    };
    const worker = async () => {
      while (next < candidates.length && listings.length < max && !isCancelled()) {
        const i = next++;
        const c = candidates[i];
        for (let k = 1; k <= PREFETCH; k++) if (listings.length + k < max) pageFor(i + k);
        try {
          const r = await analyseListing(c, words, waitNote('scan'), pageFor(i));
          droppedQuotes += r.dropped;
          reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
          if (r.listing && listings.length < max) {
            listings.push(r.listing);
            step('scan', `Scanning ${max} job listings… (${listings.length}/${max} read)`);
            progress(16 + (listings.length / max) * 54);
          }
        } catch (err) {
          // One bad page shouldn't stop the run, but a dead AI key should.
          const status = (err as { status?: number }).status;
          if (status === 401) throw err;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    checkCancel();
    if (listings.length < 5) {
      throw new FriendlyError(`Only ${listings.length} listings could be read right now (some sites block automated visits). Please try again, or use the demo result.`);
    }
    const total = listings.length;
    const domains = [...new Set(listings.map((l) => l.domain))];
    step('scan', `Scanned ${total} real listings from ${domains.length} websites`, 'done');
    console.log(`[pipeline] listings: ${JSON.stringify(reasons)}; dropped ${droppedQuotes} unverifiable quotes`);
    progress(72);

    // ── 4. Aggregate skill counts and compare with the resume ────────────────
    step('compare', 'Comparing your skills with what employers ask for…');
    const agg = new Map<string, SkillAgg>();
    listings.forEach((l, i) => {
      for (const ev of l.skills) {
        const key = skillKey(ev.skillKeyName);
        if (isNoise(key)) continue;
        const a = agg.get(key) ?? { key, names: new Map(), listings: new Set<number>() };
        a.names.set(ev.skillKeyName, (a.names.get(ev.skillKeyName) ?? 0) + 1);
        a.listings.add(i);
        agg.set(key, a);
      }
    });
    const resumeKeys = new Set(profile.skills.map(skillKey));
    const has = (key: string) => resumeKeys.has(key) || textMentions(resumeText, key);
    const demand = [...agg.values()]
      .map((a) => ({ key: a.key, skill: displayName(a), count: a.listings.size, has: has(a.key) }))
      .sort((x, y) => y.count - x.count);

    // A skill seen in just one listing isn't a "demand" signal once we have 10+ listings.
    const minCount = total >= 10 ? 2 : 1;
    const strengths: SkillCount[] = demand
      .filter((d) => d.has && d.count >= minCount)
      .slice(0, 8)
      .map((d) => ({ skill: d.skill, count: d.count }));
    const missing = demand.filter((d) => !d.has && d.count >= minCount);

    // Skills-match score: share of demand (weighted by frequency) the resume already covers.
    const top = demand.slice(0, 15);
    const weight = top.reduce((s, d) => s + d.count, 0) || 1;
    const skillsMatch = Math.round((top.filter((d) => d.has).reduce((s, d) => s + d.count, 0) / weight) * 100);
    step('compare', `Compared ${demand.length} in-demand skills with your resume`, 'done');
    progress(76);
    checkCancel();

    // ── 5. Courses (Tavily) and the written report (Groq) in parallel ────────
    step('courses', 'Finding free courses for your missing skills…');
    waitingLabel = 'Writing your report…';
    step('report', waitingLabel);
    const toAdd = missing.slice(0, 5);
    const [courseLists, report] = await Promise.all([
      Promise.all(toAdd.map((d) => findCourses(d.skill))).then((r) => {
        step('courses', 'Found courses for your top skills to add', 'done');
        progress(82);
        return r;
      }),
      writeReport({
        resumeText,
        roles: profile.targetRoles,
        demand,
        total,
        codeAtsIssues: ats.tips.filter((t) => !t.pass).map((t) => t.text),
        onWait: waitNote('report'),
      }).then((r) => {
        step('report', 'Wrote your report', 'done');
        progress(86);
        return r;
      }),
    ]);
    checkCancel();

    // 2 courses per skill, never showing the same course under two skills.
    const usedCourses = new Set<string>();
    const skillsToAdd: SkillToAdd[] = toAdd.map((d, i) => {
      const courses = courseLists[i].filter((c) => !usedCourses.has(c.url)).slice(0, 2);
      courses.forEach((c) => usedCourses.add(c.url));
      return { skill: d.skill, count: d.count, courses };
    });

    // ATS tips: code checks first (fixes before passes), then AI extras; max 5.
    // AI tips that would have the student list a skill they don't have are dropped.
    const fixes = ats.tips.filter((t) => !t.pass);
    const passes = ats.tips.filter((t) => t.pass);
    const extra: AtsTip[] = report.extraAtsTips
      .filter((t) => t && !missing.some((m) => textMentions(t, m.key)))
      .map((t) => ({ pass: false, text: t }));
    const atsTips = [...fixes, ...extra, ...passes].slice(0, 5);

    // ── 6. Proof cards ───────────────────────────────────────────────────────
    const relevance = (skill: string) => {
      const r = Object.entries(report.relevance).find(([k]) => skillKey(k) === skillKey(skill));
      return r ? Math.max(1, Math.min(3, r[1])) : 2;
    };
    const proofCandidates: ProofCandidate[] = demand.slice(0, 12).map((d) => ({
      skill: d.skill,
      count: d.count,
      missing: !d.has,
      priority: d.count * relevance(d.skill),
      evidence: listings
        .map((l) => ({ l, ev: l.skills.find((e) => skillKey(e.skillKeyName) === d.key) }))
        .filter((x) => !!x.ev)
        .map((x) => ({ url: x.l.url, company: x.l.company, jobTitle: x.l.title, quote: x.ev!.quote, sentence: x.ev!.sentence })),
    }));
    waitingLabel = 'Taking proof screenshots…';
    step('shots', 'Taking proof screenshots…');
    const proofCards = await buildProofCards(proofCandidates, total, sessionId, isCancelled);
    const captured = proofCards.filter((c) => c.shotUrl).length;
    step('shots', `Captured ${captured} of ${proofCards.length} proof screenshots`, 'done');
    progress(99);
    checkCancel();

    const impact = Math.round(report.impactScore);
    const structure = Math.round((report.structureScore + Math.min(100, ats.sectionsFound.length * 25)) / 2);
    const overall = Math.round(0.4 * skillsMatch + 0.2 * ats.score + 0.2 * impact + 0.2 * structure);
    const summary =
      report.summary.trim() ||
      `You match ${skillsMatch}% of today's in-demand skills for ${profile.targetRoles[0]}. Adding ${toAdd[0]?.skill ?? 'one key skill'} is your best next step.`;

    return {
      sessionId,
      demo: false,
      generatedAt: new Date().toISOString(),
      targetRoles: profile.targetRoles,
      educationLevel: profile.educationLevel,
      overallScore: overall,
      subScores: { skillsMatch, atsReadability: ats.score, impact, structure },
      summary,
      strengths,
      skillsToAdd,
      atsTips,
      proofCards,
      listingsAnalyzed: { count: total, sources: domains },
      ttlMinutes: env.sessionTtlMinutes,
    };
  } catch (err) {
    throw friendly(err);
  }
}
