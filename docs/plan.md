# Tiny Garden v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the page-38 lavish prototype into a Mac app that is Adil's live wallpaper and flips to a playable game on ⌥E. Ship it as the public repo `AwesomeAdil/tiny-garden`.

**Architecture:**
- **Game:** the prototype's canvas game is split into ES modules under `web/js/`. It's a DOM-free simulation (`sim/`), plus drawing (`draw/`) and UI (`ui/`). `main.js` drives it, and `node --test` tests the sim.
- **Mac app:** a SwiftPM accessory app (`Sources/TinyGarden/`) hosts `web/` in a `WKWebView` through a `garden://` URL scheme. It moves a single full-screen window between the desktop layer (wallpaper) and a raised, clickable layer (play).
- **Install:** `scripts/install` assembles `~/Applications/Tiny Garden.app` (bundle ID `local.tiny-garden`) and adds a LaunchAgent.

**Tech Stack:**
- Swift 6.3 (Command Line Tools only, AppKit + WebKit)
- Vanilla JS ES modules
- Node 26 (`node:test`) for tests
- Chrome for Testing (headless) for screenshots
- No third-party dependencies

**Spec:** `docs/superpowers/specs/2026-11-07-tiny-garden-design.md` (approved 2026-11-07). The prototype source of truth is `~/dotfiles/.lavish/tiny-garden/38-galaxy-and-homes.html` ("page 38"). **Page 38's code wins over any number in this plan or the spec.**

## Global Constraints

- macOS 26 / Apple Silicon. Swift via Command Line Tools only (no Xcode, so no XCTest). No third-party deps in Swift or JS.
- Repo at `~/Documents/dev/tiny-garden`, public remote `AwesomeAdil/tiny-garden` (created in Task 8, only after Adil OKs it). Commit after every task. Never `git add -A`; add named paths.
- **Pixel-art rule:**
  - Every UI icon is a 12px pixel map in the shared palette.
  - Frames are square and beveled (`.px`), and lettering is monospace.
  - **No emoji. No rounded or system-styled controls.**
  - Scaling is nearest-neighbour only (`image-rendering: pixelated`), at an integer scale.
- **Porting rule:**
  - Port page 38's functions verbatim, with the global context made explicit:

    | Page 38 global | Becomes |
    |---|---|
    | `S` | `w.S` |
    | `hub` | `w.hub` |
    | `ISL` | `w.def.isl` |
    | `GOAL` | `w.def.goal` |
    | `TANG` | `w.TANG` |
    | `HOP` | `w.HOP` |
    | `WD` | `w` |
    | `CABLES` | `game.cables` |
    | `UI` | `game.ui` |

  - Every `OPT.*` switch is **on**: delete its off branches and the `IDEAS`/switches panel.
  - `say(msg,warn)` inside the sim becomes `w.events.push({msg,warn})`.
- **Constants (verbatim):**

  | Name | Value |
  |---|---|
  | `CARRY` | 3 |
  | `KEEP` | 4 |
  | `CAPP` | 20 |
  | `MAXR` | 112 |
  | `SPEED` | 24 |
  | `LVM` | `[1,1.5,2]` |
  | `MOVEPX` | 12 |
  | Level-up | `grow += dt/45` |
  | Gentle (unmet needs) | ×0.35 |
  | Neighbour bonus | +0.25 |
  | World bonus | ×1.5 |
  | `ropeCost(d)` | `max(1, round(d*d/1000))` |
  | `ropeUp(len)` | `.2+len/150` |
  | Island upkeep | `(level-1)*.35` |
  | Patch kit | `×(1-.25*patch)`, at most 2 |
  | Slots | island 3, town square 4, +`dock` |
  | Crowding | `÷(1+.35*(crowdA+crowdB))` |
  | Quick walker | ×1.5 |
  | Unpaid upkeep | ×0.5 |
  | Hub reserve | `ceil(upkeep().all)` Rock |
  | Star block | `nearStarS<15` |

- **Time:**
  - The sim steps in 0.1 s sub-steps from wall-clock deltas.
  - Any gap (sleep, quit, throttling) is capped at **43200 s (12 h)**. A negative gap counts as 0.
  - The 1×/4× `speed` applies **only in play mode**, and resets to 1× when play ends.
- **Modes:**
  - **Wallpaper:** desktop window level, ignores the mouse, never key or active, about 10 fps, world only (no dock/panel/guide/stock/hint).
  - **Play:** raised, clickable, full rate, frame = main screen minus the top **38 pt** (sketchybar height, env `TINY_GARDEN_TOP_INSET` overrides).
- **Save:** `~/Library/Application Support/tiny-garden/save.json`, written atomically by Swift. Saved every 30 s, on mode change, and on quit. `SAVE_VERSION = 1`. New map keeps `save.prev.json`. An unreadable save is renamed `save.bad.json` and a new game starts.
- **Keys:**
  - ⌥E toggles (via skhd → `tiny-garden toggle`).
  - Esc backs out one step at a time: cancel drag → close shop → clear selection → exit to wallpaper.
  - In play mode: M/R/C pick a tool, S opens the shop, 1/2/3 and Tab switch views.
- **Built to grow (Adil's ask: "make sure we can make updates later").**
  - Planets, islands, goals, shop items and galaxy stars are **data** in `web/js/sim/content.js`.
  - Worlds come from an ordered `WORLD_DEFS` list. Each def names its `next` world key, or `null`.
  - `launch()` starts `def.next`, so no code path names TIDE, CINDER or an island id except through content. The prototype's `home`/`lavaW` refs become `game.worlds[i]`.
  - Adding RIME later means adding a def and its islands, nothing else.
  - The save carries `v`, and `deserialize` runs `migrate(obj)` (v1 is identity), so later versions can upgrade old saves instead of wiping them.
- **Aesthetics are guarded.**
  - Task 5 writes `docs/ART.md`: the palette, the 12px icon grid and how to add an icon, the `.px` frame rules, integer scaling, no emoji or rounded widgets, and where each art routine lives.
  - Every task that touches drawing or UI (5, 6, 7) is reviewed against the page 38 screenshots, `~/dotfiles/.lavish/tiny-garden/img/live-*.png`.
  - A visible drift from page 38 is a failing review.
- **v1 ends at CINDER's cable.** Launching it says "the next planet comes later". RIME/TEMPEST and other stars stay visible but unreachable.

## Review Focus

1. **Desktop clicks in wallpaper mode** must reach Finder (icons, right-click, drag-select), and the garden must never take focus. The manual check is in Task 7, Step 6.
2. **Corrupt, empty or half-written save** (power loss): the app must start, keep the bad file as `save.bad.json` and begin a new game, never crash or show a blank screen. Tested in Task 4 and Task 7.
3. **Clock jumps:** `savedAt` in the future, or the system clock moved back, must simulate 0 s, not a negative gap or a hang. Tested in Task 3.
4. **Display changes** (resolution change, external display plugged in or out, lid closed): the window refits the current main screen, keeping the integer scale and starfield margins. Covered in Task 7.
5. **⌥E when the app isn't running** (crashed, or not yet started): it launches the app straight into play mode, instead of doing nothing. Covered in Task 7.

---

## File map

```
tiny-garden/
  README.md  LICENSE (MIT)  .gitignore  package.json ({"type":"module","scripts":{"test":"node --test tests/"}})
  docs/  design.md (moved spec)  plan.md (this plan)  TIMINGS.md
  web/
    index.html            markup: #sky canvas, #stage{#map canvas, #tags, #price, #where}, #side{#view canvas, #vlbl, #panel}, #dock, #guide, #stock, #hint
    style.css             Macchiato tokens + .px/.dk/.act/.shopi/.price/.ntag styles from page 38
    js/core/pixel.js      TAU rgb mix u32 ramp P clamp rngf B8 NZ NN  (page 38 helpers + dawn noise)
    js/core/palette.js    RES COL NAME PAL UPAL KD R_ARM R_IN R_CORE R_TEAL R_PINK SURF
    js/core/icons.js      ICON UICON GOODS maps; iconURL(k) uiconURL(k) goodsCanvas(k)  (DOM)
    js/sim/content.js     ISL_OCEAN ISL_LAVA DEF_OCEAN DEF_LAVA SYS_EXTRA(RIME,TEMPEST) GSYS_NAMES + all constants
    js/sim/world.js       layout makeWorld node isl dist tie
    js/sim/graph.js       cross tangled nbrs allPairs hops nextHop
    js/sim/economy.js     needs transit wants surplus destFor met boost ropesAt slots crowd ropeUp upkeep incomeMin ropeSpeed rateOf ropeCost
    js/sim/step.js        step
    js/sim/system.js      sysPos nearStarS cableGeom wantsFrom stepCables stepAll sysPlanets
    js/sim/shop.js        SHOP_ITEMS canBuy buy launch
    js/sim/game.js        newGame advance catchUp
    js/sim/save.js        SAVE_VERSION serialize deserialize
    js/draw/scene.js      sky pxTree lantern tuft firefly bridgeOut island levelDeco piles  (+ star planet rock bg pt walker stream)
    js/draw/map.js        drawMap ropeDraw reachRing geomR
    js/draw/closeup.js    dawn planetView islandView bridgesOut
    js/draw/system.js     drawSystem tube orb sysAt
    js/draw/galaxy.js     galInit drawGalaxy gpos galAt blackHole
    js/ui/esc.js          escAction  (pure)
    js/ui/input.js        toMap nodeAt ropeAt constrain pointer handlers, move cost
    js/ui/tags.js         renderTags pips
    js/ui/price.js        renderPrice rockRow
    js/ui/panel.js        renderPanel shopHTML ledgerHTML renderStock
    js/ui/guide.js        guideText renderGuide say idleHint
    js/ui/dock.js         dock buttons, keyboard, setTool setShop goView
    js/main.js            boot, loop, modes, scaling, bridge (window.garden)
  tests/  helpers.js world.test.js economy.test.js step.test.js system.test.js shop.test.js game.test.js save.test.js esc.test.js
  scripts/serve.mjs       tiny static server for web/ (node:http)
  scripts/shot.mjs        headless Chrome screenshots of web/ at given URL params
  scripts/install         build + assemble .app + LaunchAgent + ~/.local/bin/tiny-garden
  Package.swift
  Sources/TinyGarden/  main.swift Control.swift GardenWindow.swift WebHost.swift SaveStore.swift Lifecycle.swift
  support/Info.plist  support/local.tiny-garden.plist
```

**Shared shapes** (all tasks use these names):

```js
// World (makeWorld): { def, POS, S, hub, TANG:Set<ropeId>, HOP:{[id]:{[id]:hops}}, started:bool, events:[{msg,warn}] }
// S: { time, nodes:Node[], ropes:Rope[], sel:{t:'node'|'rope',id}, cable:bool, cableT, found:Set<id>,
//      inLog:[[time,k]], upAcc, unpaid:bool, patch:0..2, survey:bool, nextId }
// Node: { id, kind:'planet'|'island', x, y, r, stock:{rock,heat,water,light,growth,tools}, level?, grow?, use?, acc?, dock?, seed? }
// Rope: { id, a, b, len, u, dir, load:[{k,d}], next, fast? }
// Game: { seed, worlds:[tide, cinder], cables:[{a:0,b:1,u,dir,load:[k],blocked}],
//         ui:{ view:'planet'|'system'|'galaxy', world:0|1, speed:1|4, pri:'auto'|k, sysSel:null|name, galSel:null|name }, savedAt:ms }
```

---

### Task 1: Repo, content, world and graph

**Files:**
- Create: `package.json`, `.gitignore`, `LICENSE`, `docs/TIMINGS.md`, `web/js/core/pixel.js`, `web/js/core/palette.js`, `web/js/sim/content.js`, `web/js/sim/world.js`, `web/js/sim/graph.js`
- Test: `tests/helpers.js`, `tests/world.test.js`

**Interfaces:**
- Produces:
  - `pixel.js`: `rngf(seed)→()=>number` and `clamp(v,a=0,b=1)`. They're DOM-free, so the sim can use them.
  - `content.js`: `ISL_OCEAN`, `ISL_LAVA`, `DEF_OCEAN`, `DEF_LAVA` (page 38 lines 108–122 and 165–166, minus `surf` canvas refs), `SYS_EXTRA`, `GSYS_NAMES`, the constants table.
  - `world.js`:
    - `layout(seed:number, ids:string[], start:string) → {[id]:[x,y]}`
    - `makeWorld(def, seed:number) → World` (hub at 160,100, r 16, rock 10; started false)
    - `node(w,id) → Node|undefined`
    - `isl(w) → Node[]`
    - `dist(a,b) → number`
    - `tie(w,a:Node,b:Node) → Rope` (`len = min(MAXR, dist+12)`, `id = w.S.nextId++`)
  - `graph.js`:
    - `cross(p,q,r,s) → bool`
    - `tangled(w) → Set`
    - `nbrs(w,id) → id[]`
    - `allPairs(w)` (sets `w.HOP`)
    - `hops(w,a,b) → number` (Infinity if unreachable)
    - `nextHop(w,from,to) → id|undefined`
  - `tests/helpers.js`:
    - `freshGame(seed)`, from Task 3. Until then it's `makeWorld(DEF_OCEAN, seed)` wrapped as `{worlds:[w]}`.
    - `autoNet(w)`: the greedy nearest-reachable tie loop from page 38 `autoNet`, respecting slots and crossings.
    - `sim(game, seconds)`

- [ ] **Step 1:** `mkdir ~/Documents/dev/tiny-garden && cd $_ && git init -b main`. Write `package.json`, `.gitignore` (`.build/`, `*.png` under `shots/`), MIT `LICENSE` (Adil Bhatti), and `docs/TIMINGS.md` (the header row from the estimating-time skill).
- [ ] **Step 2: Write failing tests** in `tests/world.test.js`:
  ```js
  test('layout places every island inside the map, 46px apart, all reachable from the planet', () => {
    for (const seed of [1,2,3,4,5]) { const pos = layout(seed, Object.keys(ISL_OCEAN), 'home');
      assert.equal(Object.keys(pos).length, 6);
      for (const [x,y] of Object.values(pos)) { assert.ok(x>=22 && x<=298 && y>=26 && y<=182); }
      /* BFS from [160,100] with step <= MAXR-8 reaches all 6 */ } });
  test('makeWorld starts with the planet, the start island found, 10 Rock', () => {
    const w = makeWorld(DEF_OCEAN, 7); assert.equal(w.hub.stock.rock, 10); assert.deepEqual([...w.S.found].sort(), ['home','planet']); });
  test('tie caps length at MAXR and gives unique ids', () => { /* two ties: ids differ, len === Math.min(112, dist+12) */ });
  test('tangled flags crossing ropes only', () => { /* place 4 nodes in an X: both ids in tangled(w); share an endpoint: empty */ });
  test('hops and nextHop follow the rope graph', () => { /* planet-home-ember chain: hops(w,'planet','ember')===2, nextHop(w,'planet','ember')==='home', unreachable → Infinity */ });
  ```
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `pixel.js` (DOM-free parts only), `palette.js`, `content.js`, `world.js` and `graph.js` by porting page 38.
- [ ] **Step 5:** Run `npm test`. Expected: PASS (5 tests).
- [ ] **Step 6:** `git add package.json .gitignore LICENSE docs tests web && git commit -m "feat: world, layout and rope graph"`

### Task 2: Economy and the island step

**Files:**
- Create: `web/js/sim/economy.js`, `web/js/sim/step.js`
- Test: `tests/economy.test.js`, `tests/step.test.js`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces, in `economy.js`:
  - `ropeCost(d) → int`
  - `ropeUp(len) → number`
  - `upkeep(w) → {b,i,all}`
  - `surplus(w,n,k)` (town square keeps `ceil(upkeep(w).all)` Rock)
  - `destFor(w,X,k) → id|null`
  - `met(w,n) → bool`
  - `boost(w,n) → number`
  - `rateOf(w,n) → number`
  - `ropesAt(w,id) → int`
  - `slots(n) → int`
  - `crowd(w,n) → int`
  - `ropeSpeed(w,r) → number`
  - `incomeMin(w,k) → int`
  - also `needs`, `transit` and `wants`, all `(w,…)`
- Produces, in `step.js`: `step(w, dt)`. It's page 38 `step()`, including discovery, production, growth, walkers, inLog, upkeep and fraying. Messages go to `w.events`.

- [ ] **Step 1: Write failing tests:**
  ```js
  test('rope cost grows with the square of length', () => assert.deepEqual([30,50,70,90,110].map(ropeCost), [1,3,5,8,12]));
  test('upkeep: bridges by length, islands by level, patch kit', () => { /* 1 rope len 60 → b≈.6; one found island level 3 → i=.7; S.patch=1 → all ×.75 */ });
  test('slots and crowding', () => { /* 5 ropes on planet: slots 4, crowd 1; ropeSpeed of a planet rope = 1/1.35; with r.fast → 1.5/1.35; S.unpaid → ×.5 */ });
  test('town square keeps a minute of upkeep before sharing Rock', () => { /* hub rock 10, upkeep all 3.2 → surplus(w,hub,'rock') === 6 */ });
  test('gentle: unmet needs run at 0.35', () => { /* home with no water: rateOf === .5*.35*1.0 (home makes rock; TIDE bonusKind water → ×1) */ });
  test('goods go where they are asked for', () => { /* tie planet-home, home-amethyst; amethyst found, rock 0; sim 90 s → amethyst.stock.rock > 0 */ });
  test('a thriving island levels up every 45 s', () => { /* home with water 50: step 46 s → level 2; 91 s → level 3; never above 3 */ });
  test('unpaid upkeep frays bridges, paying again mends them', () => { /* hub rock 0, 3 ropes, step until w.S.unpaid; then hub.stock.rock=20; step 30 s → unpaid false; events include both messages */ });
  test('a full city stays solvent for 15 minutes', () => { for (const seed of [1,2,3,4,5]) { /* autoNet, hub rock 10, sim 900 s: unpaid false, ≥5 islands at level 3 */ } });
  ```
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `economy.js` and `step.js` by porting page 38 lines 186–222.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. If the solvency test fails for a seed, compare with page 38 run in a browser on that seed before changing any number. The code wins, and the test asserts it.
- [ ] **Step 5:** `git add web/js/sim tests && git commit -m "feat: economy, upkeep, crowding and the island step"`

### Task 3: Solar system, cables, shop, game and time

**Files:**
- Create: `web/js/sim/system.js`, `web/js/sim/shop.js`, `web/js/sim/game.js`
- Test: `tests/system.test.js`, `tests/shop.test.js`, `tests/game.test.js`

**Interfaces:**
- Produces, in `system.js`:
  - `sysPlanets(game) → [{w|null,name,full,surfKey,R,v,a,r}]` (TIDE, CINDER, RIME, TEMPEST)
  - `sysPos(p,t) → [x,y]`
  - `nearStarS(A,B) → number`
  - `cableGeom(game,cb) → {A,B,L,blocked}`
  - `wantsFrom(game,wi,k) → bool`
  - `stepCables(game,dt)`
  - `stepAll(game,dt)`

  The orbit time is `game.worlds[0].S.time`.
- Produces, in `shop.js`:
  - `SHOP_ITEMS: [{id:'cable'|'dock'|'fast'|'survey'|'patch', icon, name, what(game,w)→string, cost(game,w)→{k:n}, target:'none'|'node'|'rope', can(game,w,t)→bool}]`
  - `canBuy(game,w,id,target) → bool`
  - `buy(game,w,id,target) → bool`
  - `launch(game,w)`. On TIDE it starts CINDER, ties CINDER's hub to `ash`, and pushes cable `{a:0,b:1,...}`. On CINDER it only sets `S.cable` and the event "Cable launched. The next planet comes later."
- Produces, in `game.js`:
  - `newGame(seed) → Game`. TIDE is started with `tie(hub, home)`. CINDER exists, not started.
  - `advance(game, realSec, mode:'wallpaper'|'play')`. It steps `realSec × (mode==='play' ? game.ui.speed : 1)` in 0.1 s sub-steps.
  - `catchUp(game, nowMs) → seconds`. `elapsed = clamp((nowMs-game.savedAt)/1000, 0, 43200)`. It advances that much in wallpaper mode and sets `savedAt = nowMs`.

- [ ] **Step 1: Write failing tests:**
  ```js
  test('the star blocks a cable that passes close to it', () => { /* A=[100,100],B=[220,100] → nearStarS 0 → cableGeom blocked; A=[100,40],B=[220,40] → not blocked */ });
  test('the cable carries Growth to CINDER, which cannot make it', () => { /* newGame, give TIDE hub goal stock, buy cable; TIDE hub growth 10; advance up to 600 s → cinder hub growth > 0 */ });
  test('cable priority sends the chosen good first', () => { /* ui.pri='rock' and both rock and growth wanted → first load is rock */ });
  test('each shop item does what it says', () => { /* dock: slots +1 and 4 Rock + 2 Tools taken; fast: ropeSpeed ×1.5; survey: S.survey; patch: upkeep ×.75, third buy refused; any item unaffordable → canBuy false and nothing taken */ });
  test('v1 ends at CINDER\'s cable', () => { /* launch on cinder: S.cable true, no new world started, events say "the next planet comes later" */ });
  test('a new world needs only content', () => { /* newGame with WORLD_DEFS + a test-only third def (2 islands) and CINDER.next='test': launching on CINDER starts it, adds cable {a:1,b:2}, and serialize→deserialize keeps it */ });
  test('catch-up equals playing it live', () => { /* two newGame(3)+autoNet; A: advance(A,600,'wallpaper') ; B: 6000× advance(B,.1,'wallpaper') → deepEqual(serialize(A,0), serialize(B,0)) */ });
  test('catch-up is capped at 12 hours and never runs backwards', () => { /* savedAt now-48h → returns 43200; savedAt in the future → returns 0 and time unchanged */ });
  test('4× only counts in play mode', () => { /* speed 4: advance(g,10,'play') → +40 s; advance(g,10,'wallpaper') → +10 s */ });
  ```
  (`serialize` comes from Task 4. Until then, write this test with `structuredClone`-safe JSON of `game.worlds.map(w=>w.S)`, and switch it to `serialize` in Task 4.)
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the three modules by porting page 38: system (lines 224–237), `SHOP`/`buy`/`launch` (392–402), and `skip`/`autoNet` (504–505, kept only as test helpers and a dev `?skip=1` path).
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** `git add web/js/sim tests && git commit -m "feat: solar system, cables, shop and wall-clock time"`

### Task 4: Save format

**Files:**
- Create: `web/js/sim/save.js`
- Test: `tests/save.test.js`

**Interfaces:**
- Produces:
  - `SAVE_VERSION = 1`
  - `serialize(game, nowMs) → plain object`. It's JSON-safe: Sets become arrays, and it carries `{v:1, savedAt:nowMs, seed, worlds:[{key, started, S, hub-is-node-0}], cables, ui}`.
  - `deserialize(obj) → Game | null`. It returns null if `v !== 1`, if worlds don't match `DEF_OCEAN`/`DEF_LAVA` keys, or if it throws. `TANG`/`HOP` are rebuilt by `allPairs`, and `def` is reattached from content.

- [ ] **Step 1: Write failing tests:**
  ```js
  test('a save loads back exactly', () => { /* newGame(5), autoNet, buy dock+fast, advance 300 → JSON round trip → deepEqual(serialize(back,1), serialize(g,1)) */ });
  test('a loaded game keeps playing the same as the original', () => { /* advance both 120 s → equal */ });
  test('garbage, wrong version and empty saves are refused', () => { for (const bad of [null, {}, {v:2}, 'x', {v:1,worlds:[]}]) assert.equal(deserialize(bad), null); });
  ```
  Then switch Task 3's equivalence test to `serialize`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`. Expected: all PASS.
- [ ] **Step 5:** `git add web/js/sim/save.js tests && git commit -m "feat: versioned save format"`

### Task 5: Drawing (art ported from page 38)

**Files:**
- Create: `web/js/core/icons.js`, `web/js/draw/scene.js`, `web/js/draw/map.js`, `web/js/draw/closeup.js`, `web/js/draw/system.js`, `web/js/draw/galaxy.js`, `scripts/serve.mjs`, `scripts/shot.mjs`, and a temporary `web/art.html` (renders one view per URL param)

**Interfaces:**
- Consumes: the sim (read-only) and `core/*`.
- Produces:
  - `drawMap(ctx, game, w, t, input)`, where `input = {drag, pointer, tool}`
  - `drawSystem(ctx, game, t, sel)`
  - `drawGalaxy(ctx, t, sel)`
  - `planetView(ctx, game, w, t)`
  - `islandView(ctx, w, n, t)`
  - `galAt(p, t)`
  - `sysAt(game, p)`
  - `iconURL(k)`, `uiconURL(k)`, `goodsCanvas(k)`

  Map 320×200, view 200×120.
- Draw functions never mutate sim state.

- [ ] **Step 1:** Write `scripts/serve.mjs`. It serves `web/` on `http://127.0.0.1:${PORT||4390}` with correct MIME types for .js, .css, .html and .png.
- [ ] **Step 2:** Write `scripts/shot.mjs <url-params> <out.png>`. It runs Chrome for Testing at `$CHROME`, defaulting to `~/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, with `--headless=new --virtual-time-budget=4000 --screenshot`.
- [ ] **Step 3:** Port the art modules from page 38 (helpers, scene, island, levelDeco, goods, ropeDraw, reachRing, drawMap, dawn, planetView, islandView, bridgesOut, drawSystem, tube, orb, galaxy).
- [ ] **Step 4:** Write `web/art.html`. It reads `?seed&view=city|system|galaxy|close&skip=1`, builds a game with the sim plus `autoNet`, and draws one frame.
- [ ] **Step 5: Verify.** Shoot all four views and compare by eye with `~/dotfiles/.lavish/tiny-garden/img/live-{city,system,galaxy,closeup}.png`. Expected: the same art, with the same islands, decorations, goods, flags, piers, galaxy shape and orbits. The layouts may differ. Also check there are no console errors.
- [ ] **Step 6:** Write `docs/ART.md` with the rules listed under Global Constraints, "Aesthetics are guarded". Include a worked example: adding a 12px icon to `UICON`.
- [ ] **Step 7:** `git add web/js/core/icons.js web/js/draw scripts web/art.html docs/ART.md && git commit -m "feat: port the pixel art and views"`

### Task 6: The game screen, modes and bridge (JS side)

**Files:**
- Create: `web/index.html`, `web/style.css`, `web/js/ui/{esc,input,tags,price,panel,guide,dock}.js`, `web/js/main.js`
- Delete: `web/art.html`
- Test: `tests/esc.test.js`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `escAction({drag, shop, sel}) → 'cancel-drag'|'close-shop'|'clear-selection'|'exit'`. `sel` counts as set when it isn't the town-square default.
  - `window.garden = { boot(saveObj|null, mode, nowMs), setMode('wallpaper'|'play'), pause(), resume(), saveNow() → object }`.
  - JS → Swift: `webkit.messageHandlers.garden.postMessage({type:'ready'} | {type:'save', save} | {type:'exit'} | {type:'bad-save'} | {type:'new-map'})`.
  - **Standalone mode** (no `webkit` object, for shots and dev): it boots from URL params `?seed&mode&view&skip`.

- [ ] **Step 1: Write the failing test:**
  ```js
  test('Esc backs out one step at a time', () => {
    assert.equal(escAction({drag:{}, shop:true, sel:{t:'node',id:'ember'}}), 'cancel-drag');
    assert.equal(escAction({drag:null, shop:true, sel:{t:'node',id:'ember'}}), 'close-shop');
    assert.equal(escAction({drag:null, shop:false, sel:{t:'node',id:'ember'}}), 'clear-selection');
    assert.equal(escAction({drag:null, shop:false, sel:{t:'node',id:'planet'}}), 'exit'); });
  ```
- [ ] **Step 2:** Run `npm test`. Expected: FAIL. Implement `esc.js`. Run `npm test`. Expected: PASS.
- [ ] **Step 3:** Port the UI modules from page 38: dock with pixel icons and groups (Build / Spend / View / Time, plus New map), tags and pips, price tag, panel (island, bridge, town square with ledger, shop, system with cable priority, galaxy), guide, hint and input including move cost. Drop Skip from the dock (it stays `?skip=1`). **New map** asks for confirmation once with an in-world pixel prompt, never `confirm()`, then posts `new-map`.
- [ ] **Step 4:** Implement the `main.js` loop and modes.
  - **Clock:** `Date.now()` deltas go to `advance(game, dt, mode)`. Any gap over 1 s goes to `catchUp`.
  - **Drawing:** every 100 ms in wallpaper mode, every 50 ms in play mode, never while paused.
  - **Saving:** post `save` every 30 s and on every `setMode`.
  - **Wallpaper mode:** add `body.wallpaper`, which hides the dock, side panel, guide, stock and hint. Keep the tags and `#where`. Show the small pixel `⌥E PLAY` tag while `firstSeen` is within 3 days (stored in `game.ui.firstSeen`).
  - **Scale:** `#map` uses the largest integer scale that fits the stage, in device pixels. `#sky` fills the rest with the same starfield. Tags and the price tag scale with a CSS var `--s`.
  - **Feels native:** in CSS, `user-select:none`, `overscroll-behavior:none`, `-webkit-touch-callout:none`. In JS, `contextmenu` is prevented.
  - **Speed:** resets to 1 when the mode leaves play.
- [ ] **Step 5: Verify.**
  - `node scripts/serve.mjs &`.
  - Shoot `?seed=3&mode=play&view=planet`, `?seed=3&mode=play&view=galaxy&skip=1`, `?seed=3&mode=wallpaper&view=planet` and `?seed=3&mode=wallpaper&view=system&skip=1`, each at `--window-size=1512,944` and `2560,1600`.
  - Expected: play mode shows the dock, map and side panel in pixel style with no emoji. Wallpaper mode shows only the world, crisp, with no menus. The 1512 shot has starfield margins, not stretching.
  - Run `npm test`. Expected: all PASS.
- [ ] **Step 6:** `git add web tests && git rm web/art.html && git commit -m "feat: game screen, wallpaper/play modes and Swift bridge"`

### Task 7: The Mac app

**Files:**
- Create: `Package.swift` (executable `tiny-garden`, macOS 14+), `Sources/TinyGarden/{main,Control,GardenWindow,WebHost,SaveStore,Lifecycle}.swift`, `support/Info.plist`, `support/local.tiny-garden.plist`, `scripts/install`

**Interfaces:**
- Consumes: the Task 6 bridge (exact message types and the `window.garden` methods).
- Produces:
  - **CLI:**
    - `tiny-garden` runs the app.
    - `tiny-garden toggle` posts the distributed notification `local.tiny-garden.toggle`. If no running app has bundle ID `local.tiny-garden`, it runs `open -b local.tiny-garden --args --play`.
    - `tiny-garden quit` posts `local.tiny-garden.quit`.
    - `tiny-garden selftest` exits 0 or 1.
    - The `--skip` flag passes `?skip=1`.
  - **`enum Mode { case wallpaper, play }`** with `GardenWindow.apply(_ mode: Mode, screen: NSScreen)`:
    - **Wallpaper:** level `CGWindowLevelForKey(.desktopWindow)`, `ignoresMouseEvents=true`, behavior `[.canJoinAllSpaces,.stationary,.ignoresCycle]`, frame = `screen.frame`.
    - **Play:** level `.floating`, `ignoresMouseEvents=false`, behavior `[.canJoinAllSpaces,.fullScreenAuxiliary]`, frame = `screen.frame` minus the top `TINY_GARDEN_TOP_INSET`, which defaults to 38. It calls `makeKeyAndOrderFront` and `NSApp.activate`.
  - **`WebHost`:**
    - A `WKURLSchemeHandler` for `garden://app/…` serves files from `Bundle.main.resourceURL/web`.
    - A `garden` message handler.
    - Magnification and back/forward gestures are disabled, and the page background is opaque `#14151f`.
  - **`SaveStore(dir)`:**
    - `load() → Data?`
    - `write(_ Data)`, atomic, via `Data.write(options:.atomic)`
    - `archive()` renames `save.json` → `save.prev.json`
    - `quarantine()` renames `save.json` → `save.bad.json`
  - **`Lifecycle`:**
    - It handles `NSWorkspace` `screensDidSleep`/`screensDidWake`, `sessionDidResignActive`/`BecomeActive`, the window's `didChangeOcclusionState` and `NSApplication.didChangeScreenParametersNotification`.
    - It calls JS `garden.pause()`/`resume()` and re-applies the mode on screen change.
    - It remembers `NSWorkspace.shared.frontmostApplication` before play and re-activates it on exit.
    - On quit it calls `garden.saveNow()` and writes the result before terminating.

- [ ] **Step 1:** Write `SaveStore.swift` and a `selftest` path in `Control.swift`. It runs in a temp dir: write, load, check equality, archive, and quarantine a garbage file. It prints `selftest ok` and exits 0. Run `swift build && .build/debug/tiny-garden selftest`. Expected: `selftest ok`.
- [ ] **Step 2:** Implement `GardenWindow`, `WebHost`, `Lifecycle` and `main.swift`.
  - **`main.swift` setup:**
    - It sets the accessory activation policy.
    - It creates the window in wallpaper mode.
    - It loads `garden://app/index.html` (with `?skip=1` when `--skip` is passed).
  - **On `ready`:** call `garden.boot(<save or null>, mode, Date.now)`. If `--play` was passed, the mode is play.
  - **Messages from JS:**

    | Message | Action |
    |---|---|
    | `save` | write the save |
    | `exit` | apply wallpaper mode and restore the previous app |
    | `bad-save` | quarantine the file |
    | `new-map` | archive the old save |

  - **Notifications:** `toggle` flips the mode, and `quit` saves and terminates.
- [ ] **Step 3:** Write `scripts/install`. It runs `swift build -c release`, then assembles `~/Applications/Tiny Garden.app`:
  - `Contents/MacOS/tiny-garden`
  - `Contents/Info.plist` from `support/` (`CFBundleIdentifier local.tiny-garden`, `LSUIElement true`, `CFBundleName Tiny Garden`)
  - `Contents/Resources/web/` (rsync of `web/`)

  It then:
  - symlinks `~/.local/bin/tiny-garden` to that binary
  - installs `support/local.tiny-garden.plist` (`RunAtLoad`, `KeepAlive {SuccessfulExit:false}`, log at `~/.local/state/tiny-garden/log`) into `~/Library/LaunchAgents/`
  - runs `launchctl bootout` (ignoring errors) and then `bootstrap gui/$UID`

  It must be idempotent.
- [ ] **Step 4:** Run `scripts/install`. Expected: the wallpaper appears within 2 s, and `tiny-garden toggle` switches it into play and back.
- [ ] **Step 5:** Check that the app recovers from a bad save. Run `tiny-garden quit`, then `echo garbage > ~/Library/Application\ Support/tiny-garden/save.json`, then `launchctl kickstart gui/$UID/local.tiny-garden`. Expected: a new game starts, and `save.bad.json` exists.
- [ ] **Step 6: Manual checks, done with Adil** (record pass or fail in the commit message):
  1. In wallpaper mode, desktop clicks, right-clicks and drag-select reach Finder, and focus never moves to the garden.
  2. ⌥E (or `tiny-garden toggle`) opens play mode and Esc steps back. Exiting returns focus to the previous app.
  3. It shows on every Space. In a full-screen app it isn't visible as wallpaper, but `toggle` shows play mode over it.
  4. Changing resolution or plugging a display in refits the window to the main screen with crisp pixels.
  5. `tiny-garden toggle` with the app quit launches it straight into play.
  6. After 2 minutes in wallpaper mode, `top -l 2 -pid $(pgrep -x tiny-garden) -stats cpu` shows under about 5% CPU. Log the number in `docs/TIMINGS.md`.
  7. Quit and relaunch: the city is where it was, plus catch-up.
- [ ] **Step 7:** `git add Package.swift Sources support scripts/install docs/TIMINGS.md && git commit -m "feat: Mac app with wallpaper and play modes"`

### Task 8: Publish and wire into the desktop

**Files:**
- Create: `README.md`, `docs/design.md` and `docs/plan.md` (moved from dotfiles `docs/superpowers/{specs,plans}/`)
- Modify (dotfiles repo): `skhd/skhdrc`, `bin/look-overlays`

**Interfaces:**
- Consumes: the `tiny-garden toggle` CLI from Task 7.

- [ ] **Step 1:** Write `README.md`. It has a one-line pitch, a pixel gif (`scripts/shot.mjs` frames, or a 10 s screen recording of the wallpaper turning into play), build and install steps, and the keys. It never uses emoji.
- [ ] **Step 2:** `git mv` the spec and plan into `docs/`, with dotfiles copies left as one-line pointers. Commit.
- [ ] **Step 3:** **Ask Adil before publishing.** On his OK, run `gh repo create AwesomeAdil/tiny-garden --public --source . --push`.
- [ ] **Step 4:** In dotfiles, add `alt - e : $HOME/.local/bin/tiny-garden toggle` to `skhd/skhdrc`, with a full path and bare env per that file's conventions. Add the row `tiny-garden|Tiny Garden|🌱|tiny-garden toggle|garden, wallpaper, game` (every Look row has an emoji icon; that is Look's list, not the game UI, so the pixel rule doesn't apply) to `bin/look-overlays` ROWS. Run `bats test/skhd.bats test/look-overlays.bats`. Expected: PASS. Reload skhd. Stage only these two files and commit on a branch.
- [ ] **Step 5:** Ask Adil to add `local.tiny-garden` to OmniWM's excluded apps in **OmniWM's Settings window** (never hand-edit `omniwm/settings.toml`). Then recheck Task 7, Step 6, items 1–2.
- [ ] **Step 6:** Run `projects set "tiny garden" code=~/Documents/dev/tiny-garden repo=https://github.com/AwesomeAdil/tiny-garden stage=building`, then `projects check`. Expected: `ok`. Run `session-milestone "tiny garden v1 shipped"`.
