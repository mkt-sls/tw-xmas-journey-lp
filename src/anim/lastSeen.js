// "New day unlock" bookkeeping: localStorage key tw-cj:lastSeenDay holds the campaign day number last shown.
export const LAST_SEEN_KEY = 'tw-cj:lastSeenDay';

/**
 * Decides whether the unlock animation plays.
 * - first visit (nothing stored): never plays, today is stored
 * - stored day < today and today is a real campaign day: plays, today is stored
 * - same day, a stored day in the future (QA clock moved back), or outside the campaign: no play
 * `store` is true whenever the stored value should be replaced by today.
 * @returns {{ play: boolean, store: boolean }}
 */
export function unlockDecision(lastSeen, today, days = 26) {
  if (!Number.isInteger(lastSeen)) return { play: false, store: true };
  if (lastSeen === today) return { play: false, store: false };
  const inCampaign = today >= 1 && today <= days;
  return { play: lastSeen < today && inCampaign, store: true };
}

function parse(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the stored day, stores today when needed and tells whether to play.
 * Storage that throws (private mode, blocked) behaves like a first visit every time: no animation.
 */
export function checkNewDay(today, storage = defaultStorage(), days = 26) {
  let last = null;
  try {
    last = parse(storage?.getItem(LAST_SEEN_KEY));
  } catch {
    last = null;
  }
  const d = unlockDecision(last, today, days);
  if (d.store) {
    try {
      storage?.setItem(LAST_SEEN_KEY, String(today));
    } catch {
      /* ignore */
    }
  }
  return d.play;
}
