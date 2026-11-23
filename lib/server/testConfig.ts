// Skills-test rules in one place.
export const TOTAL_QUESTIONS = 15;
export const PASS_MARK = 11; // of 15 (73%) -> verified
export const DISTINCTION_MARK = 13; // of 15 (87%)
export const TEST_DURATION_SEC = 30 * 60;
export const GRACE_SEC = 60;
export const READY_TEST_TTL_HOURS = 24;
export const RETAKE_COOLDOWN_DAYS = 3;
export const MAX_ATTEMPTS_PER_30_DAYS = 3;
export const VERIFICATION_MONTHS = 12;
export const TAB_SWITCH_WARN = 3;
export const TAB_SWITCH_FLAG = 6;
export const MIN_CORE_SKILLS = 3;
export const MAX_CORE_SKILLS = 5;
/** Skill is verified when at least 2/3 of its questions are correct. */
export const SKILL_VERIFY_FRACTION = 2 / 3;
export const GENERATIONS_PER_HOUR = 3;
