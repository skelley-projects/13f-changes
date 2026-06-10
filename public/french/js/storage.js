// Progress persistence in localStorage — the app's only "database".
// Export/import as JSON from Settings so progress can move between machines.
window.Store = (function () {
  var KEY = 'lecoach.v1';

  var defaults = function () {
    return {
      version: 1,
      cards: {},        // cardId → SRS card state
      started: {},      // unitId → timestamp the deck was activated
      done: {},         // activityKey (e.g. 'reader:u1') → true
      log: {},          // dateKey → number of reviews done that day
      intro: {},        // dateKey → number of new cards introduced that day
      drafts: {},       // writing-prompt key → saved draft text
      settings: { rate: 0.9, voiceURI: null, newPerDay: 10 },
    };
  };

  var state = defaults();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      state = Object.assign(defaults(), parsed);
      state.settings = Object.assign(defaults().settings, parsed.settings || {});
    }
  } catch (e) { /* corrupted or unavailable storage → start fresh */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  function logReview() {
    var k = U.todayKey();
    state.log[k] = (state.log[k] || 0) + 1;
    save();
  }

  function introducedToday() { return state.intro[U.todayKey()] || 0; }
  function logIntroduced() {
    var k = U.todayKey();
    state.intro[k] = (state.intro[k] || 0) + 1;
    save();
  }

  // Consecutive days (ending today or yesterday) with at least one review.
  function streak() {
    var days = 0;
    var d = new Date();
    if (!state.log[U.todayKey(d)]) d.setDate(d.getDate() - 1); // today not yet done → count from yesterday
    while (state.log[U.todayKey(d)]) { days++; d.setDate(d.getDate() - 1); }
    return days;
  }

  function exportJSON() { return JSON.stringify(state, null, 2); }

  function importJSON(text) {
    var parsed = JSON.parse(text); // throws on bad input — caller catches
    if (!parsed || typeof parsed !== 'object' || !parsed.cards) throw new Error('not a Le Coach export');
    state = Object.assign(defaults(), parsed);
    state.settings = Object.assign(defaults().settings, parsed.settings || {});
    save();
  }

  function reset() {
    state = defaults();
    save();
  }

  return {
    get state() { return state; },
    save: save, logReview: logReview, streak: streak,
    introducedToday: introducedToday, logIntroduced: logIntroduced,
    exportJSON: exportJSON, importJSON: importJSON, reset: reset,
  };
})();
