<template>
  <div class="taste-quiz-game">
    <BackLink label="Games" @click="$router.push('/games')"/>
    <h1 class="game-title">Taste Quiz</h1>

    <div v-if="status === 'empty'" class="not-enough-movies">
      <p>Rate a few more movies before there's enough for a quiz.</p>
    </div>

    <div v-else-if="status === 'finished'" class="results">
      <p class="results-score">{{ score }} / {{ questions.length }}</p>
      <p class="results-caption">{{ resultCaption }}</p>
      <button type="button" class="btn btn-warning" @click="newQuiz">Play Again</button>
    </div>

    <div v-else-if="currentQuestion" class="question">
      <p class="question-progress">Question {{ currentIndex + 1 }} of {{ questions.length }}</p>
      <p class="question-prompt">{{ currentQuestion.prompt }}</p>

      <div class="options">
        <button
          v-for="(option, index) in currentQuestion.options"
          :key="index"
          type="button"
          class="option-button"
          :class="optionClass(option, index)"
          :disabled="answered"
          @click="selectOption(index)"
        >
          {{ option.label }}
        </button>
      </div>

      <button v-if="answered" type="button" class="btn btn-warning mt-3" @click="next">
        {{ currentIndex + 1 < questions.length ? 'Next' : 'See Results' }}
      </button>
    </div>
  </div>
</template>

<script>
import BackLink from './BackLink.vue';
import gameDataMixin from '../../mixins/gameData.js';
import { generateQuizQuestions } from '../../assets/javascript/games/quizGenerator.js';

export default {
  name: 'TasteQuizGame',
  components: { BackLink },
  mixins: [gameDataMixin],
  data () {
    return {
      questions: [],
      currentIndex: 0,
      score: 0,
      selectedIndex: null,
      answered: false,
      status: 'playing'
    };
  },
  computed: {
    currentQuestion () {
      return this.questions[this.currentIndex] || null;
    },
    resultCaption () {
      const ratio = this.questions.length ? this.score / this.questions.length : 0;
      if (ratio === 1) return "Perfect score — it's your own data, but still.";
      if (ratio >= 0.7) return 'You know your taste pretty well.';
      if (ratio >= 0.4) return "There's more in your library than you remember.";
      return 'Your own library, full of surprises.';
    }
  },
  mounted () {
    this.newQuiz();
  },
  methods: {
    newQuiz () {
      this.questions = generateQuizQuestions(this.eligibleGameEntries, this.gameRatingFor, Math.random, 6);
      this.currentIndex = 0;
      this.score = 0;
      this.selectedIndex = null;
      this.answered = false;
      this.status = this.questions.length ? 'playing' : 'empty';
    },
    selectOption (index) {
      if (this.answered) return;
      this.answered = true;
      this.selectedIndex = index;
      if (this.currentQuestion.options[index].isCorrect) {
        this.score += 1;
      }
    },
    next () {
      if (this.currentIndex + 1 < this.questions.length) {
        this.currentIndex += 1;
        this.selectedIndex = null;
        this.answered = false;
      } else {
        this.status = 'finished';
      }
    },
    optionClass (option, index) {
      if (!this.answered) return '';
      if (option.isCorrect) return 'correct';
      if (index === this.selectedIndex) return 'incorrect';
      return '';
    }
  }
};
</script>

<style scoped>
.taste-quiz-game {
  color: #eee;
  min-height: 100vh;
  padding: 0 1rem 2rem;
  text-align: center;
}

.game-title {
  margin: 0.5rem 0 1rem;
}

.not-enough-movies {
  color: #adb5bd;
  margin-top: 2rem;
}

.question-progress {
  color: #adb5bd;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.question-prompt {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: 420px;
  margin: 0 auto;
}

.option-button {
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 0.4rem;
  color: #eee;
  padding: 0.65rem 0.9rem;
  text-align: left;
}

.option-button:active {
  border-color: #ffc107;
}

.option-button.correct {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
}

.option-button.incorrect {
  border-color: #ff6a6a;
  background: rgba(255, 106, 106, 0.15);
}

.results-score {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 2rem 0 0.5rem;
}

.results-caption {
  color: #adb5bd;
  margin-bottom: 1.5rem;
}
</style>
