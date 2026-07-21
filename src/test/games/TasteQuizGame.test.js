import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TasteQuizGame from '@/components/games/TasteQuizGame.vue';

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.movie.id }))
}));

function entry (id) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: id }],
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: '/p.jpg',
      release_date: `${2000 + id}-01-01`,
      crew: [{ name: `Director ${id}`, job: 'Director' }],
      genres: [{ name: `Genre ${id}` }],
      cast: [{ name: `Actor ${id}` }]
    }
  };
}

async function factory (movieCount) {
  const wrapper = mount(TasteQuizGame, {
    global: {
      mocks: {
        $store: { getters: { allMediaAsArray: Array.from({ length: movieCount }, (_, i) => entry(i)) } },
        $router: { push: vi.fn() }
      }
    }
  });
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('TasteQuizGame', () => {
  it('shows a gate message when there is not enough data for any question', async () => {
    const wrapper = await factory(2);
    expect(wrapper.vm.status).toBe('empty');
    expect(wrapper.find('.not-enough-movies').exists()).toBe(true);
  });

  it('generates questions and renders the first one on mount', async () => {
    const wrapper = await factory(10);
    expect(wrapper.vm.questions.length).toBeGreaterThan(0);
    expect(wrapper.find('.question-prompt').exists()).toBe(true);
    expect(wrapper.findAll('.option-button').length).toBe(4);
  });

  it('selecting an option locks in the answer, scores it, and shows Next', async () => {
    const wrapper = await factory(10);
    const correctIndex = wrapper.vm.currentQuestion.options.findIndex((o) => o.isCorrect);
    await wrapper.findAll('.option-button')[correctIndex].trigger('click');

    expect(wrapper.vm.answered).toBe(true);
    expect(wrapper.vm.score).toBe(1);
    expect(wrapper.findAll('.option-button')[correctIndex].classes()).toContain('correct');
    expect(wrapper.find('.btn-warning').exists()).toBe(true);
  });

  it('walking through every question ends on a results screen with the right score', async () => {
    const wrapper = await factory(10);
    const totalQuestions = wrapper.vm.questions.length;

    for (let i = 0; i < totalQuestions; i++) {
      const correctIndex = wrapper.vm.currentQuestion.options.findIndex((o) => o.isCorrect);
      await wrapper.findAll('.option-button')[correctIndex].trigger('click');
      await wrapper.find('.btn-warning').trigger('click');
    }

    expect(wrapper.vm.status).toBe('finished');
    expect(wrapper.find('.results-score').text()).toBe(`${totalQuestions} / ${totalQuestions}`);
  });

  it('"Play Again" from the results screen generates a fresh quiz', async () => {
    const wrapper = await factory(10);
    const totalQuestions = wrapper.vm.questions.length;
    for (let i = 0; i < totalQuestions; i++) {
      const correctIndex = wrapper.vm.currentQuestion.options.findIndex((o) => o.isCorrect);
      await wrapper.findAll('.option-button')[correctIndex].trigger('click');
      await wrapper.find('.btn-warning').trigger('click');
    }
    await wrapper.find('.results button').trigger('click');
    expect(wrapper.vm.status).toBe('playing');
    expect(wrapper.vm.currentIndex).toBe(0);
    expect(wrapper.vm.score).toBe(0);
  });
});
