/**
 * ============================================================
 *  ZION QUIZ — fastest finger Bible quiz
 *  Google Apps Script web app (bound to its own Google Sheet)
 * ============================================================
 *
 *  SETUP — once:
 *    1. Make a NEW Google Sheet
 *    2. Extensions → Apps Script
 *    3. Paste this file into Code.gs (replace everything)
 *    4. File → New → HTML file → name it exactly:  Index
 *    5. File → New → HTML file → name it exactly:  Screen
 *    6. File → New → HTML file → name it exactly:  Key
 *    7. File → New → HTML file → name it exactly:  Audio
 *    8. Run  setUp  once and grant permissions
 *    9. Deploy → New deployment → Web app
 *         Execute as:      Me
 *         Who has access:  Anyone with the link
 *
 *  ALREADY SET UP AND CHANGING THE QUESTIONS?
 *    Zion Quiz menu → "Load the questions from the code".
 *    That wipes the Questions sheet and writes the ten below.
 *
 *  FIVE LINKS, ONE DEPLOYMENT
 *    Players:      .../exec
 *    Host control: .../exec?admin=YOUR_KEY
 *    Big screen:   .../exec?admin=YOUR_KEY&view=screen
 *    Leaderboard:  .../exec?admin=YOUR_KEY&view=board
 *    Answer key:   .../exec?admin=YOUR_KEY&view=key
 *    The control page has buttons that open the other three.
 *
 *  A ROUND, START TO FINISH
 *    You press Pop question →
 *    every phone AND the big screen flash the number and start the
 *    music → the question shows alone for 5 seconds → the four
 *    options open everywhere at once, clock ticking, 20 seconds →
 *    tapping an option stops that phone's ticking →
 *    they press Submit answer and their time locks →
 *    you press Refresh on the leaderboard to show the times →
 *    their phones sit on the gold spinner until you pop the next one.
 *
 *  NOTHING MOVES WITHOUT YOU
 *    Phones and the big screen only ever show what the control page
 *    has pushed. Between questions everyone waits.
 * ============================================================
 */

/* ---------- settings ---------- */
const ADMIN_KEY      = 'CHANGE-ME';      // your private host passcode — set your own before deploying
const READ_SECONDS   = 5;                // question alone, music playing
const ANSWER_SECONDS = 20;               // options open, clock ticking
const FLASH_MS       = 600;              // the question-number flash

/* ---------- sheets ---------- */
const QUESTIONS_SHEET = 'Questions';
const ANSWERS_SHEET   = 'Answers';
const PLAYERS_SHEET   = 'Players';

const QUESTIONS_HEADER = ['Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4',
                          'Correct (1-4)', 'Reference (optional)'];
const ANSWERS_HEADER   = ['Received', 'Game', 'Round', 'Question #', 'Question', 'Player ID', 'Name',
                          'Choice', 'Correct', 'Time (ms)'];
const PLAYERS_HEADER   = ['Joined', 'Game', 'Player ID', 'Name'];

const CACHE_TTL = 21600;   // 6 hours, the longest Apps Script allows

/* ============================================================
   1. ENTRY POINT — one deployment, five pages
   ============================================================ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  let mode = 'player';
  if (p.admin === ADMIN_KEY) {
    mode = (p.view === 'board')  ? 'board'
         : (p.view === 'screen') ? 'screen'
         : (p.view === 'key')    ? 'key'
         : 'control';
  }

  const file = (mode === 'screen') ? 'Screen'
             : (mode === 'key')    ? 'Key'
             : 'Index';
  const t = HtmlService.createTemplateFromFile(file);
  t.mode = mode;
  t.key  = (mode === 'player') ? '' : ADMIN_KEY;   // players never receive the key

  return t.evaluate()
    .setTitle(mode === 'board'   ? 'Zion Quiz — Leaderboard'
            : mode === 'screen'  ? 'Zion Quiz — Question'
            : mode === 'key'     ? 'Zion Quiz — Answer key'
            : mode === 'control' ? 'Zion Quiz — Host'
            : 'Zion Quiz')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Lets Index and Screen pull the two sounds in from the Audio file. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ============================================================
   2. MENU + SETUP
   ============================================================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Zion Quiz')
    .addItem('First-time setup', 'setUp')
    .addItem('Load the questions from the code', 'menuLoadQuestions')
    .addSeparator()
    .addItem('Start a new game (clears players)', 'menuNewGame')
    .addItem('Reset everything (wipes all answers)', 'menuResetAll')
    .addToUi();
}

function setUp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(QUESTIONS_SHEET)) writeQuestions_();
  sheet_(ANSWERS_SHEET, ANSWERS_HEADER);
  sheet_(PLAYERS_SHEET, PLAYERS_HEADER);

  SpreadsheetApp.getUi().alert(
    'Zion Quiz is ready.\n\n' +
    SEED_QUESTIONS.length + ' questions are in the Questions sheet, with the correct one ' +
    'marked in column F.\n\n' +
    'Next: Deploy → New deployment → Web app.'
  );
}

/** Wipes the Questions sheet and writes the ten questions below. */
function menuLoadQuestions() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert(
    'Load questions',
    'This replaces everything in the Questions sheet with the ' + SEED_QUESTIONS.length +
    ' questions written into the code. Anything you typed there yourself will be lost.\n\nGo ahead?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  writeQuestions_();
  ui.alert(SEED_QUESTIONS.length + ' questions loaded. The control page picks them up within a few seconds.');
}

function writeQuestions_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let qs = ss.getSheetByName(QUESTIONS_SHEET);
  if (!qs) qs = ss.insertSheet(QUESTIONS_SHEET);
  qs.clear();

  qs.appendRow(QUESTIONS_HEADER);
  styleHeader_(qs, QUESTIONS_HEADER.length);
  qs.getRange(2, 1, SEED_QUESTIONS.length, 7).setValues(SEED_QUESTIONS);

  qs.setColumnWidth(1, 430);
  for (let c = 2; c <= 5; c++) qs.setColumnWidth(c, 185);
  qs.setColumnWidth(6, 105);
  qs.setColumnWidth(7, 150);
  qs.getRange(2, 1, SEED_QUESTIONS.length, 7).setVerticalAlignment('middle').setWrap(true);
  qs.getRange(2, 6, SEED_QUESTIONS.length, 1)
    .setHorizontalAlignment('center').setFontWeight('bold').setBackground('#FFF6C7');
}

function menuNewGame() {
  adminNewGame(ADMIN_KEY);
  SpreadsheetApp.getUi().alert('New game started. Players need to enter their names again.');
}

function menuResetAll() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert(
    'Reset everything',
    'This clears every name and every answer from the Players and Answers sheets, ' +
    'and starts a fresh game.\n\nIt cannot be undone. Go ahead?',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  const n = adminResetAll(ADMIN_KEY);
  ui.alert('Reset done. ' + n.cleared + ' answer rows cleared. Everyone starts from the name screen.');
}

function styleHeader_(sh, cols) {
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#3A0D16').setFontColor('#E0B04A');
  sh.setFrozenRows(1);
}

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    styleHeader_(sh, header.length);
  }
  return sh;
}

/* ============================================================
   3. SHARED STATE — cache for speed, properties for safety
   ============================================================ */
function cache_() { return CacheService.getScriptCache(); }
function props_() { return PropertiesService.getScriptProperties(); }

function newGameId_() {
  return 'G-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd-HHmmss');
}

function freshState_() {
  return { gameId: newGameId_(), phase: 'lobby', seq: 0, asked: 0, next: 0, askedIdx: [], q: null };
}

function readState_() {
  const c = cache_().get('zq_state');
  if (c) return JSON.parse(c);
  const p = props_().getProperty('zq_state');
  if (p) { cache_().put('zq_state', p, CACHE_TTL); return JSON.parse(p); }
  const st = freshState_();
  writeState_(st);
  return st;
}

function writeState_(st) {
  const j = JSON.stringify(st);
  props_().setProperty('zq_state', j);
  cache_().put('zq_state', j, CACHE_TTL);
}

function playersKey_(gameId) { return 'zq_players_' + gameId; }

function readPlayers_(gameId) {
  const k = playersKey_(gameId);
  const c = cache_().get(k);
  if (c) return JSON.parse(c);
  const p = props_().getProperty(k);
  const obj = p ? JSON.parse(p) : {};
  cache_().put(k, JSON.stringify(obj), CACHE_TTL);
  return obj;
}

function writePlayers_(gameId, obj) {
  const j = JSON.stringify(obj);
  props_().setProperty(playersKey_(gameId), j);
  cache_().put(playersKey_(gameId), j, CACHE_TTL);
}

function subKey_(gameId, seq, pid) { return 'zq_sub_' + gameId + '_' + seq + '_' + pid; }
function countKey_(gameId, seq)    { return 'zq_n_' + gameId + '_' + seq; }

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); }
  catch (e) { throw new Error('The game is busy for a moment. Try again.'); }
  try { return fn(); }
  finally { lock.releaseLock(); }
}

/* ============================================================
   4. QUESTIONS
   ============================================================ */
function getQuestions_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(QUESTIONS_SHEET);
  const rows = (sh && sh.getLastRow() > 1)
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues()
    : SEED_QUESTIONS;

  return rows.map(toQuestion_).filter(function (q) { return q.text; });
}

function toQuestion_(r) {
  const n = parseInt(r[5], 10);
  return {
    text: String(r[0] || '').trim(),
    opts: [r[1], r[2], r[3], r[4]].map(function (x) { return String(x || '').trim(); }),
    answer: (isNaN(n) || n < 1 || n > 4) ? -1 : n - 1,      // sheet is 1-4, code is 0-3
    ref: String(r[6] || '').trim()
  };
}

/** A question is only poppable once all four options and a valid 1-4 are in. */
function questionReady_(q) {
  return q.answer >= 0 && q.opts.filter(String).length === 4;
}

function shuffle_(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ============================================================
   5. PLAYERS — join, poll, answer
   ============================================================ */
function joinGame(name, pid) {
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw new Error('Type your name first.');

  return withLock_(function () {
    const st = readState_();
    const players = readPlayers_(st.gameId);

    const taken = Object.keys(players).some(function (k) {
      return k !== pid && players[k].toLowerCase() === name.toLowerCase();
    });
    if (taken) throw new Error('Someone already joined as ' + name + '. Add your surname or an initial.');

    if (!pid) pid = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    const isNew = !players[pid];
    players[pid] = name;
    writePlayers_(st.gameId, players);

    if (isNew) sheet_(PLAYERS_SHEET, PLAYERS_HEADER).appendRow([new Date(), st.gameId, pid, name]);
    return { pid: pid, name: name, gameId: st.gameId };
  });
}

/** Every phone asks for this every couple of seconds. Cache only, so it is quick. */
function getState(pid) {
  const st = readState_();
  const players = readPlayers_(st.gameId);

  const out = {
    gameId: st.gameId,
    phase: st.phase,
    seq: st.seq,
    joined: Object.keys(players).length,
    known: !!(pid && players[pid]),
    readMs: READ_SECONDS * 1000,
    answerMs: ANSWER_SECONDS * 1000,
    flashMs: FLASH_MS
  };

  if ((st.phase === 'question' || st.phase === 'closed') && st.q) {
    out.q = { n: st.q.n, text: st.q.text, opts: st.q.opts };   // never the answer
    if (pid) out.answered = !!cache_().get(subKey_(st.gameId, st.seq, pid));
  }
  return out;
}

function submitAnswer(pid, seq, choice, ms) {
  const st = readState_();
  if (st.phase !== 'question' || !st.q || st.seq !== Number(seq)) return { ok: false, reason: 'closed' };

  const players = readPlayers_(st.gameId);
  const name = players[pid];
  if (!name) return { ok: false, reason: 'unknown' };

  choice = Number(choice);
  if (!(choice >= 0 && choice < st.q.opts.length)) return { ok: false, reason: 'invalid' };
  ms = Math.min(ANSWER_SECONDS * 1000, Math.max(0, Math.round(Number(ms) || 0)));

  return withLock_(function () {
    const key = subKey_(st.gameId, st.seq, pid);
    if (cache_().get(key)) return { ok: true, duplicate: true };

    const correct = choice === st.q.answer;
    sheet_(ANSWERS_SHEET, ANSWERS_HEADER).appendRow(
      [new Date(), st.gameId, st.seq, st.q.n, st.q.text, pid, name,
       st.q.opts[choice], correct ? 'Yes' : 'No', ms]);

    cache_().put(key, '1', CACHE_TTL);

    // a running count so the big screen can show "7 answered" without reading the sheet
    const ck = countKey_(st.gameId, st.seq);
    cache_().put(ck, String((Number(cache_().get(ck)) || 0) + 1), CACHE_TTL);

    return { ok: true };
  });
}

/* ============================================================
   6. HOST CONTROLS
   ============================================================ */
function assertKey_(key) {
  if (key !== ADMIN_KEY) throw new Error('This page needs the host link.');
}

function adminStatus(key) {
  assertKey_(key);
  return status_();
}

function status_() {
  const st = readState_();
  const players = readPlayers_(st.gameId);
  const questions = getQuestions_();

  const current = st.seq
    ? answerRows_(st.gameId).filter(function (r) { return r.round === st.seq; }).sort(rankAnswers_)
    : [];

  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  const tail = url ? url + '?admin=' + encodeURIComponent(ADMIN_KEY) : '';

  return {
    gameId: st.gameId,
    phase: st.phase,
    seq: st.seq,
    asked: st.asked || 0,
    next: st.next || 0,
    askedIdx: st.askedIdx || [],
    readSeconds: READ_SECONDS,
    answerSeconds: ANSWER_SECONDS,
    q: st.q ? { n: st.q.n, idx: st.q.idx, text: st.q.text, opts: st.q.opts,
                answer: st.q.answer, ref: st.q.ref } : null,
    players: Object.keys(players).map(function (k) { return players[k]; }),
    answers: current.map(function (r) { return { name: r.name, ms: r.ms, correct: r.correct }; }),
    questions: questions.map(function (q) {
      return { text: q.text, answerText: q.answer >= 0 ? q.opts[q.answer] : '', ready: questionReady_(q) };
    }),
    playerUrl: url,
    screenUrl: tail ? tail + '&view=screen' : '',
    boardUrl:  tail ? tail + '&view=board'  : '',
    keyUrl:    tail ? tail + '&view=key'    : ''
  };
}

/** Pushes a question to every phone and to the big screen. */
function adminPop(key, idx) {
  assertKey_(key);
  withLock_(function () {
    const st = readState_();
    const questions = getQuestions_();

    idx = Number(idx);
    if (!(idx >= 0 && idx < questions.length)) idx = st.next || 0;
    if (idx >= questions.length) throw new Error('That was the last question in the sheet.');

    const q = questions[idx];
    if (!questionReady_(q)) {
      throw new Error('Question ' + (idx + 1) + ' needs all four options and a 1-4 in column F.');
    }

    // shuffled once here, so the screen and every phone show the same order
    const order = shuffle_([0, 1, 2, 3]);
    const opts = order.map(function (i) { return q.opts[i]; });

    st.seq = (st.seq || 0) + 1;
    st.asked = (st.asked || 0) + 1;
    st.q = {
      n: st.asked,
      idx: idx,
      text: q.text,
      opts: opts,
      answer: order.indexOf(q.answer),
      ref: q.ref,
      poppedAt: Date.now()
    };
    st.phase = 'question';
    st.next = idx + 1;
    st.askedIdx = (st.askedIdx || []).concat([idx]);
    writeState_(st);
  });
  return status_();
}

/** Stops answers and reveals the correct option on the screen and the leaderboard. */
function adminClose(key) {
  assertKey_(key);
  withLock_(function () {
    const st = readState_();
    if (st.phase === 'question') { st.phase = 'closed'; writeState_(st); }
  });
  return status_();
}

/** Fresh game: new ID, empty player list, everyone back to the name screen. */
function adminNewGame(key) {
  assertKey_(key);
  withLock_(function () {
    const old = readState_();
    props_().deleteProperty(playersKey_(old.gameId));
    cache_().remove(playersKey_(old.gameId));
    writeState_(freshState_());
  });
  return status_();
}

/**
 * Wipes the slate completely: every name and every answer gone from both
 * sheets, every stored game forgotten, and a fresh game started.
 * Use this between events. "New game" is the lighter option during one.
 */
function adminResetAll(key) {
  assertKey_(key);

  const out = withLock_(function () {
    // forget every game this script has held on to
    const all = props_().getProperties();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('zq_players_') === 0) props_().deleteProperty(k);
    });
    props_().deleteProperty('zq_state');
    cache_().remove('zq_state');

    // empty the two logs, keeping their headers
    let cleared = 0;
    [[ANSWERS_SHEET, ANSWERS_HEADER], [PLAYERS_SHEET, PLAYERS_HEADER]].forEach(function (pair) {
      const sh = sheet_(pair[0], pair[1]);
      const last = sh.getLastRow();
      if (last > 1) {
        if (pair[0] === ANSWERS_SHEET) cleared = last - 1;
        sh.deleteRows(2, last - 1);
      }
    });

    writeState_(freshState_());
    return cleared;
  });

  const st = status_();
  st.cleared = out;
  return st;
}

/* ============================================================
   7. THE ANSWER KEY — every question with its answer marked
   ============================================================ */
function getAnswerKey(key) {
  assertKey_(key);
  const st = readState_();

  return {
    asked: st.asked || 0,
    askedIdx: st.askedIdx || [],
    liveIdx: (st.phase === 'question' || st.phase === 'closed') && st.q ? st.q.idx : -1,
    questions: getQuestions_().map(function (q) {
      return { text: q.text, opts: q.opts, answer: q.answer, ref: q.ref, ready: questionReady_(q) };
    })
  };
}

/* ============================================================
   8. THE BIG SCREEN
      Light and quick — it polls often, so it never reads the sheet
      until the question closes and the top three are revealed.
   ============================================================ */
function getScreen(key) {
  assertKey_(key);
  const st = readState_();
  const players = readPlayers_(st.gameId);

  const out = {
    gameId: st.gameId,
    phase: st.phase,
    seq: st.seq,
    asked: st.asked || 0,
    joined: Object.keys(players).length,
    readMs: READ_SECONDS * 1000,
    answerMs: ANSWER_SECONDS * 1000,
    flashMs: FLASH_MS,
    names: st.phase === 'lobby' ? Object.keys(players).map(function (k) { return players[k]; }) : []
  };

  if ((st.phase === 'question' || st.phase === 'closed') && st.q) {
    out.q = { n: st.q.n, text: st.q.text, opts: st.q.opts, ref: st.q.ref };
    out.answered = Number(cache_().get(countKey_(st.gameId, st.seq))) || 0;

    if (st.phase === 'closed') {
      out.q.answer = st.q.answer;                       // only once you have closed it
      out.top = answerRows_(st.gameId)
        .filter(function (r) { return r.round === st.seq && r.correct; })
        .sort(function (a, b) { return a.ms - b.ms; })
        .slice(0, 3)
        .map(function (r) { return { name: r.name, ms: r.ms }; });
    }
  }
  return out;
}

/* ============================================================
   9. LEADERBOARD — this question only
   ============================================================ */
function answerRows_(gameId) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANSWERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];

  return sh.getRange(2, 1, sh.getLastRow() - 1, ANSWERS_HEADER.length).getValues()
    .filter(function (r) { return String(r[1]) === gameId; })
    .map(function (r) {
      return {
        round: Number(r[2]), n: Number(r[3]),
        pid: String(r[5]), name: String(r[6]),
        correct: r[8] === 'Yes' || r[8] === true,
        ms: Number(r[9]) || 0
      };
    });
}

function rankAnswers_(a, b) {
  return (Number(b.correct) - Number(a.correct)) || (a.ms - b.ms);
}

function getBoard(key) {
  assertKey_(key);
  const st = readState_();
  const players = readPlayers_(st.gameId);
  const current = answerRows_(st.gameId)
    .filter(function (r) { return r.round === st.seq; })
    .sort(rankAnswers_);

  return {
    phase: st.phase,
    asked: st.asked || 0,
    joined: Object.keys(players).length,
    players: Object.keys(players).map(function (k) { return players[k]; }),
    q: st.q ? {
      n: st.q.n,
      text: st.q.text,
      answerText: st.phase === 'closed' ? st.q.opts[st.q.answer] : ''
    } : null,
    current: current.map(function (r) { return { name: r.name, ms: r.ms, correct: r.correct }; })
  };
}

/* ============================================================
   10. THE QUESTIONS — Genesis, in your order
   [question, opt1, opt2, opt3, opt4, correct(1-4), reference]
   The app reads the sheet live, so edit there and the change
   shows up within seconds. No redeploy needed.
   ============================================================ */
const SEED_QUESTIONS = [
  ['What name did Adam give his wife after the Fall?',
   'Eve', 'Zillah', 'Adah', 'Naamah', 1, 'Genesis 3:20'],

  ['Which son of Adam and Eve was born after Abel’s death?',
   'Enos', 'Seth', 'Cainan', 'Lamech', 2, 'Genesis 4:25'],

  ['Who was the father of Methuselah?',
   'Jared', 'Lamech', 'Enoch', 'Mahalaleel', 3, 'Genesis 5:21'],

  ['What was the name of Noah’s youngest son?',
   'Shem', 'Japheth', 'Ham', 'Canaan', 3, 'Genesis 9:24'],

  ['How many days and nights did rain fall upon the earth during the Flood?',
   'Seven', 'Thirty', 'Forty', 'A hundred and fifty', 3, 'Genesis 7:12'],

  ['What was the name of the place where the Lord confused the language of the whole earth?',
   'Shinar', 'Babel', 'Erech', 'Accad', 2, 'Genesis 11:9'],

  ['Who was Abram’s brother who died before his father Terah?',
   'Nahor', 'Lot', 'Haran', 'Milcah', 3, 'Genesis 11:28'],

  ['Which river did God name as the boundary of the land promised to Abram’s descendants, beside the Euphrates?',
   'The river Gihon', 'The river of Egypt', 'The river Hiddekel', 'The river Pison', 2, 'Genesis 15:18'],

  ['Which king of Elam joined the coalition that fought against the kings of Sodom and Gomorrah?',
   'Amraphel', 'Arioch', 'Tidal', 'Chedorlaomer', 4, 'Genesis 14:9'],

  ['What did Abram refuse to take from the king of Sodom, so the king could not say he had made Abram rich?',
   'A tenth of the goods', 'The captives of Sodom', 'Anything, from a thread to a shoelatchet', 'The spoil of the battle', 3, 'Genesis 14:23']
];
