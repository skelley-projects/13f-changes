// Le Coach — core data: cognate engine, faux amis, phonics reference.
// Classic script (no modules) so the app works from file:// with zero build.
window.FRENCH = {
  units: [],

  // Spanish/English → French conversion patterns. Each unlocks a family of
  // words the learner already owns in another language.
  cognateRules: [
    {
      from: 'es', rule: '-ción → -tion', note: 'Pronounced /syõ/ ("syo(n)"), not "shun".',
      examples: [
        { src: 'nación', fr: 'nation' }, { src: 'información', fr: 'information' },
        { src: 'situación', fr: 'situation' }, { src: 'tradición', fr: 'tradition' },
      ],
    },
    {
      from: 'es', rule: '-dad → -té', note: 'Feminine in both languages (la ciudad → la cité).',
      examples: [
        { src: 'universidad', fr: 'université' }, { src: 'ciudad', fr: 'cité' },
        { src: 'realidad', fr: 'réalité' }, { src: 'libertad', fr: 'liberté' },
      ],
    },
    {
      from: 'es', rule: '-mente → -ment', note: 'Adverbs work exactly like Spanish: feminine adjective + ment.',
      examples: [
        { src: 'rápidamente', fr: 'rapidement' }, { src: 'exactamente', fr: 'exactement' },
        { src: 'normalmente', fr: 'normalement' }, { src: 'finalmente', fr: 'finalement' },
      ],
    },
    {
      from: 'es', rule: '-oso / -osa → -eux / -euse',
      note: 'Masculine -eux, feminine -euse.',
      examples: [
        { src: 'famoso', fr: 'fameux' }, { src: 'peligroso', fr: 'dangereux' },
        { src: 'curioso', fr: 'curieux' }, { src: 'nervioso', fr: 'nerveux' },
      ],
    },
    {
      from: 'es', rule: '-ar verbs → -er verbs',
      note: 'Spanish 1st conjugation maps to French -er; the endings chart maps almost one-to-one.',
      examples: [
        { src: 'cantar', fr: 'chanter' }, { src: 'estudiar', fr: 'étudier' },
        { src: 'pasar', fr: 'passer' }, { src: 'preparar', fr: 'préparer' },
      ],
    },
    {
      from: 'es', rule: 'es- + consonant → é- / e-',
      note: 'Spanish added an e before s+consonant; French dropped the s, often leaving an accent.',
      examples: [
        { src: 'escuela', fr: 'école' }, { src: 'estudiante', fr: 'étudiant' },
        { src: 'estado', fr: 'état' }, { src: 'espacio', fr: 'espace' },
      ],
    },
    {
      from: 'es', rule: '-aje → -age', note: 'Masculine in both. Pronounced /aʒ/ ("ahzh").',
      examples: [
        { src: 'viaje', fr: 'voyage' }, { src: 'mensaje', fr: 'message' },
        { src: 'garaje', fr: 'garage' }, { src: 'coraje', fr: 'courage' },
      ],
    },
    {
      from: 'es', rule: '-ía → -ie', examples: [
        { src: 'filosofía', fr: 'philosophie' }, { src: 'energía', fr: 'énergie' },
        { src: 'biología', fr: 'biologie' }, { src: 'compañía', fr: 'compagnie' },
      ],
    },
    {
      from: 'es', rule: '-ista → -iste, -ismo → -isme', examples: [
        { src: 'artista', fr: 'artiste' }, { src: 'turista', fr: 'touriste' },
        { src: 'optimismo', fr: 'optimisme' },
      ],
    },
    {
      from: 'es', rule: 'cua- / cue- → qua- / que-', examples: [
        { src: 'cuando', fr: 'quand' }, { src: 'cuatro', fr: 'quatre' },
        { src: 'cualidad', fr: 'qualité' }, { src: 'frecuente', fr: 'fréquent' },
      ],
    },
    {
      from: 'es', rule: 'ñ → gn', note: 'Same sound, different spelling.',
      examples: [
        { src: 'España', fr: 'Espagne' }, { src: 'señal', fr: 'signal' },
        { src: 'montaña', fr: 'montagne' },
      ],
    },
    {
      from: 'en', rule: 'ô / ê / î = a lost s', note: 'The circumflex usually marks an s English kept. Seeing "ô"? Try inserting an s.',
      examples: [
        { src: 'hospital', fr: 'hôpital' }, { src: 'forest', fr: 'forêt' },
        { src: 'coast', fr: 'côte' }, { src: 'island (isle)', fr: 'île' },
      ],
    },
    {
      from: 'en', rule: '-ty → -té', examples: [
        { src: 'quality', fr: 'qualité' }, { src: 'society', fr: 'société' },
        { src: 'possibility', fr: 'possibilité' },
      ],
    },
    {
      from: 'en', rule: '-ous → -eux', examples: [
        { src: 'dangerous', fr: 'dangereux' }, { src: 'serious', fr: 'sérieux' },
        { src: 'mysterious', fr: 'mystérieux' },
      ],
    },
    {
      from: 'en', rule: '-ary / -ory → -aire / -oire', examples: [
        { src: 'necessary', fr: 'nécessaire' }, { src: 'dictionary', fr: 'dictionnaire' },
        { src: 'history', fr: 'histoire' },
      ],
    },
  ],

  // Spanish ↔ French false friends — the tax on all that free vocabulary.
  fauxAmis: [
    { fr: 'salir', means: 'to dirty, to soil', trap: 'ES salir (to go out) → French: sortir', hint: 'sah-LEER' },
    { fr: 'entendre', means: 'to hear', trap: 'ES entender (to understand) → French: comprendre', hint: 'ah(n)-Tah(n)-druh' },
    { fr: 'attendre', means: 'to wait (for)', trap: 'ES atender / EN attend → French: assister à (attend), s’occuper de (attend to)', hint: 'ah-Tah(n)-druh' },
    { fr: 'demander', means: 'to ask (for)', trap: 'ES demandar / EN demand (legal/forceful) → French: exiger (demand), poursuivre (sue)', hint: 'duh-mah(n)-DAY' },
    { fr: 'quitter', means: 'to leave (a place/person)', trap: 'ES quitar (to remove) → French: enlever', hint: 'kee-TAY' },
    { fr: 'subir', means: 'to undergo, suffer', trap: 'ES subir (to go up) → French: monter', hint: 'sü-BEER' },
    { fr: 'rester', means: 'to stay, remain', trap: 'ES restar (subtract) / EN rest → French: se reposer (rest)', hint: 'res-TAY' },
    { fr: 'large', means: 'wide', trap: 'ES largo (long) → French: long / longue', hint: 'larzh' },
    { fr: 'nombre', means: 'number', trap: 'ES nombre (name) → French: nom', hint: 'NO(N)-bruh' },
    { fr: 'sol', means: 'ground, floor, soil', trap: 'ES sol (sun) → French: soleil', hint: 'sol' },
    { fr: 'enfermer', means: 'to lock up, shut in', trap: 'ES enfermo (sick) → French: malade', hint: 'ah(n)-fair-MAY' },
    { fr: 'exprimer', means: 'to express', trap: 'ES exprimir (to squeeze) → French: presser', hint: 'ex-pree-MAY' },
    { fr: 'contester', means: 'to dispute, contest', trap: 'ES contestar (to answer) → French: répondre', hint: 'ko(n)-tes-TAY' },
    { fr: 'constipé', means: 'constipated', trap: 'ES constipado (having a cold) → French: enrhumé', hint: 'ko(n)-stee-PAY' },
    { fr: 'embarrassée', means: 'embarrassed', trap: 'Pregnant is enceinte — same trap as Spanish embarazada/English.', hint: 'ah(n)-bah-rah-SAY' },
    { fr: 'carte', means: 'card, map, menu', trap: 'ES carta (letter) → French: lettre', hint: 'kart' },
    { fr: 'équipage', means: 'crew', trap: 'ES equipaje (luggage) → French: bagages', hint: 'ay-kee-PAHZH' },
    { fr: 'débile', means: 'idiotic, dumb (slang)', trap: 'ES débil (weak) → French: faible', hint: 'day-BEEL' },
    { fr: 'pourtant', means: 'yet, however', trap: 'ES por (lo) tanto (therefore) → French: donc', hint: 'poor-TAH(N)' },
    { fr: 'gâteau', means: 'cake', trap: 'Not ES gato (cat) → French: chat. Un gâteau, deux chats.', hint: 'gah-TOH' },
  ],

  // Sound system reference — the single highest-leverage page for a Spanish
  // speaker, whose eyes will read French with Spanish letter-sound rules.
  phonics: [
    {
      group: 'The golden rule: final consonants are silent',
      rules: [
        { spell: '-s, -t, -d, -x, -z, -p, -g (final)', sound: 'silent', examples: [{ fr: 'Paris', hint: 'pah-REE' }, { fr: 'petit', hint: 'puh-TEE' }, { fr: 'trop', hint: 'troh' }] },
        { spell: 'C, R, F, L (final)', sound: 'usually pronounced — remember "CaReFuL"', examples: [{ fr: 'avec', hint: 'ah-VEK' }, { fr: 'pour', hint: 'poor' }, { fr: 'neuf', hint: 'nuhf' }, { fr: 'hôtel', hint: 'oh-TEL' }] },
        { spell: '-e (final, no accent)', sound: 'silent; it just makes the consonant before it audible', examples: [{ fr: 'petite', hint: 'puh-TEET' }, { fr: 'France', hint: 'frah(n)ss' }] },
        { spell: '-ent (verb ending, ils/elles)', sound: 'completely silent', examples: [{ fr: 'ils parlent', hint: 'eel PARL' }] },
      ],
    },
    {
      group: 'Nasal vowels (the genuinely new sounds)',
      rules: [
        { spell: 'an / en / am / em', sound: '/ɑ̃/ — "ah" through the nose', examples: [{ fr: 'France', hint: 'frah(n)ss' }, { fr: 'comment', hint: 'koh-mah(n)' }] },
        { spell: 'on / om', sound: '/ɔ̃/ — "oh" through the nose', examples: [{ fr: 'bon', hint: 'bo(n)' }, { fr: 'nom', hint: 'no(n)' }] },
        { spell: 'in / im / ain / ein / un', sound: '/ɛ̃/ — "eh" through the nose', examples: [{ fr: 'vin', hint: 'veh(n)' }, { fr: 'pain', hint: 'peh(n)' }, { fr: 'un', hint: 'uh(n)' }] },
        { spell: '…but vowel + nn/mm or + vowel', sound: 'NOT nasal — pronounce the n/m normally', examples: [{ fr: 'bonne', hint: 'bun' }, { fr: 'année', hint: 'ah-NAY' }] },
      ],
    },
    {
      group: 'Vowels that betray Spanish eyes',
      rules: [
        { spell: 'u', sound: '/y/ — say "ee" with rounded lips. NOT Spanish u.', examples: [{ fr: 'tu', hint: 'tü' }, { fr: 'rue', hint: 'rü' }] },
        { spell: 'ou', sound: '/u/ — this is the Spanish u', examples: [{ fr: 'vous', hint: 'voo' }, { fr: 'jour', hint: 'zhoor' }] },
        { spell: 'oi', sound: '/wa/ — like Spanish "ua"', examples: [{ fr: 'moi', hint: 'mwah' }, { fr: 'trois', hint: 'trwah' }] },
        { spell: 'au / eau / ô', sound: '/o/ — plain "oh"', examples: [{ fr: 'eau', hint: 'oh' }, { fr: 'beau', hint: 'boh' }] },
        { spell: 'é / -er / -ez', sound: '/e/ — Spanish e (cerrada)', examples: [{ fr: 'parlé', hint: 'par-LAY' }, { fr: 'parler', hint: 'par-LAY' }, { fr: 'parlez', hint: 'par-LAY' }] },
        { spell: 'è / ê / ai / ei', sound: '/ɛ/ — open e, like English "bed"', examples: [{ fr: 'père', hint: 'pair' }, { fr: 'fait', hint: 'feh' }] },
        { spell: 'eu / œu', sound: '/ø/~/œ/ — say "eh" with rounded lips', examples: [{ fr: 'deux', hint: 'duh' }, { fr: 'sœur', hint: 'suhr' }] },
        { spell: 'e (unaccented, mid-word)', sound: '/ə/ — weak "uh", often dropped', examples: [{ fr: 'le', hint: 'luh' }, { fr: 'samedi', hint: 'sam-DEE' }] },
      ],
    },
    {
      group: 'Consonants',
      rules: [
        { spell: 'r', sound: 'uvular /ʁ/ — back of throat, like a soft gargle; NOT rolled', examples: [{ fr: 'rouge', hint: 'roozh' }, { fr: 'Paris', hint: 'pah-REE' }] },
        { spell: 'j / g(+e,i)', sound: '/ʒ/ — the "s" in English "measure"', examples: [{ fr: 'je', hint: 'zhuh' }, { fr: 'rouge', hint: 'roozh' }] },
        { spell: 'ch', sound: '/ʃ/ — English "sh", NOT Spanish ch', examples: [{ fr: 'chat', hint: 'shah' }, { fr: 'chercher', hint: 'shair-SHAY' }] },
        { spell: 'gn', sound: '/ɲ/ — exactly Spanish ñ', examples: [{ fr: 'Espagne', hint: 'es-PAH-nyuh' }, { fr: 'montagne', hint: 'mo(n)-TAH-nyuh' }] },
        { spell: 'h', sound: 'always silent', examples: [{ fr: 'hôtel', hint: 'oh-TEL' }, { fr: 'heure', hint: 'uhr' }] },
        { spell: 'qu', sound: '/k/ — like Spanish', examples: [{ fr: 'qui', hint: 'kee' }, { fr: 'quatre', hint: 'KAH-truh' }] },
        { spell: 'll / ill', sound: 'usually /j/ ("y") after i: famille; but ville, mille = /l/', examples: [{ fr: 'famille', hint: 'fah-MEE-yuh' }, { fr: 'ville', hint: 'veel' }] },
        { spell: 'ç', sound: '/s/ — cedilla forces soft c', examples: [{ fr: 'ça va', hint: 'sah vah' }, { fr: 'français', hint: 'frah(n)-SEH' }] },
      ],
    },
    {
      group: 'Liaison & elision (why French sounds like one long word)',
      rules: [
        { spell: 'Liaison', sound: 'a silent final consonant is pronounced when the next word starts with a vowel; s/x sound like /z/', examples: [{ fr: 'vous êtes', hint: 'voo-ZET' }, { fr: 'les amis', hint: 'lay-zah-MEE' }, { fr: 'petit ami', hint: 'puh-tee-tah-MEE' }] },
        { spell: 'Elision', sound: 'le/la/je/ne/de/que drop their vowel before a vowel: l’, j’, n’, d’, qu’', examples: [{ fr: "j'ai", hint: 'zhay' }, { fr: "l'eau", hint: 'loh' }, { fr: "c'est", hint: 'say' }] },
        { spell: 'Stress', sound: 'always lightly on the LAST syllable of a phrase — no word stress like Spanish/English', examples: [{ fr: 'important', hint: 'eh(n)-por-TAH(N)' }] },
      ],
    },
  ],
};
