# KrinkerLabs™ BreakWall

**Break the wall**: a paddle, a ball and 24 walls of bricks in three worlds. Free to play in the browser on a computer, a phone or a tablet. No ads, no registration.

> Status: in development, browser version first. All 24 levels in three worlds are playable: Laboratory (1-1 … 1-8), Neon City (2-1 … 2-8), Reactor (3-1 … 3-8). Not published yet; desktop and Android builds come later.

## How to play

- Paddle: the mouse (held by the paddle while you play), a finger, ← → (A D) or the left and right Shift keys.
- Enter or a click on the table: launch the ball, fire the laser, let go of a ball caught by the sticky paddle.
- P or Space: pause (the mouse is free); the same key goes on. M: sound. Esc: free the mouse; Esc again: leave the game.
- Where the ball meets the paddle sets its angle: the centre sends it straight up, the edges up to 60° to the side.
- The tray holds up to five balls; a run starts with three. A ball that stays in play long enough adds one more (every 60, 75 or 90 s, by tier). Up to three balls on the table at once.
- Clear a level to see **Well done!**, its stars and points, and go on to the next one. The score and the tray go with you.

## What the player fights for

1. **Get further**: 24 levels, numbered 1-1 … 3-8, each tier its own world.
2. **Stars**: ★ cleared, ★★ at most one ball lost, ★★★ no loss and faster than the level's par time. 72 in all.
3. **The top 10**: the score of a run that starts at the first level of a tier.
4. **Balls**: the tray goes from level to level, so a good game on easy levels saves balls for hard ones.

A lost game starts the same tier again from its first level. The level map shows stars and locks; any open level can be played again for stars.

## The levels

| Tier | World | Levels | Paddle / ball | New things |
| --- | --- | --- | --- | --- |
| 1 Beginner | Laboratory: violet glass | 1-1 First wall · 1-2 Steps · 1-3 Windows · 1-4 Doubles · 1-5 Honeycomb · 1-6 Columns · 1-7 Mosaic · 1-8 Laboratory exam | 248 / 18 | bonus bricks, strong bricks with a number, hexagons, steel, triangles, explosive bricks, mixed shapes |
| 2 Skilled | Neon City: chrome rails with neon, lit windows | 2-1 Evening block · 2-2 Overpass · 2-3 Sticky windows · 2-4 Skyscraper · 2-5 Advance · 2-6 Bumpers · 2-7 Neon rain · 2-8 Bridge | 210 / 16 | armoured and shape-changing bricks, moving rows, parallelograms, sticky paddle, laser, harmful bonuses, shield bricks, the creeping wall, bumpers, the time bomb |
| 3 Pro | Reactor: hot metal and crystals | 3-1 Core ring · 3-2 Portals · 3-3 Regrowth · 3-4 Turbine · 3-5 Meteors · 3-6 Ghosts · 3-7 Chain reaction · 3-8 Heart of the reactor | 176 / 14 | comet ball, portals, regrowing bricks, turning bars, turned shields, the bottom shield, invisible bricks, the bomb, the core |

Bricks: ordinary, strong (the number shows the hits left), steel (never breaks, not needed to clear), explosive, shape-changing, shield (armour in front and on the sides, breaks only from behind), regrowing (comes back unless broken in a run of three), invisible, the core.
Bonuses, in marked bricks only: big paddle, slow, second ball, extra ball, laser, sticky paddle, narrow paddle and fast ball (harmful), multiball, comet, bottom shield, bomb, time bomb (a ball with a 12 s clock; its blast clears the wall around it and stuns the paddle if it is close).

**Review mode**: open the page with `#review` at the end of the address. Every level is open on the map, the N key clears a level at once, and nothing goes into the top 10.

## Style and originality

Everything is drawn in code (Canvas) and every sound is synthesised in code: no pictures, sprites, samples or tunes from anywhere else, and no elements of other brick-breaking games. Strict Content Security Policy, so the game runs inside the site at `krinkerlabs.com/play/breakwall/`. Russian or English, by the language of the browser.

## Technology

TypeScript, Canvas 2D, esbuild; one static build of three files (`app.js` is about 115 KB).

The simulation runs at a fixed 120 steps a second. The ball is checked along its whole path against convex polygons (every face and corner), round bumpers and turning bars, so a fast ball never passes through a brick of any shape.

| Folder | What it does |
| --- | --- |
| `web/data/levels-1/2/3.json` | the 24 levels |
| `web/src/levels` | the level format and its checks, grids (rectangles, hexagons, triangles, diamonds, parallelograms), shapes, tiers, the list of levels |
| `web/src/physics` | the sweep of the ball against polygons and circles, the earliest contact, the paddle bounce |
| `web/src/rules` | the game state and one step; bricks and damage, bonuses, the laser and the time bomb, the wall (moving rows, creeping, regrowing), the tray, points and stars |
| `web/src/app` | the session: the run through the levels, progress, saving, the top 10 |
| `web/src/storage`, `web/src/scores` | the browser storage, players, saved games, progress; nicknames and the top 10 |
| `web/src/render` | the three worlds, bricks, rails, icons of the bonuses, particles, the star field |
| `web/src/ui`, `web/src/input`, `web/src/audio` | panels, screens, the map, windows, texts; mouse, touch and keys; synthesised sounds |

## Development

```
cd web
npm install        # esbuild only
npm test           # 211 checks, including a test player who clears every one of the 24 levels
npm run check      # TypeScript types
npm run build      # web/dist: index.html, game.css, app.js
```

## Level format

A level is one or more blocks, each on its own grid, plus things on the field:

```json
{ "id": "1-5", "tier": 1, "name": { "en": "Honeycomb", "ru": "Соты" }, "intro": { "en": "…", "ru": "…" }, "par": 150,
  "blocks": [{ "grid": "hex", "cell": [100], "top": 140, "rows": [". a a+B a .", "b b m3 b b"] }],
  "descend": 0, "moving": [], "objects": [{ "type": "bumper", "x": 390, "y": 600, "r": 40 }] }
```

Cells: `.` empty, `a`…`h` a colour (a digit after it is the strength), `#` steel, `x` explosive, `m3` shape-changing, `s` `s<` `s>` shield (weak side up, left, right), `r` regrowing, `i` invisible, `@20` the core; `+L` puts a bonus in a brick (W N S F B M E L G C D O T).

## License

Free to play, all rights reserved: see [LICENSE](LICENSE). Videos and streams of the game are welcome.

KrinkerLabs™ is a trademark of Yurii Pavlenko. Questions and bug reports: the contact form at https://krinkerlabs.com/en/contact/
