// Pure date helpers. All "today" logic uses the visitor's LOCAL calendar day.
import { CAMPAIGN } from './config.js';

const DAY_MS = 86400000;

/**
 * The "now" used by the page. `?date=2026-12-07` (noon local) or `?date=2026-12-07T23:59:50`
 * (local time) replaces the real clock for QA. Anything unparsable is ignored.
 * `allowOverride=false` (client build, VITE_CLIENT=1) ignores `?date=` completely.
 * @returns {Date}
 */
export function parseNow(search = '', realNow = new Date(), allowOverride = true) {
  if (!allowOverride) return realNow;
  const raw = new URLSearchParams(search).get('date');
  if (!raw) return realNow;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return realNow;
  const [, y, mo, d, h, mi, s] = m.map((v) => (v === undefined ? undefined : Number(v)));
  const hasTime = h !== undefined;
  const dt = new Date(y, mo - 1, d, hasTime ? h : 12, hasTime ? mi : 0, hasTime ? (s ?? 0) : 0);
  if (Number.isNaN(dt.getTime()) || dt.getMonth() !== mo - 1) return realNow;
  return dt;
}

/**
 * Campaign day number for a moment: 1 = 1 Dec, 7 = 7 Dec ... 26 = 26 Dec.
 * Before the campaign it is <= 0, after it is >= 27. Calendar-based (DST safe).
 */
export function campaignDay(now, c = CAMPAIGN) {
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const start = Date.UTC(c.year, c.month - 1, 1);
  return Math.round((local - start) / DAY_MS) + 1;
}

/** 'missed' | 'active' | 'locked' for a day, given today's campaign day number. */
export function dayState(day, today) {
  if (day < today) return 'missed';
  if (day === today) return 'active';
  return 'locked';
}

/** First visible day for a window of `size` days centred on today and clamped to 1..days. */
export function windowStart(today, size, days = CAMPAIGN.days) {
  const start = today - Math.floor(size / 2);
  return Math.min(Math.max(start, 1), days - size + 1);
}

/** The visible days (e.g. [5,6,7,8,9]) and the slot index holding today (-1 if today is outside). */
export function visibleDays(today, size, days = CAMPAIGN.days) {
  const start = windowStart(today, size, days);
  const list = Array.from({ length: size }, (_, i) => start + i);
  return { days: list, todayIndex: list.indexOf(today) };
}

/** Local calendar date of a campaign day. */
export function dayDate(day, c = CAMPAIGN) {
  return new Date(c.year, c.month - 1, day);
}

/**
 * Moment the next gift unlocks: local midnight starting tomorrow's day,
 * or local midnight of day 1 before the campaign starts.
 */
export function nextUnlock(now, c = CAMPAIGN) {
  const today = campaignDay(now, c);
  if (today < 1) return new Date(c.year, c.month - 1, 1);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** Whole seconds from `now` to `target` (never negative). */
export function secondsUntil(now, target) {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

/** 14:32:08 style; hours can exceed 24 (before the campaign) and are not wrapped. */
export function formatCountdown(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** Which relative tag a day gets: 'missed' | 'yesterday' | 'today' | 'tomorrow' | 'in_two_days' | 'locked'. */
export function relativeKey(day, today) {
  const diff = day - today;
  if (diff < -1) return 'missed';
  if (diff === -1) return 'yesterday';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === 2) return 'in_two_days';
  return 'locked';
}
