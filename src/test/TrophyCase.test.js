import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import TrophyCase from '@/components/TrophyCase.vue';

// TrophyCase computes an upsets shelf from ratings now — mock GetRating so
// fixtures can carry simple calculatedTotals (the real one needs the store's
// weight getters and full criteria).
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.ratings?.[0]?.calculatedTotal }))
}));

function libraryEntry (id, title, posterPath = '/p.jpg') {
  return { dbKey: `key-${id}`, movie: { id, title, poster_path: posterPath } };
}

function mountTrophyCase (personalAwards, library = [], allAcademyAwards = []) {
  const pushSpy = vi.fn();
  const commitSpy = vi.fn();
  const wrapper = mount(TrophyCase, {
    global: {
      mocks: {
        $store: {
          state: { settings: { personalAwards }, allAcademyAwards },
          getters: { allMediaAsArray: library },
          commit: commitSpy
        },
        $router: { push: pushSpy }
      }
    }
  });
  return { wrapper, pushSpy, commitSpy };
}

describe('TrophyCase', () => {
  beforeEach(() => {
    // The component looks up person photos on TMDB; default to "found
    // nothing" so tests that don't care get the initials fallback rather
    // than a real network call.
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ results: [] }) }));
  });

  it('shows an empty state when there are no wins yet', () => {
    const { wrapper } = mountTrophyCase({});
    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Most Decorated');
  });

  it('groups movie-category wins by category, newest year first', () => {
    const library = [libraryEntry(1, 'Old Winner'), libraryEntry(2, 'New Winner')];
    const personalAwards = {
      2010: { categories: { bestPicture: { winner: { type: 'movie', movieId: 1 } } } },
      2020: { categories: { bestPicture: { winner: { type: 'movie', movieId: 2 } } } }
    };
    const { wrapper } = mountTrophyCase(personalAwards, library)

    expect(wrapper.vm.totalWins).toBe(2)
    expect(wrapper.vm.yearsRepresented).toBe(2)
    // Feedback: "just every winner from each of the years going back is not
    // interesting" — the flat per-category rows must NOT render anymore.
    expect(wrapper.find('.trophy-category').exists()).toBe(false)
  })

  it('expands person-category wins with their name and movie', () => {
    const library = [libraryEntry(5, 'A Great Film')]
    const personalAwards = {
      2019: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'A Director', movieId: 5 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)

    const win = wrapper.vm.categorizedWins.bestDirector[0]
    expect(win.expanded.name).toBe('A Director')
    expect(win.expanded.movie.title).toBe('A Great Film')
  })

  it('surfaces people who have won more than once as "Most Decorated", sorted by count', () => {
    const library = [libraryEntry(1, 'Film A'), libraryEntry(2, 'Film B'), libraryEntry(3, 'Film C')]
    const personalAwards = {
      2018: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Prolific Director', movieId: 1 } } } },
      2020: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Prolific Director', movieId: 2 } } } },
      2022: { categories: { bestActor: { winner: { type: 'person', id: 'a1', name: 'One-Timer', movieId: 3 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)

    expect(wrapper.vm.mostDecoratedPeople.map((p) => p.name)).toEqual(['Prolific Director'])
    expect(wrapper.vm.mostDecoratedPeople[0].count).toBe(2)
    expect(wrapper.text()).toContain('Most Decorated')
  })

  // Bug report: "in the trophy case I'm missing a bunch of images on that
  // top row for the top winners they just have letters for all their
  // names." mostDecoratedPeople stores whole WIN wrappers ({year, expanded})
  // in person.wins, but winnerImage reads .details/.movie off an EXPANDED
  // nominee - the template was passing the wrapper, so every lookup came
  // back undefined and the whole row fell through to the initials
  // placeholder. The pre-existing test above only checked the computed and
  // the text, which is exactly why this went unnoticed.
  it('renders the PERSON\'s own photo in Most Decorated when one was stored with the award', () => {
    const library = [libraryEntry(1, 'Film A', '/film-a.jpg'), libraryEntry(2, 'Film B', '/film-b.jpg')]
    const personalAwards = {
      2018: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Prolific Director', movieId: 1, profilePath: '/face.jpg' } } } },
      2020: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Prolific Director', movieId: 2, profilePath: '/face.jpg' } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)

    const photo = wrapper.find('.decorated-photo')
    expect(photo.element.tagName).toBe('IMG')
    expect(photo.attributes('src')).toContain('/face.jpg')
    expect(wrapper.find('.decorated-photo-placeholder').exists()).toBe(false)
  })

  // The heart of the follow-up report: "I don't wanna show Steven Spielberg
  // but then show the poster for one of his movies, that's not right."
  it('never substitutes a movie poster for a person, even when the poster is available', () => {
    const library = [libraryEntry(1, 'Film A', '/film-a.jpg'), libraryEntry(2, 'Film B', '/film-b.jpg')]
    const personalAwards = {
      2018: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Photoless Director', movieId: 1 } } } },
      2020: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Photoless Director', movieId: 2 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)

    // No stored photo and (with fetch stubbed to find nothing) no looked-up
    // one either - so the PHOTO slot shows an initial, never a poster. The
    // films' posters may appear in the mini strip below the stat — that's
    // clearly "their films", a different thing from "their picture".
    expect(wrapper.find('.decorated-photo-placeholder').exists()).toBe(true)
    expect(wrapper.find('.decorated-photo').element.tagName).not.toBe('IMG')
    const strayPosters = wrapper.findAll('img').filter((img) => !img.classes().includes('mini-poster'))
    expect(strayPosters).toHaveLength(0)
  })

  it('looks a person up on TMDB by name when no photo was stored, and uses the result', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ results: [{ profile_path: '/looked-up.jpg' }] })
    }))
    const library = [libraryEntry(1, 'Film A', '/film-a.jpg'), libraryEntry(2, 'Film B', '/film-b.jpg')]
    const personalAwards = {
      2018: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Findable Director', movieId: 1 } } } },
      2020: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Findable Director', movieId: 2 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search/person'))
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Findable Director')))
    // Two wins for the same person - looked up once, not per win.
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.decorated-photo').attributes('src')).toContain('/looked-up.jpg')
  })

  it('does not look up anyone whose photo was already stored with the award', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ results: [] }) }))
    const library = [libraryEntry(1, 'Film A')]
    const personalAwards = {
      2018: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Known Director', movieId: 1, profilePath: '/face.jpg' } } } }
    }
    mountTrophyCase(personalAwards, library)
    await flushPromises()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('a sweep card shows the movie poster and its single-year win count', () => {
    const library = [libraryEntry(7, 'Sweeper', '/sweep.jpg')]
    const personalAwards = {
      2021: {
        categories: {
          bestPicture: { winner: { type: 'movie', movieId: 7 } },
          bestDirector: { winner: { type: 'person', id: 'd', name: 'Solo Director', movieId: 7 } },
          bestEditing: { winner: { type: 'movie', movieId: 7 } }
        }
      }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)

    expect(wrapper.text()).toContain('Biggest Sweeps')
    expect(wrapper.text()).toContain('3 wins · 2021')
    const poster = wrapper.find('.decorated-poster')
    expect(poster.element.tagName).toBe('IMG')
    expect(poster.attributes('src')).toContain('/sweep.jpg')
  })

  it('does not throw when the winning movie is no longer in the library', () => {
    const personalAwards = {
      2019: { categories: { bestPicture: { winner: { type: 'movie', movieId: 999 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, [])
    expect(wrapper.vm.totalWins).toBe(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('tapping a sweep card opens that movie, and the derived shelves render together', async () => {
    const library = [libraryEntry(7, 'Clickable Film')]
    const personalAwards = {
      2019: { categories: { bestDirector: { nominees: [{ type: 'person', id: 'd', name: 'Waited', movieId: 7 }], winner: null } } },
      2021: {
        categories: {
          bestPicture: { winner: { type: 'movie', movieId: 7 } },
          bestDirector: { winner: { type: 'person', id: 'd', name: 'Waited', movieId: 7 } },
          bestEditing: { winner: { type: 'movie', movieId: 7 } }
        }
      },
      2022: { categories: { bestDirector: { winner: { type: 'person', id: 'd', name: 'Waited', movieId: 7 } } } }
    }
    const { wrapper, pushSpy } = mountTrophyCase(personalAwards, library)

    // Back-to-Back: Waited won 2021 and 2022.
    expect(wrapper.text()).toContain('Back-to-Back')
    expect(wrapper.text()).toContain('2 years running')

    const sweepSection = wrapper.findAll('.most-decorated').find((section) => section.text().includes('Biggest Sweeps'))
    await sweepSection.find('.decorated-person').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/movie/7')
  })

  // Bug report: "When I click on an actor in the trophy case, it seems to
  // take me to one random film of theirs." Person cards now open a Home
  // search for the person; only category trophy cards (whose film is the
  // specific winning movie, not a random one) still navigate to a movie.
  it('clicking a Most Decorated person opens a Home search for their name, never a movie page', async () => {
    const library = [libraryEntry(1, 'Film A'), libraryEntry(2, 'Film B')]
    const personalAwards = {
      2018: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Prolific Director', movieId: 1 } } } },
      2020: { categories: { bestDirector: { winner: { type: 'person', id: 'd1', name: 'Prolific Director', movieId: 2 } } } }
    }
    const { wrapper, pushSpy, commitSpy } = mountTrophyCase(personalAwards, library)

    await wrapper.find('.decorated-person').trigger('click')

    expect(commitSpy).toHaveBeenCalledWith('setHomePageSearchValue', 'Prolific Director')
    expect(commitSpy).toHaveBeenCalledWith('setHomePagePromoteGroup', 'cast')
    expect(commitSpy).toHaveBeenCalledWith('setHomePageNavigationIntent', 'search')
    expect(pushSpy).toHaveBeenCalledWith('/')
    expect(pushSpy.mock.calls.every(([path]) => !String(path).startsWith('/movie/'))).toBe(true)
  })

  it('"Robbed, By Your Own Ratings" flags a category where your top-rated nominee lost', () => {
    const library = [
      { ...libraryEntry(1, 'The Winner'), ratings: [{ calculatedTotal: 7.0 }] },
      { ...libraryEntry(2, 'The Robbed'), ratings: [{ calculatedTotal: 9.2 }] }
    ]
    const personalAwards = {
      2020: {
        categories: {
          bestPicture: {
            nominees: [{ type: 'movie', movieId: 1 }, { type: 'movie', movieId: 2 }],
            winner: { type: 'movie', movieId: 1 }
          }
        }
      }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library)

    expect(wrapper.text()).toContain('Robbed, By Your Own Ratings')
    const card = wrapper.find('.versus-card')
    expect(card.text()).toContain('The Robbed')
    expect(card.text()).toContain('robbed · 9.2')
    expect(card.text()).toContain('your pick · 7.0')
    // Posters over text: both sides render as poster images.
    expect(card.findAll('.versus-poster').filter((el) => el.element.tagName === 'IMG')).toHaveLength(2)
  })

  it('"You vs. the Academy" scores your winners against the real ceremony and lists the clashes', () => {
    const library = [libraryEntry(597, 'Titanic'), libraryEntry(2567, 'As Good as It Gets')]
    const personalAwards = {
      1997: {
        categories: {
          bestPicture: { winner: { type: 'movie', movieId: 2567 } } // you went your own way
        }
      },
      1998: { categories: { bestPicture: { winner: { type: 'movie', movieId: 597 } } } } // no academy data that year in fixture
    }
    const academy = [
      { year: 1997, category: 'Best Picture', tmdb: '597', isWinner: true, title: 'Titanic', names: [] },
      { year: 1997, category: 'Best Picture', tmdb: '2567', isWinner: false, title: 'As Good as It Gets', names: [] }
    ]
    const { wrapper } = mountTrophyCase(personalAwards, library, academy)

    expect(wrapper.text()).toContain('You vs. the Academy')
    expect(wrapper.text()).toContain('0% of the time')
    expect(wrapper.text()).toContain('(0 of 1 shared categories)')
    const clash = wrapper.findAll('.versus-card').find((card) => card.text().includes('Academy'))
    expect(clash.text()).toContain('As Good as It Gets')
    expect(clash.text()).toContain('Titanic')
    expect(clash.text()).toContain('You')
  })

  it('the Academy section hides itself entirely when the dataset is absent', () => {
    const library = [libraryEntry(597, 'Titanic')]
    const personalAwards = {
      1997: { categories: { bestPicture: { winner: { type: 'movie', movieId: 597 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, library, [])

    expect(wrapper.text()).not.toContain('You vs. the Academy')
  })

  it('returnHome navigates home', () => {
    const { wrapper, pushSpy } = mountTrophyCase({})
    wrapper.vm.returnHome()
    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  // User feedback: this page going headerless made it the odd one out —
  // every other screen keeps the header space (custom art or whatever
  // banner was up on arrival).
  it('never hides the app header', () => {
    const { wrapper, commitSpy } = mountTrophyCase({})
    expect(commitSpy).not.toHaveBeenCalledWith('setShowHeader', false)
    wrapper.unmount()
    expect(commitSpy).not.toHaveBeenCalledWith('setShowHeader', expect.anything())
  })

  // User request: "movies with the most wins, movies with the most
  // nominations... people with the most nominations."
  describe('leaderboards', () => {
    const library = [libraryEntry(1, 'Sweeper', '/sweeper.jpg'), libraryEntry(2, 'Runner Up', '/runner.jpg')]
    // Sweeper wins Picture + Director + Actor; Runner Up is only nominated.
    const personalAwards = {
      2020: {
        categories: {
          bestPicture: {
            nominees: [{ type: 'movie', movieId: 1 }, { type: 'movie', movieId: 2 }],
            winner: { type: 'movie', movieId: 1 }
          },
          bestDirector: {
            nominees: [{ type: 'person', id: 'd1', name: 'Sweep Director', movieId: 1 }],
            winner: { type: 'person', id: 'd1', name: 'Sweep Director', movieId: 1 }
          },
          bestActor: {
            nominees: [
              { type: 'person', id: 'a1', name: 'Sweep Star', movieId: 1 },
              { type: 'person', id: 'a2', name: 'Nominated Only', movieId: 2 }
            ],
            winner: { type: 'person', id: 'a1', name: 'Sweep Star', movieId: 1 }
          },
          bestEditing: {
            nominees: [{ type: 'movie', movieId: 2 }],
            winner: null
          }
        }
      },
      2021: {
        categories: {
          bestActor: {
            nominees: [{ type: 'person', id: 'a2', name: 'Nominated Only', movieId: 2 }],
            winner: null
          }
        }
      }
    }

    it("counts a person's award toward their film, so a sweep tops Most Awarded Movies", () => {
      const { wrapper } = mountTrophyCase(personalAwards, library)

      expect(wrapper.vm.mostAwardedMovies[0]).toMatchObject({ movieId: 1, count: 3 })
      expect(wrapper.text()).toContain('Most Awarded Movies')
      expect(wrapper.text()).toContain('3 wins')
    })

    it('ranks Most Nominated Movies, counting nominations that never won', () => {
      const { wrapper } = mountTrophyCase(personalAwards, library)

      const ranked = wrapper.vm.mostNominatedMovies
      // Sweeper: Picture + Director + Actor = 3. Runner Up: Picture + Editing + 2x Actor = 4.
      expect(ranked[0]).toMatchObject({ movieId: 2, count: 4 })
      expect(ranked[1]).toMatchObject({ movieId: 1, count: 3 })
      expect(wrapper.text()).toContain('Most Nominated Movies')
    })

    it('ranks Most Nominated People across years and categories', () => {
      const { wrapper } = mountTrophyCase(personalAwards, library)

      expect(wrapper.vm.mostNominatedPeople[0]).toMatchObject({ name: 'Nominated Only', count: 2 })
      expect(wrapper.text()).toContain('Most Nominated People')
    })

    // User request: "the ability to see who has the most nominations
    // without a win."
    it('shows Always the Bridesmaid: repeat nominees who have never won anything', () => {
      const { wrapper } = mountTrophyCase(personalAwards, library)

      expect(wrapper.vm.mostNominatedNeverWon.map((p) => p.name)).toEqual(['Nominated Only'])
      expect(wrapper.text()).toContain('Always the Bridesmaid')
      expect(wrapper.text()).toContain('2 nominations, no wins')
    })

    it('hides Always the Bridesmaid when every repeat nominee has won something', () => {
      const winnersOnly = {
        2020: { categories: { bestActor: { nominees: [{ type: 'person', id: 'a1', name: 'Sweep Star', movieId: 1 }], winner: { type: 'person', id: 'a1', name: 'Sweep Star', movieId: 1 } } } },
        2021: { categories: { bestActor: { nominees: [{ type: 'person', id: 'a1', name: 'Sweep Star', movieId: 2 }], winner: { type: 'person', id: 'a1', name: 'Sweep Star', movieId: 2 } } } }
      }
      const { wrapper } = mountTrophyCase(winnersOnly, library)

      expect(wrapper.vm.mostNominatedNeverWon).toHaveLength(0)
      expect(wrapper.text()).not.toContain('Always the Bridesmaid')
    })

    it('clicking a Bridesmaid card opens a Home search for that person', async () => {
      const { wrapper, pushSpy, commitSpy } = mountTrophyCase(personalAwards, library)
      const bridesmaidSection = wrapper.findAll('.most-decorated').find((section) => section.text().includes('Always the Bridesmaid'))

      await bridesmaidSection.find('.decorated-person').trigger('click')

      expect(commitSpy).toHaveBeenCalledWith('setHomePageSearchValue', 'Nominated Only')
      expect(pushSpy).toHaveBeenCalledWith('/')
    })

    it('renders posters for the movie leaderboards and links to the movie', async () => {
      const { wrapper, pushSpy } = mountTrophyCase(personalAwards, library)

      const poster = wrapper.find('.decorated-poster')
      expect(poster.element.tagName).toBe('IMG')
      expect(poster.attributes('src')).toContain('/sweeper.jpg')

      await poster.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/movie/1')
    })

    it('hides every leaderboard when nothing repeats, rather than showing empty shelves', () => {
      const sparse = {
        2020: { categories: { bestPicture: { nominees: [{ type: 'movie', movieId: 1 }], winner: { type: 'movie', movieId: 1 } } } }
      }
      const { wrapper } = mountTrophyCase(sparse, library)

      expect(wrapper.vm.mostAwardedMovies).toHaveLength(0)
      expect(wrapper.vm.mostNominatedMovies).toHaveLength(0)
      expect(wrapper.vm.mostNominatedPeople).toHaveLength(0)
      expect(wrapper.text()).not.toContain('Most Awarded Movies')
      expect(wrapper.text()).not.toContain('Most Nominated')
    })

    it('looks up photos for people who were only ever nominated, never a winner', async () => {
      global.fetch = vi.fn(() => Promise.resolve({
        json: () => Promise.resolve({ results: [{ profile_path: '/nominee-face.jpg' }] })
      }))
      mountTrophyCase(personalAwards, library)
      await flushPromises()

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Nominated Only')))
    })
  })
})
