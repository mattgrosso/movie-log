import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TrophyCase from '@/components/TrophyCase.vue';

function libraryEntry (id, title, posterPath = '/p.jpg') {
  return { dbKey: `key-${id}`, movie: { id, title, poster_path: posterPath } };
}

function mountTrophyCase (personalAwards, library = []) {
  const pushSpy = vi.fn();
  const commitSpy = vi.fn();
  const wrapper = mount(TrophyCase, {
    global: {
      mocks: {
        $store: {
          state: { settings: { personalAwards } },
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

    expect(wrapper.vm.categorizedWins.bestPicture.map((w) => w.year)).toEqual([2020, 2010])
    expect(wrapper.vm.totalWins).toBe(2)
    expect(wrapper.vm.yearsRepresented).toBe(2)
    expect(wrapper.text()).toContain('New Winner')
    expect(wrapper.text()).toContain('Old Winner')
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
    expect(wrapper.text()).toContain('A Director')
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

  it('does not throw when the winning movie is no longer in the library', () => {
    const personalAwards = {
      2019: { categories: { bestPicture: { winner: { type: 'movie', movieId: 999 } } } }
    }
    const { wrapper } = mountTrophyCase(personalAwards, [])
    expect(wrapper.vm.totalWins).toBe(0)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('clicking a trophy card navigates to that movie', async () => {
    const library = [libraryEntry(7, 'Clickable Film')]
    const personalAwards = {
      2021: { categories: { bestPicture: { winner: { type: 'movie', movieId: 7 } } } }
    }
    const { wrapper, pushSpy } = mountTrophyCase(personalAwards, library)

    await wrapper.find('.trophy-card').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/movie/7')
  })

  it('returnHome shows the header again and navigates home', () => {
    const { wrapper, commitSpy, pushSpy } = mountTrophyCase({})
    wrapper.vm.returnHome()
    expect(commitSpy).toHaveBeenCalledWith('setShowHeader', true)
    expect(pushSpy).toHaveBeenCalledWith('/')
  })
})
