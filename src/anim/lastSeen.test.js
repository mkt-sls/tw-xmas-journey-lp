import { describe, expect, it } from 'vitest';
import { LAST_SEEN_KEY, checkNewDay, unlockDecision } from './lastSeen.js';

const mem = (initial) => {
  const m = new Map(initial === undefined ? [] : [[LAST_SEEN_KEY, String(initial)]]);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
};

describe('unlockDecision', () => {
  it('never plays on the very first visit but stores today', () => {
    expect(unlockDecision(null, 7)).toEqual({ play: false, store: true });
    expect(unlockDecision(NaN, 7)).toEqual({ play: false, store: true });
  });
  it('plays when a stored day is older than today', () => {
    expect(unlockDecision(6, 7)).toEqual({ play: true, store: true });
    expect(unlockDecision(1, 20)).toEqual({ play: true, store: true });
  });
  it('does nothing on the same day', () => {
    expect(unlockDecision(7, 7)).toEqual({ play: false, store: false });
  });
  it('does not play when the stored day is in the future (QA clock moved back) but resets it', () => {
    expect(unlockDecision(10, 7)).toEqual({ play: false, store: true });
  });
  it('plays only inside the campaign', () => {
    expect(unlockDecision(-3, 0)).toEqual({ play: false, store: true }); // before
    expect(unlockDecision(0, 1)).toEqual({ play: true, store: true }); // first day
    expect(unlockDecision(26, 27)).toEqual({ play: false, store: true }); // after
  });
});

describe('checkNewDay', () => {
  it('first visit: no play, stores today', () => {
    const s = mem();
    expect(checkNewDay(7, s)).toBe(false);
    expect(s.m.get(LAST_SEEN_KEY)).toBe('7');
  });
  it('next day: plays once, then not again', () => {
    const s = mem(6);
    expect(checkNewDay(7, s)).toBe(true);
    expect(s.m.get(LAST_SEEN_KEY)).toBe('7');
    expect(checkNewDay(7, s)).toBe(false);
  });
  it('ignores garbage values like a first visit', () => {
    const s = mem('abc');
    expect(checkNewDay(7, s)).toBe(false);
    expect(s.m.get(LAST_SEEN_KEY)).toBe('7');
  });
  it('survives storage that throws', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(checkNewDay(7, bad)).toBe(false);
    expect(checkNewDay(7, null)).toBe(false);
  });
});
