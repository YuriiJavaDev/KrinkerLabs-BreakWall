# KrinkerLabs™ BreakWall

**Break the wall**: a paddle, a ball and a wall of bricks, on the violet star field of krinkerlabs.com. Free to play in the browser on a computer, a phone or a tablet. No ads, no registration.

> Status: in development, browser version first (computer, phone, tablet). Stage 1 (the core) is done and reworked to the KrinkerLabs game layout: one level, a tray of balls, the top 10, saving, the windows to enter and leave. Not published yet. Desktop and Android builds come later.

## How to play

- Move the paddle with the mouse, a finger or the ← → (A D) keys.
- Click, tap or press Space to launch the ball. P or Esc pauses.
- Where the ball meets the paddle sets its angle: the centre sends it straight up, the edges up to 60° to the side. A moving paddle adds a little spin.
- Every brick broken in a row without touching the paddle is worth one step more: 1 000, 2 000, 3 000 … up to 10 000.
- The tray holds up to five balls; a game starts with three. Every minute a ball stays in play puts one more ball into the tray, while it has room. Up to three balls can be on the table at once (multiball); that does not take balls from the tray. Losing the last ball on the table takes one from the tray; an empty tray ends the game.
- Break every brick to win.

## Screen

The same layout as the other KrinkerLabs games:

- top: only the wordmark and the BETA mark;
- left: the score, the tray of balls with the meter for the next one, the top 10 of this browser, the player, Autosave and Save;
- middle: the table at the full height of the window, with thick rails in the site's colours that slowly flow along them; no stars on the table, they show only below the paddle;
- right: the controls, the Pause and Sound buttons with what they do, and "Back to krinkerlabs.com" at the bottom;
- bottom: the free-to-play, copyright and trademark lines.

On a phone the top 10, the player and the help go into the menu; held sideways, the table stands in the middle at full height.

## Saving

At the start the game asks who is playing. A nickname names the saved game and goes into the top 10; one can also play without a name, then nothing is saved. A save keeps what the player had at the start of the current ball (score, tray, broken bricks), never the middle of a flight. With Autosave on, the game saves at every new ball. Leaving the game offers to save first, or to give a nickname to keep the game.

## Style

One style for all KrinkerLabs web games: the violet star field with a gravitational lens from [krinkerlabs.com](https://krinkerlabs.com), the wordmark `KRINKERLABS.BREAKWALL`, shadowed 2D panels and bevelled bricks. Strict Content Security Policy (no inline scripts or styles, nothing from other addresses) so that the game runs inside the site at `krinkerlabs.com/play/breakwall/`. Sounds are synthesised in code. Russian or English, by the language of the browser.

## Technology

TypeScript, Canvas 2D, esbuild, one static build of three files (`app.js` is about 20 KB).

The simulation runs at a fixed 120 steps a second whatever the screen does, and the picture is drawn between the last two steps. The ball is checked along its whole path in every step (a moving circle against the bricks grown by its radius, with rounded corners), so even a very fast ball cannot pass through a brick, and a hit on a corner bounces off the corner. The ball never flies flatter than 70° from vertical, so it cannot get stuck between the side walls.

| Folder | What it does |
| --- | --- |
| `web/src/physics` | the sweep of the ball against boxes, the earliest contact, the paddle bounce |
| `web/src/rules` | sizes and speeds (`config.ts`), the game state, one step of the game, the tray and extra balls, points, the fixed-step loop |
| `web/src/levels` | the level format and its checks |
| `web/src/render` | the canvas drawing, the flowing rails and the star field |
| `web/src/input` | mouse, touch and keyboard |
| `web/src/audio` | the synthesised sounds |
| `web/src/storage` | the browser storage (safe when refused), players, saved games |
| `web/src/scores` | nicknames and the top 10 |
| `web/src/app` | the session: the player, the game in progress, saving at each ball, the top 10 at the end |
| `web/src/ui` | texts in both languages, score, tray and messages, the top 10 list, the windows, the phone layout |
| `web/data/levels.json` | the levels |

Physics, rules, saving, the session and the top 10 have no DOM, so all of them are checked by the unit tests.

## Development

```
cd web
npm install        # esbuild only
npm test           # 113 checks: sweep geometry, bounce angles, fast ball, walls, tray, extra balls, multiball, points, levels, saves, top 10, a full level played through
npm run check      # TypeScript types
npm run build      # web/dist: index.html, game.css, app.js
```

Serve `web/dist` with any static server and open it.

## Levels

A level is a name and up to 18 rows of 7 cells:

```json
{ "name": "First wall", "rows": ["aaaaaaa", "b.b.b.b"] }
```

`.` is an empty cell, `a` to `h` an ordinary brick of colour 1 to 8. Strong, unbreakable, explosive and moving bricks come in stage 2 as new characters.

## Stages

| Stage | What | Result | Status |
| --- | --- | --- | --- |
| 1 | Core: field, paddle, ball, physics, ordinary bricks, lives, score, one level | Tests pass, the ball never passes through a brick, the level is playable with a mouse | done |
| 2 | Strong, unbreakable, explosive, moving bricks; power-ups; combos | Rule tests pass, power-ups do not conflict | not started |
| 3 | 20–30 levels, progress, top 10 | Difficulty grows smoothly, progress is kept | not started |
| 4 | Look, effects, sounds, touch tuning | Checked on a real phone | not started |
| 5 | On the site, beta | Works under the site's CSP | not started |

The full specification is kept in the private repository of specifications of KrinkerLabs.

## License

Free to play, all rights reserved: see [LICENSE](LICENSE). The game, its code, levels, design and marks may not be copied, redistributed, sold or reused. Videos and streams of the game are welcome.

KrinkerLabs™ is a trademark of Yurii Pavlenko.

Questions and bug reports: the contact form at https://krinkerlabs.com/en/contact/
