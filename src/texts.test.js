import { describe, expect, it } from 'vitest';
import markets from '../data/markets.json';

const uiFiles = import.meta.glob('../data/ui/*.json', { eager: true, import: 'default' });
const cardFiles = import.meta.glob('../data/cards/*.json', { eager: true, import: 'default' });

// Every UI key the page renders (src/render/*.js). Keep in step with the renderers.
const RENDERED_KEYS = [
  'brand', 'campaign_dates', 'campaign_title', 'subtitle',
  'today', 'yesterday', 'todays_stop', 'tomorrow', 'in_two_days', 'missed', 'open_gift', 'unlocks_in',
  'locked', 'gift_expired', 'legend_available', 'legend_missed', 'legend_locked',
  'how_it_works', 'step1_title', 'step1_body', 'step2_title', 'step2_body', 'step3_title', 'responsible',
];
// Jackpot-origin or tracking-only keys: they must not exist any more.
const REMOVED_KEYS = [
  'step3_body', 'campaign_terms', 'day_of', 'gifts_collected', 'next_gift', 'gift_timer', 'campaign_ended',
  'bonus_credited', '26 DAYS', 'be_gamble_aware', 'legend_collected', 'extras',
];
const FORBIDDEN = /collected|credited|turns green|gesammelt|gutgeschrieben|verzameld|bijgeschreven|colectat|creditat|wird grün|groen|verde|has ended|travelling|Deposit before|23:59|gifts collected/i;

describe('UI texts', () => {
  for (const m of markets) {
    const ui = uiFiles[`../data/ui/${m.uiLang}.json`];
    it(`${m.id}: has every key the page renders`, () => {
      for (const k of RENDERED_KEYS) expect(ui.strings[k], `${m.id} ${k}`).toBeTruthy();
    });
    it(`${m.id}: no Jackpot-only keys`, () => {
      for (const k of REMOVED_KEYS) expect(ui.strings, k).not.toHaveProperty(k);
      expect(ui).not.toHaveProperty('extras');
    });
    it(`${m.id}: no tracking / Jackpot wording in any text`, () => {
      const texts = [...Object.values(ui.strings), ...Object.values(ui.locations)];
      for (const t of texts) expect(t, t).not.toMatch(FORBIDDEN);
      for (const d of cardFiles[`../data/cards/${m.id}.json`].days) {
        for (const l of Object.values(d.raw).flat()) expect(l, `${m.id} day ${d.day}`).not.toMatch(FORBIDDEN);
      }
    });
    it(`${m.id}: step 3 has a title and no body; legend has no "Collected" item`, () => {
      expect(ui.strings.step3_title).toBeTruthy();
            expect(Object.keys(ui.strings).filter((k) => k.startsWith('legend_')).sort()).toEqual(['legend_available', 'legend_locked', 'legend_missed']);
    });
    it(`${m.id}: campaign dates say 1–26 and 26 gifts`, () => {
      expect(ui.strings.campaign_dates).toMatch(/26.*26/);
      expect(ui.strings.step1_body).toMatch(/26/);
    });
  }
});
