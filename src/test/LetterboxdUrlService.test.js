import { describe, it, expect, vi, afterEach } from 'vitest'
import LetterboxdUrlService from '@/services/LetterboxdUrlService'

describe('LetterboxdUrlService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('todayLocalISODate', () => {
    it('formats local date as YYYY-MM-DD with zero padding', () => {
      // Local time, not UTC: 2026-03-05 in the system timezone.
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 2, 5, 9, 0, 0)) // month is 0-indexed → March
      expect(LetterboxdUrlService.todayLocalISODate()).toBe('2026-03-05')
    })

    it('uses local components, not UTC (no off-by-one late at night)', () => {
      // 11:30pm local on the 18th. toISOString() in a +offset TZ could roll to
      // the 19th; our helper must still report the local day, 18.
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 5, 18, 23, 30, 0))
      expect(LetterboxdUrlService.todayLocalISODate()).toBe('2026-06-18')
    })
  })

  describe('generateUrls log deep link', () => {
    it("includes today's date so logs are not recorded dateless", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 5, 18, 12, 0, 0))
      const urls = LetterboxdUrlService.generateUrls('Heat', 1995)
      expect(urls.appLogUrl).toContain('letterboxd://x-callback-url/log?')
      expect(urls.appLogUrl).toContain('name=Heat')
      expect(urls.appLogUrl).toContain('date=2026-06-18')
    })

    it('still URL-encodes the title alongside the date', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
      const urls = LetterboxdUrlService.generateUrls('Léon: The Professional', 1994)
      expect(urls.appLogUrl).toContain(encodeURIComponent('Léon: The Professional'))
      expect(urls.appLogUrl).toContain('date=2026-01-01')
    })

    it('returns null for a missing title', () => {
      expect(LetterboxdUrlService.generateUrls('', 1995)).toBeNull()
      expect(LetterboxdUrlService.generateUrls(null, 1995)).toBeNull()
    })
  })

  describe('normalizedRatingToStars (0–10 → 0.5–5 stars)', () => {
    it('halves the 0–10 normalized rating onto Letterboxd 0.5 steps', () => {
      expect(LetterboxdUrlService.normalizedRatingToStars(10)).toBe(5)
      expect(LetterboxdUrlService.normalizedRatingToStars(9)).toBe(4.5)
      expect(LetterboxdUrlService.normalizedRatingToStars(7)).toBe(3.5)
      expect(LetterboxdUrlService.normalizedRatingToStars(1)).toBe(0.5)
    })

    it('treats 0 / missing / non-numeric as no rating (null)', () => {
      expect(LetterboxdUrlService.normalizedRatingToStars(0)).toBeNull()
      expect(LetterboxdUrlService.normalizedRatingToStars(null)).toBeNull()
      expect(LetterboxdUrlService.normalizedRatingToStars(undefined)).toBeNull()
      expect(LetterboxdUrlService.normalizedRatingToStars('not a number')).toBeNull()
    })

    it('clamps above 5 and snaps odd decimals to the nearest half', () => {
      expect(LetterboxdUrlService.normalizedRatingToStars(12)).toBe(5)
      expect(LetterboxdUrlService.normalizedRatingToStars(8.4)).toBe(4) // 4.2 → 4.0
    })
  })

  describe('generateUrls rating passthrough', () => {
    it('adds &rating to the log link when a star rating is present', () => {
      const urls = LetterboxdUrlService.generateUrls('Heat', 1995, { normalizedRating: 9 })
      expect(urls.appLogUrl).toContain('rating=4.5')
    })

    it('omits rating entirely when there is no rating', () => {
      const urls = LetterboxdUrlService.generateUrls('Heat', 1995, { normalizedRating: 0 })
      expect(urls.appLogUrl).not.toContain('rating=')
    })

    it('still has date and name when no options are passed', () => {
      const urls = LetterboxdUrlService.generateUrls('Heat', 1995)
      expect(urls.appLogUrl).toContain('name=Heat')
      expect(urls.appLogUrl).toContain('date=')
      expect(urls.appLogUrl).not.toContain('rating=')
    })
  })
})

// Bug report: "When I click the letterbox button ... it should have the date
// automatically filled in in the page. Even if I didn't watch it today and also
// even if I have watched it multiple times."
describe('logged viewing date', () => {
  const logDateFrom = (options) => {
    const urls = LetterboxdUrlService.generateUrls('Fight Club', 1999, options)
    return new URL(urls.appLogUrl.replace('letterboxd://', 'https://')).searchParams.get('date')
  }

  it('uses the date the movie was actually watched, not today', () => {
    // Local noon so the assertion can't be flipped by the runner's timezone.
    const watched = new Date(2021, 4, 17, 12, 0, 0).getTime()
    expect(logDateFrom({ viewingDate: watched })).toBe('2021-05-17')
  })

  it('accepts a Date as well as a timestamp', () => {
    expect(logDateFrom({ viewingDate: new Date(2019, 0, 3, 12) })).toBe('2019-01-03')
  })

  it('falls back to today when the rating has no usable date', () => {
    const today = LetterboxdUrlService.todayLocalISODate()

    expect(logDateFrom({})).toBe(today)
    expect(logDateFrom({ viewingDate: null })).toBe(today)
    expect(logDateFrom({ viewingDate: 'not a date' })).toBe(today)
  })

  it('reports the local day for a late-evening viewing, not the UTC one', () => {
    // toISOString() would roll this into the next day in any western timezone —
    // the same trap todayLocalISODate already exists to avoid.
    const lateNight = new Date(2022, 10, 8, 23, 30, 0)
    expect(logDateFrom({ viewingDate: lateNight.getTime() })).toBe('2022-11-08')
  })
})

describe('toLocalISODate', () => {
  it('rejects anything that is not a real date', () => {
    expect(LetterboxdUrlService.toLocalISODate(null)).toBeNull()
    expect(LetterboxdUrlService.toLocalISODate(undefined)).toBeNull()
    expect(LetterboxdUrlService.toLocalISODate('')).toBeNull()
    expect(LetterboxdUrlService.toLocalISODate('nope')).toBeNull()
    expect(LetterboxdUrlService.toLocalISODate(NaN)).toBeNull()
  })

  it('zero-pads month and day', () => {
    expect(LetterboxdUrlService.toLocalISODate(new Date(2020, 0, 5, 12))).toBe('2020-01-05')
  })
})
