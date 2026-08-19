import {
  describe, it, expect, vi
} from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import PersonalAwardsModal from '@/components/PersonalAwardsModal.vue';
import { awardsPromptCopy, awardsPromptReason } from '../assets/javascript/personalAwards.js';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry?.ratings?.[0]?.calculatedTotal ?? 0 })),
  getAllRatings: vi.fn(() => [])
}));
vi.mock('@/services/ErrorLogService.js', () => ({ default: { error: vi.fn() } }));

// Bug report, 2026-08-19: "The language for the prompt that tells me to work on
// a year for my personal awards needs to be specific to if I am doing those
// awards for the first time because I've just rated my 10th movie or if I'm
// doing those awards because I've just rated an additional movie."
describe('awardsPromptReason', () => {
  it('is first-time when the year has no awards at all', () => {
    expect(awardsPromptReason(undefined)).toBe('first-time');
    expect(awardsPromptReason(null)).toBe('first-time');
  });

  it('is in-progress when awards exist but were never completed', () => {
    expect(awardsPromptReason({ categories: {} })).toBe('in-progress');
    expect(awardsPromptReason({ completed: false })).toBe('in-progress');
  });

  it('is new-films when the year was completed', () => {
    expect(awardsPromptReason({ completed: true, lastUpdated: 1 })).toBe('new-films');
  });
});

describe('awardsPromptCopy', () => {
  it('says the year is ready the first time round', () => {
    const copy = awardsPromptCopy(2021, null);

    expect(copy.text).toBe('2021 has enough films to hand out awards.');
    expect(copy.action).toBe('Pick your winners');
  });

  it('says you are part-way through a year you already started', () => {
    const copy = awardsPromptCopy(2021, { categories: { bestPicture: {} } });

    // The wrongness Matt reported, one step along: telling someone a year
    // "has enough films" when they are halfway through picking its winners.
    expect(copy.text).toBe('Your 2021 awards are part-way done.');
    expect(copy.text).not.toContain('has enough films');
    expect(copy.action).toBe('Finish picking');
  });

  it('says what actually changed when a finished year comes back round', () => {
    const copy = awardsPromptCopy(2021, { completed: true, lastUpdated: 1 }, 3);

    expect(copy.text).toBe("You've rated 3 more films from 2021 since handing out its awards.");
    expect(copy.action).toBe('Take another look');
  });

  it('counts a single new film in the singular', () => {
    const copy = awardsPromptCopy(2021, { completed: true, lastUpdated: 1 }, 1);

    expect(copy.text).toBe("You've rated another film from 2021 since handing out its awards.");
  });

  it('does not print "0 more films" if the count is unavailable', () => {
    const copy = awardsPromptCopy(2021, { completed: true, lastUpdated: 1 }, 0);

    expect(copy.text).not.toContain('0 more films');
    expect(copy.text).toBe("You've rated more films from 2021 since handing out its awards.");
  });

  it('gives each situation genuinely different wording', () => {
    const texts = [
      awardsPromptCopy(2021, null).text,
      awardsPromptCopy(2021, { completed: false }).text,
      awardsPromptCopy(2021, { completed: true, lastUpdated: 1 }, 2).text
    ];

    expect(new Set(texts).size).toBe(3);
  });
});

// The pure copy above can be perfect while the template still renders the old
// fixed sentence, so this mounts the real prompt and reads what is on screen.
describe('the prompt card itself', () => {
  const entry = (id, year, ratedAt) => ({
    movie: {
      id,
      title: `Film ${id}`,
      release_date: `${year}-06-15`,
      poster_path: `/${id}.jpg`,
      backdrop_path: null,
      crew: [],
      cast: [],
      flatKeywords: []
    },
    ratings: [{ calculatedTotal: 8, date: ratedAt }]
  });

  // Enough films for the year to be eligible at the default threshold.
  const library = Array.from({ length: 12 }, (_, i) => entry(i + 1, 2015, 1700000000000));

  const mountPrompt = (personalAwards = {}) => mount(PersonalAwardsModal, {
    props: {
      allEntriesWithFlatKeywordsAdded: library,
      autoOpen: false,
      pageMode: false,
      personalAwardName: 'Oscar',
      awardNameWithThe: 'the Oscars',
      awardNameSingular: 'Oscar'
    },
    global: {
      mocks: {
        $store: reactive({
          state: { settings: { personalAwards }, settingsLoaded: true, databaseTopKey: 'k', weights: [] },
          dispatch: vi.fn(),
          commit: vi.fn()
        })
      },
      stubs: { Modal: true, Teleport: true }
    }
  });

  it('renders the first-time wording for a year never awarded', () => {
    const wrapper = mountPrompt({});

    expect(wrapper.find('.prompt-text').text()).toBe('2015 has enough films to hand out awards.');
    expect(wrapper.find('.prompt-action').text()).toBe('Pick your winners');
  });

  it('renders the part-way wording for a year already started', () => {
    const wrapper = mountPrompt({
      2015: { completed: false, categories: { bestPicture: { nominees: [], winner: null } } }
    });

    expect(wrapper.find('.prompt-text').text()).toBe('Your 2015 awards are part-way done.');
    expect(wrapper.find('.prompt-action').text()).toBe('Finish picking');
  });
});
