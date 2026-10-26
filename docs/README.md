# Zion Quiz

A live, fastest-finger Bible quiz that a whole room plays on their own phones, with the questions on a projector and a host who controls every round.

Built for IPC Ebenezer Mallapur. Runs entirely on a free Google account — no server, no hosting bill, no app to install.

**[Open the front door →](https://YOUR-USERNAME.github.io/zion-quiz/)**

---

## How a round works

1. The host presses **Pop question**
2. Every phone and the big screen flash the question number and the music starts
3. The question shows alone for **5 seconds** while people think
4. Four options open everywhere at once, a clock ticks, **20 seconds** to answer
5. Tapping an option stops that phone's ticking — then Submit locks the time
6. The host presses **Close answers**: the correct option turns green and the three fastest names slide up
7. On to the next question

Nothing moves without the host. Between questions every phone sits on a gold spinner.

---

## The five pages

All five come from **one deployment**. The page you get depends on what's on the end of the link.

| Page | Who sees it | Link |
|---|---|---|
| **Player** | Everyone, on their phone | `/exec` |
| **Host control** | You, on a laptop | `/exec?admin=YOUR_KEY` |
| **Big screen** | The projector | `/exec?admin=YOUR_KEY&view=screen` |
| **Leaderboard** | A second screen, or your phone | `/exec?admin=YOUR_KEY&view=board` |
| **Answer key** | You only — printable | `/exec?admin=YOUR_KEY&view=key` |

Anyone without the passcode gets the player page, so there's nothing to give away.

**Player** — name screen, then the question, then the options with a draining 20-second bar, then your time locked on screen.

**Host control** — pop a question, close answers, see who has answered and how fast, pick any question out of order, start a new game, reset everything. Buttons to open the other three pages.

**Big screen** — the question large enough to read from the back of a hall, a live "7 of 12 in" counter, then the reveal with the top three times.

**Leaderboard** — this question's times, correct answers first, fastest on top, with a Refresh button so the host decides when the room sees it.

**Answer key** — every question with the correct option in green and the reference beside it. Prints clean on white paper.

---

## How it's built

```
Phones ─┐
        ├─→ Apps Script web app ─→ Google Sheet
Screen ─┘        (one deployment)     ├── Questions
                                      ├── Answers
                                      └── Players
```

- **No framework.** Plain HTML, CSS and JavaScript, hand-written.
- **No database server.** A Google Sheet holds the questions and the log; Apps Script's cache holds the live game state so the per-second calls stay fast.
- **Each phone times itself.** The clock starts when the options appear *on that phone*, so a slow connection costs nobody a place. Reloading mid-question doesn't restart it either.
- **The shuffle happens once, on the server.** The big screen and every phone show A, B, C, D in the same order — but a different order each time a question is popped.
- **Sound is built into the page** as two base64 clips, so nothing has to load from the internet mid-game.

### Design

An oxblood leather Bible with gilt page edges. The answer options are the thumb-index tabs cut into a Bible's edge, and choosing one draws a highlighter stroke across it. Type is Bricolage Grotesque and Newsreader.

---

## Setting it up

You need a Google account. Nothing else.

1. Make a **new Google Sheet**
2. **Extensions → Apps Script**
3. Paste [`apps-script/Code.gs`](apps-script/Code.gs) over everything in `Code.gs`
4. **File → New → HTML file**, name it exactly `Index`, paste [`apps-script/Index.html`](apps-script/Index.html)
5. Same again for `Screen`, `Key` and `Audio` — the names must match exactly, with no `.html` typed on the end
6. Open `Code.gs` and change `ADMIN_KEY` from `CHANGE-ME` to your own passcode
7. Run `setUp` once and grant the permissions
8. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ← must be this, not "Anyone with Google Account"
9. Copy the `/exec` link. That's your player link; add `?admin=YOUR_KEY` for the host page

### Questions

Edit them in the **Questions** sheet — the app reads it live, so a change shows up within seconds and no redeploy is needed.

| A | B–E | F | G |
|---|---|---|---|
| The question | Four options | Which one is right (1–4) | Reference, optional |

Or write them into `SEED_QUESTIONS` at the bottom of `Code.gs` and use **Zion Quiz → Load the questions from the code**.

### Changing the timings

Top of `Code.gs`:

```js
const READ_SECONDS   = 5;    // question alone, music playing
const ANSWER_SECONDS = 20;   // options open, clock ticking
```

---

## Things worth knowing

**Always redeploy with "New version", never "New deployment."** New version keeps your link. New deployment mints a fresh one and breaks every link you've shared.

**"Who has access" must be "Anyone."** If it's set to "Anyone with Google Account", everybody who isn't signed into Google — which on a phone is most people — gets a Google Drive error instead of the quiz. This is the single most common thing that goes wrong.

**WhatsApp's built-in browser can choke on it.** If someone's stuck, have them open the link in Chrome or Safari instead.

**Size.** Phones check for a new question every two seconds, so there's about a two-second gap after the host pops one. Comfortable up to roughly fifty phones.

---

## Repository layout

```
apps-script/      the five files that go into the Apps Script editor
  Code.gs           server: state, scoring, the sheet
  Index.html        player, host control and leaderboard
  Screen.html       the projector page
  Key.html          the printable answer key
  Audio.html        the two sound clips, base64
docs/             the GitHub Pages front door
  index.html        join button and QR code
```

---

## History

Three builds got here.

**Quizzo** — the prototype. One phone, passed around, everyone took a ten-question paper in turn.

**Sword Drill** — the beta. A verse race: the reference goes up, you find it in your own Bible and pick the opening words. Taught me what breaks in a real room.

**Zion Quiz** — this one. Host-controlled, projector, real-time, fastest finger.

---

## Licence

MIT. Use it, change it, run it at your own church.

The two sound clips come from Freesound and Dragon Studio and keep their own licences.
