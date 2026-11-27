import { describe, expect, it } from 'vitest';
import {
  campaignDay, dayState, formatCountdown, nextUnlock, parseNow, relativeKey, secondsUntil, visibleDays, windowStart,
} from './date.js';
import { marketFromLanguages } from './market.js';
import { fill, longDate, shortDate } from './i18n.js';

const at = (q) => parseNow('?date=' + q);
const states = (q) => {
  const today = campaignDay(at(q));
  return Array.from({ length: 26 }, (_, i) => dayState(i + 1, today));
};

describe('day states from ?date=', () => {
  it('2026-11-30: everything locked', () => {
    expect(states('2026-11-30').every((s) => s === 'locked')).toBe(true);
  });
  it('2026-12-01: day 1 active, rest locked', () => {
    const s = states('2026-12-01');
    expect(s[0]).toBe('active');
    expect(s.slice(1).every((x) => x === 'locked')).toBe(true);
  });
  it('2026-12-07: 1-6 missed, 7 active, 8-26 locked', () => {
    const s = states('2026-12-07');
    expect(s.slice(0, 6).every((x) => x === 'missed')).toBe(true);
    expect(s[6]).toBe('active');
    expect(s.slice(7).every((x) => x === 'locked')).toBe(true);
  });
  it('2026-12-26: 1-25 missed, 26 active', () => {
    const s = states('2026-12-26');
    expect(s.slice(0, 25).every((x) => x === 'missed')).toBe(true);
    expect(s[25]).toBe('active');
  });
  it('2026-12-27: everything missed', () => {
    expect(states('2026-12-27').every((s) => s === 'missed')).toBe(true);
  });
  it('day switches at local midnight', () => {
    expect(campaignDay(at('2026-12-07T23:59:59'))).toBe(7);
    expect(campaignDay(at('2026-12-08T00:00:00'))).toBe(8);
    expect(campaignDay(at('2026-12-07T00:00:00'))).toBe(7);
  });
  it('ignores a bad date', () => {
    const real = new Date(2026, 5, 1);
    expect(parseNow('?date=nope', real)).toBe(real);
    expect(parseNow('?date=2026-02-31', real)).toBe(real);
    expect(parseNow('', real)).toBe(real);
  });
  it('allowOverride=false ignores ?date= (client build)', () => {
    const real = new Date(2026, 11, 5, 12);
    expect(parseNow('?date=2026-12-24', real, false)).toBe(real);
    expect(parseNow('?date=2026-12-24T10:00', real, false)).toBe(real);
  });
  it('relative tags', () => {
    expect(relativeKey(5, 7)).toBe('missed');
    expect(relativeKey(6, 7)).toBe('yesterday');
    expect(relativeKey(7, 7)).toBe('today');
    expect(relativeKey(8, 7)).toBe('tomorrow');
    expect(relativeKey(9, 7)).toBe('in_two_days');
    expect(relativeKey(12, 7)).toBe('locked');
  });
});

describe('route window', () => {
  it('desktop: today in the middle', () => {
    expect(visibleDays(7, 5)).toEqual({ days: [5, 6, 7, 8, 9], todayIndex: 2 });
  });
  it('desktop: clamps at the start', () => {
    expect(visibleDays(1, 5)).toEqual({ days: [1, 2, 3, 4, 5], todayIndex: 0 });
    expect(visibleDays(2, 5)).toEqual({ days: [1, 2, 3, 4, 5], todayIndex: 1 });
  });
  it('desktop: clamps at the end', () => {
    expect(visibleDays(26, 5)).toEqual({ days: [22, 23, 24, 25, 26], todayIndex: 4 });
    expect(visibleDays(25, 5)).toEqual({ days: [22, 23, 24, 25, 26], todayIndex: 3 });
  });
  it('mobile: 3 days, clamped', () => {
    expect(visibleDays(7, 3)).toEqual({ days: [6, 7, 8], todayIndex: 1 });
    expect(visibleDays(1, 3).days).toEqual([1, 2, 3]);
    expect(visibleDays(26, 3).days).toEqual([24, 25, 26]);
  });
  it('before / after the campaign', () => {
    expect(visibleDays(0, 5)).toEqual({ days: [1, 2, 3, 4, 5], todayIndex: -1 });
    expect(visibleDays(27, 5)).toEqual({ days: [22, 23, 24, 25, 26], todayIndex: -1 });
    expect(windowStart(-30, 3)).toBe(1);
    expect(windowStart(99, 3)).toBe(24);
  });
});

describe('countdown to the next local midnight', () => {
  it('14:32:08 left at 09:27:52', () => {
    const now = at('2026-12-07T09:27:52');
    expect(formatCountdown(secondsUntil(now, nextUnlock(now)))).toBe('14:32:08');
  });
  it('one second before midnight', () => {
    const now = at('2026-12-07T23:59:59');
    expect(formatCountdown(secondsUntil(now, nextUnlock(now)))).toBe('00:00:01');
  });
  it('before the campaign it counts to 1 Dec 00:00 (hours can pass 24)', () => {
    const now = at('2026-11-30T12:00:00');
    expect(formatCountdown(secondsUntil(now, nextUnlock(now)))).toBe('12:00:00');
    const earlier = at('2026-11-20T00:00:00');
    expect(formatCountdown(secondsUntil(earlier, nextUnlock(earlier)))).toBe('264:00:00');
  });
  it('formats', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3661)).toBe('01:01:01');
  });
});

describe('browser language to market', () => {
  it.each([
    [['en-AU'], 'EN_GBP'],
    [['en-GB'], 'EN_GBP'],
    [['en'], 'EN_GBP'],
    [['en-US'], 'EN_GBP'],
    [['en-CA'], 'EN_GBP'],
    [['ro-MD'], 'EN_GBP'], // RO_MDL is off (owner 2026-11-26)
    [['fr'], 'EN_GBP'],
    [['nl-BE'], 'NL'],
    [['de-AT'], 'DE'],
    [['pl-PL'], 'PL'],
    [['pl'], 'PL'],
    [['xx'], 'EN_GBP'],
    [['fr', 'nl'], 'NL'],
    [[], 'EN_GBP'],
  ])('%j -> %s', (langs, expected) => {
    expect(marketFromLanguages(langs)).toBe(expected);
  });
});

describe('date formatting matches the sheet samples (Dec 7 2026)', () => {
  const d = new Date(2026, 11, 7);
  it.each([
    ['EN', 'DEC 7'], ['RU', '7 ДЕК.'], ['FR_CA', '7 DÉC.'], ['DE', '7. DEZ.'], ['BG', '7 ДЕК.'], ['NL', '7 DEC.'],
    ['RO_MD', '7 DEC.'], ['TR', '7 ARA.'], ['NO', '7. DES.'], ['IT', '7 DIC.'], ['DA', '7. DEC.'], ['SV', '7 DEC.'],
    ['PL', '7 GRU'],
  ])('%s -> %s', (lang, expected) => {
    expect(shortDate(d, lang).replace(/ /g, ' ')).toBe(expected);
  });
  it('long dates', () => {
    expect(longDate(new Date(2026, 11, 8), 'EN')).toBe('8 December');
    expect(longDate(new Date(2026, 11, 8), 'DE')).toBe('8. Dezember');
    expect(longDate(new Date(2026, 11, 8), 'PL')).toBe('8 grudnia');
  });
  it('fills templates', () => {
    expect(fill('TOMORROW · {date}', { date: 'DEC 8' })).toBe('TOMORROW · DEC 8');
    expect(fill('Unlocks in {time}', { time: '01:02:03' })).toBe('Unlocks in 01:02:03');
  });
});
