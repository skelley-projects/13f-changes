// Web Speech API wrapper: free TTS (all modern browsers) and free speech
// recognition (Chrome/Edge/Safari). No network services, no keys, no cost.
window.Speech = (function () {
  var synth = window.speechSynthesis || null;
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var cachedVoices = [];

  function refreshVoices() {
    if (!synth) return [];
    cachedVoices = synth.getVoices().filter(function (v) {
      return v.lang && v.lang.toLowerCase().indexOf('fr') === 0;
    });
    return cachedVoices;
  }
  if (synth) {
    refreshVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = refreshVoices;
  }

  function frenchVoices() {
    if (!cachedVoices.length) refreshVoices();
    return cachedVoices;
  }

  function pickVoice() {
    var voices = frenchVoices();
    if (!voices.length) return null;
    var pref = window.Store ? Store.state.settings.voiceURI : null;
    if (pref) {
      for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === pref) return voices[i];
    }
    // Prefer fr-FR, then higher-quality (non-default local often sounds better).
    var frFR = voices.filter(function (v) { return /fr[-_]FR/i.test(v.lang); });
    return frFR[0] || voices[0];
  }

  function canSpeak() { return !!synth && frenchVoices().length > 0; }
  function canListen() { return !!Rec; }

  function speak(text, opts) {
    if (!synth) return false;
    opts = opts || {};
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    var v = pickVoice();
    if (v) u.voice = v;
    u.rate = opts.rate || (window.Store ? Store.state.settings.rate : 0.9);
    synth.speak(u);
    return true;
  }

  function stop() { if (synth) synth.cancel(); }

  // One-shot French recognition. cb({ text }) on result, cb({ error }) otherwise.
  function listen(cb) {
    if (!Rec) { cb({ error: 'unsupported' }); return null; }
    var r = new Rec();
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 3;
    var done = false;
    r.onresult = function (e) {
      done = true;
      var alts = [];
      for (var i = 0; i < e.results[0].length; i++) alts.push(e.results[0][i].transcript);
      cb({ text: alts[0], alternatives: alts });
    };
    r.onerror = function (e) { if (!done) { done = true; cb({ error: e.error || 'error' }); } };
    r.onend = function () { if (!done) { done = true; cb({ error: 'no-speech' }); } };
    try { r.start(); } catch (e) { cb({ error: 'start-failed' }); }
    return r;
  }

  return { canSpeak: canSpeak, canListen: canListen, speak: speak, stop: stop, listen: listen, voices: frenchVoices };
})();
