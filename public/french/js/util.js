// Small shared helpers: accent-lenient normalization, word diff, HTML escaping.
window.U = (function () {
  function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Accent- and punctuation-lenient comparison key. « L'école, c'est génial ! »
  // and "lecole cest genial" normalize to the same thing, so typing without
  // accents or apostrophes is never marked wrong.
  function norm(s) {
    return stripDiacritics(String(s).toLowerCase())
      .replace(/[’']/g, ' ')
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // LCS-based word diff. Returns tokens from `expected` marked ok/miss plus
  // extra tokens the user typed. Comparison happens on normalized words.
  function wordDiff(expected, actual) {
    var e = expected.split(/\s+/).filter(Boolean);
    var a = actual.split(/\s+/).filter(Boolean);
    var en = e.map(norm), an = a.map(norm);
    var m = e.length, n = a.length;
    var L = [];
    for (var i = 0; i <= m; i++) { L.push(new Array(n + 1).fill(0)); }
    for (i = m - 1; i >= 0; i--) {
      for (var j = n - 1; j >= 0; j--) {
        L[i][j] = en[i] === an[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    var out = [];
    i = 0; var k = 0;
    while (i < m && k < n) {
      if (en[i] === an[k]) { out.push({ w: e[i], t: 'ok' }); i++; k++; }
      else if (L[i + 1][k] >= L[i][k + 1]) { out.push({ w: e[i], t: 'miss' }); i++; }
      else { out.push({ w: a[k], t: 'extra' }); k++; }
    }
    while (i < m) { out.push({ w: e[i++], t: 'miss' }); }
    while (k < n) { out.push({ w: a[k++], t: 'extra' }); }
    return out;
  }

  // 0..1 similarity of two phrases by word overlap — used to score speech.
  function similarity(expected, actual) {
    var diff = wordDiff(expected, actual);
    var ok = diff.filter(function (d) { return d.t === 'ok'; }).length;
    var total = expected.split(/\s+/).filter(Boolean).length;
    return total === 0 ? 0 : ok / total;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  return { norm: norm, esc: esc, wordDiff: wordDiff, similarity: similarity, shuffle: shuffle, todayKey: todayKey, stripDiacritics: stripDiacritics };
})();
