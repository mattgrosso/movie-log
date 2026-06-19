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
