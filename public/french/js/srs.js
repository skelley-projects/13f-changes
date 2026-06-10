// SM-2-style spaced-repetition scheduler with Anki-like learning steps.
// UMD-ish: attaches to window in the browser, exports for Node so vitest can
// exercise the scheduling logic directly.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SRS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var MIN = 60 * 1000;
  var DAY = 24 * 60 * MIN;
  var LEARNING_STEPS = [1 * MIN, 10 * MIN]; // again → 1m, then 10m, then graduate
  var GRADUATE_DAYS = 1;
  var EASY_DAYS = 4;
  var MAX_INTERVAL_DAYS = 365;
  var MIN_EASE = 1.3;

  // grades: 0 = again, 1 = hard, 2 = good, 3 = easy
  function newCard() {
    return { state: 'new', step: 0, reps: 0, lapses: 0, ease: 2.5, interval: 0, due: 0 };
  }

  function clampInterval(days) {
    return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
  }

  function grade(card, g, now) {
    var c = {
      state: card.state, step: card.step, reps: (card.reps || 0) + 1,
      lapses: card.lapses || 0, ease: card.ease || 2.5, interval: card.interval || 0, due: 0,
    };

    if (c.state === 'new') { c.state = 'learning'; c.step = 0; }

    if (c.state === 'learning' || c.state === 'relearning') {
      if (g === 0) {
        c.step = 0;
        c.due = now + LEARNING_STEPS[0];
      } else if (g === 1) {
        c.due = now + LEARNING_STEPS[c.step]; // repeat current step
      } else if (g === 3) {
        c.state = 'review'; c.step = 0;
        c.interval = Math.max(c.interval, EASY_DAYS);
        c.due = now + c.interval * DAY;
      } else { // good
        if (c.step + 1 < LEARNING_STEPS.length) {
          c.step += 1;
          c.due = now + LEARNING_STEPS[c.step];
        } else {
          c.state = 'review'; c.step = 0;
          c.interval = Math.max(c.interval, GRADUATE_DAYS);
          c.due = now + c.interval * DAY;
        }
      }
      return c;
    }

    // review state
    if (g === 0) {
      c.lapses += 1;
      c.ease = Math.max(MIN_EASE, c.ease - 0.2);
      c.state = 'relearning'; c.step = 0;
      c.interval = clampInterval(c.interval * 0.3);
      c.due = now + LEARNING_STEPS[1]; // 10 minutes, then back to a shrunk interval
    } else if (g === 1) {
      c.ease = Math.max(MIN_EASE, c.ease - 0.15);
      c.interval = clampInterval(Math.max(c.interval + 1, c.interval * 1.2));
      c.due = now + c.interval * DAY;
    } else if (g === 2) {
      c.interval = clampInterval(c.interval * c.ease);
      c.due = now + c.interval * DAY;
    } else {
      c.ease += 0.15;
      c.interval = clampInterval(c.interval * c.ease * 1.3);
      c.due = now + c.interval * DAY;
    }
    return c;
  }

  // Human label for what each grade would schedule — shown on the buttons.
  function previewLabel(card, g, now) {
    var c = grade(card, g, now);
    var delta = c.due - now;
    if (delta < 60 * MIN) return Math.max(1, Math.round(delta / MIN)) + 'm';
    if (delta < DAY) return Math.round(delta / (60 * MIN)) + 'h';
    return Math.round(delta / DAY) + 'd';
  }

  function isDue(card, now) {
    return card.state !== 'new' && card.due <= now;
  }

  return {
    newCard: newCard, grade: grade, previewLabel: previewLabel, isDue: isDue,
    LEARNING_STEPS: LEARNING_STEPS, DAY: DAY, MIN: MIN,
  };
});
