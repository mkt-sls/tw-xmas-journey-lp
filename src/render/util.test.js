import { describe, expect, it } from 'vitest';
import { nb } from './util.js';

const N = ' ';
describe('nb: numbers never break across lines', () => {
  it('keeps digit groups and currency together', () => {
    expect(nb('60% UPP TILL 6 000 SEK')).toBe(`60% UPP TILL 6${N}000${N}SEK`);
    expect(nb('60% UP TO 600 GBP')).toBe(`60% UP TO 600${N}GBP`);
    expect(nb('DE 99% BIS ZU 999 €')).toBe(`DE 99% BIS ZU 999${N}€`);
  });
  it('keeps percent, counts, dates and French hours together', () => {
    expect(nb('60 % JUSQU’À 950 CAD')).toBe(`60${N}% JUSQU’À 950${N}CAD`);
    expect(nb('25 FREE SPINS')).toBe(`25${N}FREE SPINS`);
    expect(nb('Valid until: 23:59, 26 Dec')).toBe(`Valid until: 23:59, 26${N}Dec`);
    expect(nb('Valable jusqu’au 26 déc., 23 h 59')).toBe(`Valable jusqu’au 26${N}déc., 23${N}h${N}59`);
  });
  it('joins number ranges across the en dash', () => {
    expect(nb('1–26 DECEMBER')).toBe('1⁠–⁠26 DECEMBER');
  });
  it('leaves words, "x25" and separators alone', () => {
    expect(nb('Wagering: x25')).toBe('Wagering: x25');
    expect(nb('DAY 26 · 26 DECEMBER')).toBe(`DAY 26 · 26${N}DECEMBER`);
  });
});
