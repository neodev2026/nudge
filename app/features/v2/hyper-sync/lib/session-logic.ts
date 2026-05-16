/**
 * Pure logic functions for Hyper-Sync sessions.
 * No DB, no React — safe to unit-test in isolation.
 */

export interface FrontBackCard {
  id: string;
  front: string;
  back: string;
}

export interface CardEntry {
  titleCard: FrontBackCard;
  exampleCard: FrontBackCard | null;
}

export type RetryStep = 1 | 2 | 3 | 4 | 5;

export interface RetryCardView {
  card: { front: string; back: string };
  isFlipped: boolean;   // step 2/4 — front is the Korean meaning
  isExample: boolean;   // step 3 — example card (when available)
}

/**
 * Returns which card + orientation to show for a given retry step.
 *
 * Step pattern (spec §6.2):
 *   1: title forward       (target → ko)
 *   2: title reversed      (ko → target)        — front becomes Korean
 *   3: example forward     (target → ko)        — falls back to title forward if no example
 *   4: title reversed      (ko → target)
 *   5: title forward       (target → ko)
 */
export function getRetryCard(stage: CardEntry, step: RetryStep): RetryCardView {
  if (step === 1 || step === 5) {
    return {
      card: { front: stage.titleCard.front, back: stage.titleCard.back },
      isFlipped: false,
      isExample: false,
    };
  }

  if (step === 2 || step === 4) {
    return {
      card: { front: stage.titleCard.back, back: stage.titleCard.front },
      isFlipped: true,
      isExample: false,
    };
  }

  // step === 3 — example forward, or title forward fallback
  if (stage.exampleCard) {
    return {
      card: { front: stage.exampleCard.front, back: stage.exampleCard.back },
      isFlipped: false,
      isExample: true,
    };
  }

  return {
    card: { front: stage.titleCard.front, back: stage.titleCard.back },
    isFlipped: false,
    isExample: false,
  };
}

/**
 * Returns the UTC ISO string for the next calendar day at `hour` (0-23) in the
 * user's timezone. Always pushes to the next day regardless of when called —
 * never returns a past timestamp. See spec §3.4 for the gap distribution.
 */
export function nextMorningAt(timezone: string, hour: number): string {
  // 1. Today's local date in user's tz, as 'YYYY-MM-DD'.
  const today_str = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

  // 2. + 1 day.
  const tomorrow = new Date(today_str + "T00:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrow_str = tomorrow.toISOString().slice(0, 10);

  // 3. Assemble local datetime then convert to UTC via offset arithmetic.
  const local_str = `${tomorrow_str}T${String(hour).padStart(2, "0")}:00:00`;
  const local_as_utc_ms = new Date(local_str).getTime();
  const local_in_tz_ms = new Date(
    new Date(local_str).toLocaleString("en-US", { timeZone: timezone })
  ).getTime();
  const tz_offset_ms = local_as_utc_ms - local_in_tz_ms;

  return new Date(local_as_utc_ms + tz_offset_ms).toISOString();
}

/**
 * Returns 'YYYY-MM-DD' in the user's timezone for the current moment.
 * Used as nv2_hyper_sync_results.session_date so results are bucketed by
 * the day the user perceived as "today".
 */
export function localSessionDate(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}
