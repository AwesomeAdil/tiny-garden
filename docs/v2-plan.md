# tiny garden v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn v1's seven-goods economy into v2's "islands you shape". It has three goods used on arrival, free bridges limited by reach and piers, four island stages with spots and picks, rare events that leave gifts, and new storybook art at a finer pixel scale.

**Architecture:** Rework v1 in place, on branch `v2`. The Swift shell, the bridge, the clock, the modes and the install stay. The sim (`web/js/sim/`) is rebuilt as small DOM-free modules (world, graph, flow, grow, town, events, save). Drawing moves to a pixel kit ported from mockup page 45 (`web/js/draw/kit.js`) and a new horizon city view. The play UI (panel, pick card, gift tray) is rebuilt on v1's pixel-UI style.

**Tech Stack:** Plain ES modules, no dependencies. Tests use `node --test`. Rendering is canvas, plus v1's `PixCtx` software context for wallpaper frames. Swift 5 / AppKit / WKWebView for the shell. Screenshots use headless Chrome via `scripts/shot.mjs`.

**Spec:** `docs/v2-design.md` (approved 2026-11-07, lavish page 46). The v1 design `docs/design.md` still holds for everything v2 doesn't change.

**Mockup source of truth:** `~/dotfiles/.lavish/tiny-garden/45-storybook-mix.html`. Its inline `<script>`, lines ~100–380, is the pixel kit: `skyLayer`, `STY` (use `mixA`), `glowAt`, `PROPS`, `makeIsland`, `drawIsland`, `span`, `plank`, `astro`, `planetLayer`. Page 45 also has the arc connections (`sc-arc`) and the Horizon layout (`lay-h`). For the whale, traveller and aurora animations, see `44-step-back.html` (`ev-whale`, `ev-trav`, `ev-aurora`).

## Global Constraints

- Work on branch `v2` in `~/Documents/dev/tiny-garden`. Never push or publish without Adil's explicit OK.
- No dependencies are added. `package.json` keeps `"test": "node --test tests/"`.
- **Goods:** exactly three, `water`, `light`, `stone`. They are never drawn on islands, only as a walker's backpack colour.
- The sim is DOM-free and deterministic for a given seed. Drawing reads the game and never writes to it (main.js `dump()` checks this).
- **World:** a fixed `W = 640, H = 300` world units for positions, reach and saves.
- **Pixel scale:** `s = max(2, round(stageDeviceHeight / 480))`, then lowered by 1 until the canvas (`floor(dW/s) × floor(dH/s)`) is at least 640×300, never below 1.
- **UI:** pixel art only, on v1's icon grid. No emoji, no rounded widgets, no text labels in the wallpaper's corners (no view title, no ⌥E hint).
- **Island art:** "Storybook + warm light" (`STY.mixA`): a dark outline, bright flat colours, and a warm `#f5a97f` rim on the side facing the sun.
- **CPU:** wallpaper mode stays within v1's budget, about 5% aggregate (app plus WebKit helpers) on 3440×1440. `docs/TIMINGS.md` has v1's numbers.
- **Save:** `SAVE_VERSION = 2`. A v1 save is moved to `save.v1.json`, and a fresh game starts.
- **Broken window:** between Task 1 and Task 12 the app itself does not run. Each task runs the test files it names. `npm test` must be fully green from Task 12 on. Every v1 test file a task makes obsolete is deleted or rewritten in that same task.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A bridge layout that cuts an island off from a good.** The game must not soft-lock silently: the guide names the stall (Task 13, `stalls()` test in Task 2).
2. **One-way bridges that make a needed good unreachable.** Demand must not leak: makers stay idle, and walkers never carry goods against the arrow (Task 2 test `one-way bridge never carries against its arrow`).
3. **A 12 h catch-up after sleep.** It must fire at most one event, and must not jump an island several stages without its spots opening (Task 5 and Task 3 tests).
4. **A narrow play stage** (side panel open on a 1512×944 laptop). The 640×300 world must still fit whole, not be cropped (Task 8 test `viewScale never crops the world`).
5. **Moving an island after bridges and picks exist.** Piers follow, bridges re-route to the new pier sides, and picks already grown never change (Task 3 test `picks are frozen when a bridge moves`).

---

### Task 1: Goods, island types and the world

**Files:**
- Modify: `web/js/sim/content.js`, `web/js/core/palette.js` (goods only), `web/js/sim/world.js`, `web/js/sim/graph.js`
- Delete: `web/js/sim/economy.js`, `web/js/sim/shop.js`, `tests/economy.test.js`, `tests/shop.test.js`
- Test: `tests/world.test.js` (rewrite), `tests/graph.test.js` (new)

**Interfaces:**
- Produces, in `content.js`:
  - `W=640`, `H=300`, `CARRY=3`, `MAXR=170`, `SPEED=24`, `OUTBOX=6`, `MOVEPX` (kept from v1)
  - `TOWN = {x:320, y:286, r:22}`
  - `RATE = 1/60`, which is goods per second, per good an island makes
  - `STAGE_COST = [0, 4, 60, 300]`: the cost per needed good to go from stage `i` to `i+1`. Starting values; Task 7 tunes them.
  - `ISL_OCEAN`, `ISL_LAVA`: `{ name, makes, flavour, leaf, rock }`. `makes` follows the design's table: home/anvil/ash/kiln stone; ember/amethyst/emberfall/obsidian light; frost/verdant/geyser water.
  - `DEF_OCEAN`, `DEF_LAVA`, `WORLD_DEFS`, with v1's `sys`, `seedOffset`, `next` and `surfKey` kept. `goal`, `bonusKind` and `start` are removed. `home` and `ash` stay as the HOME islands.
- Produces, in `palette.js`: `GOODS = ['water','light','stone']`, `COL`, `NAME` for those three. `RES` is removed.
- Produces, in `world.js`:
  - `makeWorld(def, seed) -> World`, where `World = { def, S, hub, HOP, events, started }`
  - `S = { time, nodes, ropes, sel, cable:false, cableT:0, nextId }`
  - island node: `{ id, kind:'island', x, y, stage:1, paid:{water,light,stone}, out:{...}, relay:[], spots:{}, sends:null, satisfied:[], gifts:[], name:null, seed }`. Sim messages go to `w.events.push({msg, warn})`, as in v1, and "says" below means that.
  - hub: `{ id:'planet', kind:'planet', x:TOWN.x, y:TOWN.y, r:TOWN.r, stage:1, paid, relay:[] }`
  - `node`, `isl`, `dist`
  - `tie(w,a,b) -> Rope`, where `Rope = { id, a, b, way:0, u:0, dir:0, load:[], next:0 }`
  - `untie(w, ropeId)`
  - `makes(w,n) -> string[]`: the type's good, plus `n.sends` if set
  - `piers(n) -> number`: 4 for the hub, `n.stage + 1` for islands
  - `canTie(w,a,b) -> {ok:boolean, why?: 'self'|'dup'|'reach'|'piers'|'cross'}`
- Produces, in `graph.js`:
  - `cross` (kept), `tangled` (kept)
  - `arcs(w, id) -> id[]`: neighbours you can **send to**. It respects `way`: 1 means a→b only, -1 means b→a only.
  - `allPairs(w)`, which fills `w.HOP[from][to]` over directed arcs
  - `hops(w,a,b)`, `nextHop(w,from,to)`
  - `cycleWay(r)`: 0→1→-1→0

- [ ] **Step 1: Create branch `v2` and write failing tests**

`tests/world.test.js`:
- `layout puts every island inside 640x300 and reachable from the town`: for seeds 1..20, every island satisfies `0<x<640`, `0<y<TOWN.y-20`, and BFS over `dist <= MAXR - 8` from the hub reaches all islands.
- `islands start as bare rocks with no bridges`: `makeWorld(DEF_OCEAN, 3)` has 6 islands, all with `stage === 1` and all `paid` zero, and `S.ropes.length === 0`.
- `makes follows the type table, plus sends`: `makes(w, node(w,'frost'))` deep-equals `['water']`. After setting `sends='light'`, it is `['water','light']`.
- `piers grow with stage; the town has 4`: stage 1 gives 2, stage 4 gives 5, the hub gives 4.
- `canTie refuses self, duplicate, out of reach, full piers and crossings`: one assertion per `why`.

`tests/graph.test.js`:
- `one-way arcs`: tie A–B, then set `way=1`. `arcs(w,A)` contains B, and `arcs(w,B)` does not.
- `cycleWay goes both, a→b, b→a, both`.
- `hops respects direction`: a chain A→B→C with all `way=1` gives `hops(C,A) === Infinity` and `hops(A,C) === 2`.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/world.test.js tests/graph.test.js`. Expected: FAIL (imports missing).

- [ ] **Step 3: Implement content, palette goods, world and graph as above**

`layout(seed, ids)` keeps v1's rejection-sampling shape, scaled to the new world:
- islands at `y ∈ [36, TOWN.y-40]` and `x ∈ [40, 600]`
- at least 70 units apart
- every island reachable from the hub within `MAXR-8`

`canTie` keeps the no-crossing rule, using `cross` against every existing rope that shares no end. Delete `economy.js`, `shop.js` and their tests.

- [ ] **Step 4: Run them and see them pass**

Run `node --test tests/world.test.js tests/graph.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**: `feat(sim): v2 goods, island types and world`

---

### Task 2: Flow (making on demand, walkers, relay, chains first)

**Files:**
- Create: `web/js/sim/flow.js`
- Delete: `web/js/sim/step.js`
- Test: `tests/flow.test.js` (new; replaces `tests/step.test.js`, which is deleted)

**Interfaces:**
- Consumes: Task 1's world and graph API.
- Produces, in `flow.js`:
  - `cost(w, n) -> {water,light,stone}`: what `n`'s current stage still needs in total. For an island it is `STAGE_COST[n.stage]` for each good **not** in `makes(w,n)` and not in `n.satisfied`, and zero at stage 4. For the hub it is `townCost(w)` from Task 4. Until Task 4 lands, it imports a stub from `town.js` that returns zeros.
  - `need(w, n, k) -> number`: `cost[k] - paid[k] - inbound(w, n.id, k)`, floored at 0.
  - `inbound(w, id, k)`: goods with `d === id` on ropes, plus goods in relay queues.
  - `demandFor(w, from, k) -> id|null`: the nearest node with `need > 0` that `from` can reach (by hops, then distance), excluding nodes that make `k`.
  - `stalls(w) -> [{id, k}]`: islands with `need(k) > 0` where no maker of `k` has `hops(maker, id) < Infinity`.
  - `step(w, dt)`: the per-world sim step.
  - `walkSpeed(w, r) -> number`: returns `1` in this task. Task 5 multiplies in the coral perk (`1.15` when either end has a placed coral gift).

**Rules `step` implements, from the design:**
1. **Making:** for each good `k` in `makes(w,n)`, an island accumulates `RATE * dt` into `n.out[k]` (capped at `OUTBOX`) **only while** `demandFor(w, n, k)` is not null. Otherwise its accumulator holds.
2. **Loading:** a resting walker at end `X` loads up to `CARRY` items. Items come from `X.relay` first, then `X.out`. It takes only items whose `nextHop(w, X, dest)` is the far end, and only when the rope's `way` allows `X`→far. Each item is `{k, d}`.
3. **Arrival at node Y:** for each item, if `need(w, Y, k) > 0` once the item's own reservation is dropped, Y takes it into `paid[k]` (**chains take their share first**). Otherwise, if `Y.id === d`, or Y doesn't need it, the item goes into `Y.relay` and re-targets with `demandFor`. Items with no destination are dropped from the relay. Nothing goes to `out`.
4. **Resting:** a walker with nothing to carry and nothing waiting at the other end stays at `u` of 0 or 1 with `dir = 0`, which means it rests on its pier.
5. Walker motion uses v1's `u` / `dir` scheme, `SPEED * walkSpeed / L`.
6. `step` does not grow stages. Task 3's `grow(w)` is called right after `step` in `stepAll`.

- [ ] **Step 1: Write failing tests in `tests/flow.test.js`**

Helpers: `bare(seed)` returns a world with no ropes, and `run(w, s)` steps at 0.1 s.

- `an island with no one in need makes nothing`: an untied world run for 600 s has every `out[k] === 0`.
- `goods flow toward need`: tie FROST to HOME and run 600 s. Then `node('home').paid.water > 0`.
- `chains take their share first`: line up FROST – EMBER – HOME, tied in that order, with EMBER and HOME both needing water. Run until the first 3 water have arrived. EMBER's `paid.water` reaches its `STAGE_COST[1]` before HOME's `paid.water` is above 0.
- `one-way bridge never carries against its arrow`: tie FROST–HOME with `way` set so only HOME→FROST is allowed, and run 600 s. Then `node('home').paid.water === 0`, and no rope load ever has `k === 'water'` heading toward HOME. Check every step.
- `satisfied islands pass goods through`: HOME is fully paid for its stage and sits between FROST and ANVIL. Water still reaches ANVIL.
- `stalls names an island that cannot get a good`: FROST tied only to AMETHYST, which makes light. FROST needs stone, and `stalls(w)` includes `{id:'frost', k:'stone'}`.
- `nothing is stored on islands beyond the outbox`: across a 2 h run, `out[k] <= OUTBOX` and `relay.length <= 3 * piers(n)` at every step.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/flow.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement `flow.js`, and stub `town.js` with `export const townCost = () => ({water:0,light:0,stone:0})`**

- [ ] **Step 4: Run them and see them pass**

Run `node --test tests/flow.test.js tests/world.test.js tests/graph.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**: `feat(sim): goods flow toward need, chains first, one-way bridges`

---

### Task 3: Stages, spots and picks

**Files:**
- Create: `web/js/sim/grow.js`, `web/js/sim/picks.js`
- Test: `tests/grow.test.js`

**Interfaces:**
- Consumes: `cost`, `makes`, `piers`.
- Produces, in `picks.js`:
  - `SPOTS`, a 5-entry list of `{i, side:-1|0|1, opensAt}`: 0 is the left rim (opens at stage 3), 1 the middle (stage 2), 2 the right rim (stage 3), 3 the back middle (stage 4), and 4 the gift-only spot (stage 4).
  - `PIER_PICKS`, keyed by good:
    - water: `pond`, `reeds`, `waterfall` (`sends:'water'`)
    - light: `lanterns`, `crystal`, `lanternGrove` (`sends:'light'`)
    - stone: `stair`, `cairn`, `quarry` (`sends:'stone'`)
  - `MID_PICKS[type]`: at least 4 per island type, from its flavour (e.g. home: cottage, appleTree, vegPatch, orchard; frost: pineStand, iceHut, snowGarden, frostWillow; …). Each entry is `{id, name, prop}`, where `prop` names a kit prop from Task 9.
- Produces, in `grow.js`:
  - `grow(w)`: any island whose `cost` is fully paid moves to `stage+1` (at most 4). It resets `paid`, carries over `satisfied`, opens the `SPOTS` with `opensAt === stage`, and `say`s `"<NAME> grew to stage <n>."`. It moves **at most one stage per call**, so every stage's spots open.
  - `pierSide(w, n, ropeId) -> -1|1`: the sign of `(other.x - n.x)`.
  - `spotKind(w, n, i) -> {kind:'pier', good} | {kind:'mid'}`: a rim spot is `'pier'` when a rope lands on that side carrying a good **into** `n` (it uses `arcs` from the other end). The good is the one the far side's island makes, the lowest in `GOODS` order.
  - `offers(w, n, i) -> pick[]`: 2–3 picks. It removes `sends` picks when `n.sends` is already set, or when the good is already in `makes(w,n)`. Which picks it keeps is decided by `rngf(n.seed*31+i)`.
  - `choose(w, n, i, pickId) -> boolean`: refuses spots that aren't open or are already used, and picks not in `offers`. It stores `n.spots[i] = {pick: pickId}`. When the pick has `sends`, it sets `n.sends`, and that good is satisfied for the current stage and every later stage.
  - `rename(n, s) -> boolean`, using `cleanName(s)`: upper-case `[A-Z0-9 ]` only, trimmed, 1–10 chars. Otherwise it is refused.

- [ ] **Step 1: Write failing tests in `tests/grow.test.js`**

- `paying a stage grows it and opens its spots`: set HOME's `paid` to its cost and call `grow`. Then `stage === 2`, and `offers(w,home,1).length` is between 2 and 3.
- `a long catch-up grows one stage per step and opens every stage's spots`: overpay through stage 4 and call `grow` 3 times. Spots 0–4 are all open.
- `pier spot offers picks for the arriving good`: tie FROST to HOME on HOME's right. `spotKind(w,home,2)` deep-equals `{kind:'pier', good:'water'}`, and every offer comes from `PIER_PICKS.water`.
- `role-changing pick adds a sent good and drops it from costs`: HOME chooses `waterfall`. Then `makes` includes water, `cost(w,home).water === 0` now and at the next stage, and the progress already paid toward light is kept.
- `at most one role-changing pick per island`: after `waterfall`, no offer anywhere has `sends`.
- `picks are frozen when a bridge moves`: after choosing at spot 2, untie that bridge and tie one on the left. `n.spots[2].pick` is unchanged, and `choose` on spot 2 returns false.
- `rename cleans and limits names`: `'  frosty! '` becomes `'FROSTY'`, `''` is refused, and 11 chars are refused.
- `every type has at least 6 picks and a sends pick for each good it does not make`: a content check.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/grow.test.js`.

- [ ] **Step 3: Implement `picks.js` and `grow.js`**

- [ ] **Step 4: Run them and see them pass**

Run `node --test tests/grow.test.js tests/flow.test.js`.

- [ ] **Step 5: Commit**: `feat(sim): stages, spots and picks`

---

### Task 4: Town, cable, second world, and the game loop

**Files:**
- Modify: `web/js/sim/town.js` (replace the stub), `web/js/sim/system.js`, `web/js/sim/game.js`, `web/js/sim/dev.js`
- Test: `tests/town.test.js` (new), `tests/game.test.js` and `tests/system.test.js` (rewrite)

**Interfaces:**
- Produces, in `town.js`:
  - `TOWN_COST = [0, 40, 200, 600]`, each good per town stage, for stages 1→4
  - `CABLE_COST = 2000`, each good. Starting values; Task 7 tunes them.
  - `cableOpen(w)`: `w.def.next` exists, every island is at `stage >= 3`, and `!w.S.cable`
  - `townCost(w)`: the stage cost while `hub.stage < 4`. Otherwise it is `CABLE_COST` for each good while `cableOpen`, else zeros.
  - `growTown(game, w)`: stages the town up when it is paid. When it is paid for the cable, it sets `S.cable = true`, starts the next world, and pushes `{a, b}` to `game.cables`.
- `system.js`:
  - keeps `sysPlanets` and `sysPos`
  - removes the cable trade, `wantsFrom` and `blocked`. In v2 every world has its own makers, so a cable carries nothing. It is drawn with a decorative glint (Task 11).
  - `stepAll(game, dt)` is `step` → `grow` → `growTown`, for each started world, then `stepEvents` (Task 5).
- `game.js`:
  - `newGame(seed)` makes worlds with **no starting bridge**
  - `ui` gains `{ tray: [] }`. The tray lives on `game` as `game.gifts`, not on `ui`, because it is game state.
  - `advance` and `catchUp` are unchanged.
- `dev.js`:
  - `autoNet(w)` greedily ties the nearest reachable pairs, honouring `canTie`
  - `autoPick(w)` chooses the first offer at every open spot, skipping `sends` picks
  - `skip(game)` runs world 0 to the cable, for `?skip=1` and shots

- [ ] **Step 1: Write failing tests**

- `town grows by receiving all three goods`: tie the makers to the town, then run until `hub.stage === 2`.
- `cable unlocks only when every island is at stage 3`: with all islands at stage 3 except one, `cableOpen` is false. With all of them at stage 3, it is true.
- `paying the cable starts CINDER and adds a cable`.
- `newGame has no bridges` (in `tests/game.test.js`).
- `stepAll grows islands in the same step as their last delivery` (in `tests/system.test.js`).

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/town.test.js tests/game.test.js tests/system.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run them and see them pass**

Run the same command, plus `tests/flow.test.js tests/grow.test.js`.

- [ ] **Step 5: Commit**: `feat(sim): town stages, the cable, and the v2 game loop`

---

### Task 5: Events and gifts

**Files:**
- Create: `web/js/sim/events.js`
- Modify: `web/js/sim/picks.js` (gift content), `web/js/sim/game.js` (`game.ev`, `game.gifts`), `web/js/sim/flow.js` (perks)
- Test: `tests/events.test.js`

**Interfaces:**
- Produces, in `picks.js`, `GIFTS`:
  - `coral` (from the whale; variants are coral colours; perk: walkers on bridges touching the island are ×1.15)
  - `hut` (from the traveller; it carries a name from `TRAVELLER_NAMES`, at least 12 names; perk: the island's making is ×1.1)
  - `banner` (from the aurora; perk: the island's next stages cost ×0.9, rounded up)
- Produces, in `events.js`:
  - `EVENT_MEAN = 21600` seconds
  - `EVENTS = { whale:{dur:150, gift:'coral'}, traveller:{dur:120, gift:'hut'}, aurora:{dur:180, gift:'banner'} }`
  - `TRAY_MAX = 3`
  - `game.ev = { rs, nextAt, active: null | {kind, t0, dur, world, variant} }`, where `rs` is the integer RNG state
  - `stepEvents(game, dt, opts={catchup:false})` fires when the first started world's `S.time >= nextAt`. The next gap is `max(1800, -ln(1-u)*EVENT_MEAN)`. When an event ends it pushes a gift to `game.gifts` unless the tray is full. During catch-up the event skips its animation and resolves at once. **At most one** event fires per catch-up (`game.ev.caught` is set, and cleared by `endCatchup(game)`), and it `say`s `"A space whale passed by while you were away."` (or the traveller's or aurora's line).
  - `placeGift(w, n, giftIdx, spotIdx) -> boolean`: needs an open, empty spot. Spot 4 is gift-only, and picks can't use it.
- `advance(game, sec, mode, opts)` passes `opts.catchup` through to `stepEvents`.

- [ ] **Step 1: Write failing tests**

- `events fire at about one per 6 hours`: one seeded game run for 600 h (`stepEvents` only, 10 s steps) gets 100 events, give or take 15%.
- `each event leaves a gift; the tray holds 3`: 4 forced events give `game.gifts.length === 3`.
- `catch-up fires at most one event`: a 12 h `advance(...,{catchup:true})` with `nextAt` set to fire 3 times fires once. After `endCatchup`, the next fires normally.
- `gifts take an open spot; spot 4 is gift-only`: `choose` on spot 4 returns false, and `placeGift` on spot 4 returns true at stage 4.
- `coral speeds walkers by 15%`: `walkSpeed` is 1.15 on a bridge touching a coral island.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/events.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run them and see them pass**

Run `node --test tests/events.test.js tests/flow.test.js tests/grow.test.js tests/town.test.js`.

- [ ] **Step 5: Commit**: `feat(sim): whale, traveller and aurora events with gifts`

---

### Task 6: Save v2 and the v1 save fallback

**Files:**
- Modify: `web/js/sim/save.js`, `web/js/boot.js`, `web/js/main.js` (boot path only), `Sources/TinyGarden/SaveStore.swift`, `Sources/TinyGarden/Lifecycle.swift`
- Test: `tests/save.test.js` (rewrite), `tests/boot.test.js` (update)

**Interfaces:**
- `save.js`:
  - `SAVE_VERSION = 2`
  - `serialize(game, nowMs)` stores the worlds (`key`, `started`, `S`, with nodes carrying stage, paid, out, relay, spots, sends, satisfied, gifts and name), `cables`, `gifts`, `ev` and `ui`
  - `deserialize(obj)` returns a Game, or null. It keeps v1's prune rules: a retired island, ropes to missing nodes, and a bad selection.
  - `isV1(obj) -> boolean`: `obj && obj.v === 1`
- `boot.js`: `trialLoad(obj, makeCtx)` returns `{game}`, `{old:true}` for a v1 save, or null.
- main.js `garden.boot`: when it gets `{old:true}` it posts `{type:'old-save'}` and starts a new game.
- Swift:
  - `SaveStore.keepV1() -> Bool` moves `save.json` to `save.v1.json`. It replaces an existing `save.v1.json` in one step (`replaceItemAt`), in the same style as `archive()`.
  - `Lifecycle` handles `case "old-save": store.keepV1()`.

- [ ] **Step 1: Write failing tests**

- `round trip keeps stages, spots, picks, gifts, names, ways, events and town`: build a game with picks, one gift placed, one in the tray, a renamed island and a one-way rope. Then `deserialize(serialize(g))` deep-equals `g` on those fields.
- `a v1 save is recognised, not loaded`: `trialLoad({v:1, ...})` returns `{old:true}`.
- `garbage returns null`: keep v1's garbage cases.
- `a retired island is pruned with its ropes and its spots`.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/save.test.js tests/boot.test.js`.

- [ ] **Step 3: Implement the JS side, then the Swift side**

- [ ] **Step 4: Verify**

Run `node --test tests/save.test.js tests/boot.test.js` (PASS), then `swift build -c release` (it builds with no warnings from the new code).

- [ ] **Step 5: Commit**: `feat(save): v2 save; a v1 save is kept as save.v1.json`

---

### Task 7: Pacing

**Files:**
- Create: `tests/pacing.test.js`
- Modify: the tuning constants only: `RATE`, `STAGE_COST` (content.js), `TOWN_COST`, `CABLE_COST` (town.js)
- Log: add a row to `docs/TIMINGS.md` with the measured sim times

**Ruling (planner's call):** "3–5 days of wallpaper running" means **16 h of sim time a day** (the machine on and awake, plus up to 12 h of catch-up overnight). So the target is a cable at between 172 800 s and 288 000 s of sim time.

- [ ] **Step 1: Write the pacing test**

For seeds 1, 2 and 3, a fresh game gets `autoNet(world0)`. Then, at 1 s steps, call `autoPick(world0)` every 60 s. Assert:
- the first stage-up happens at `S.time <= 300`
- `S.cable` turns true at `172800 <= S.time <= 288000`
- the test runs in under 60 s of wall clock

- [ ] **Step 2: Run it**

Run `node --test tests/pacing.test.js`. Note the times it prints (`console.log` of the first stage-up and the cable time per seed).

- [ ] **Step 3: Tune the four constants until all three seeds pass**

Tune in this order: `RATE` for the first stage, then `STAGE_COST[2..3]` and `CABLE_COST` for the cable. Keep every number a round figure, because the panel shows them.

- [ ] **Step 4: Run every sim test**

Run `node --test tests/pacing.test.js tests/flow.test.js tests/grow.test.js tests/town.test.js tests/events.test.js tests/save.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**: `tune: v2 pacing (first stage ≤5 min, cable in 3–5 days)`

---

### Task 8: Pixel scale and canvas layout

**Files:**
- Modify: `web/js/core/pixel.js` (`viewSize`), `web/js/main.js` (`layout`, `drawSky`, corner labels), `web/index.html`, `web/style.css`
- Test: `tests/views.test.js` (rewrite)

**Interfaces:**
- Produces, in `pixel.js`:
  - `viewScale(dW, dH) -> {s, w, h}`, using the rule in Global Constraints, for every view
  - `worldOffset(w, h) -> {ox, oy}`: `ox = floor((w-640)/2)`, `oy = floor((h-300)/2)`. Drawing translates by it, and `ui/input.js` subtracts it.
  - `viewSize`, `fitSize`, `closeSize`, `CITY_W/H`, `FIT_H` and `CLOSE_W/H` are removed. Their callers use `viewScale`.
- main.js: the city view draws through `PixCtx` at the full `w×h` in both modes (no separate 320×200 canvas). `#sky` is kept only as the backdrop behind the stage's margin.
- `#where` and `#playtag` (the view title and the ⌥E hint) are removed from `index.html`, `style.css` and `main.js`.

- [ ] **Step 1: Write failing tests in `tests/views.test.js`**

- `3440x1440 is scale 3`: `viewScale(3440,1440)` deep-equals `{s:3, w:1146, h:480}`.
- `1512x944 at 2x is scale 4`: `viewScale(3024,1888)` deep-equals `{s:4, w:756, h:472}`.
- `viewScale never crops the world`: for every `dW` in 700..4000 step 37 and `dH` in 320..2200 step 41, the result has `w >= 640 && h >= 300`, or `s === 1`.
- `worldOffset centres the world`.
- `no corner label elements`: a read of `web/index.html` has no `id="where"` and no `id="playtag"`.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/views.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run them and see them pass**

Run `node --test tests/views.test.js`.

- [ ] **Step 5: Commit**: `feat(view): finer pixel scale from the screen; no corner labels`

---

### Task 9: The pixel kit

**Files:**
- Create: `web/js/draw/kit.js`
- Modify: `web/js/draw/scene.js` (remove what the kit replaces: `island`, `levelDeco`, `piles`, `walker`, `bridgeOut`, `bg`)
- Test: `tests/kit.test.js`

**Interfaces:**
- Port the page 45 kit (see "Mockup source of truth") into an ES module that works against both a canvas 2D context and `PixCtx`. It uses only `fillRect`, `globalAlpha`, `drawImage` of small canvases and `putImageData`. Exports:
  - `STY` (`mixA` only, renamed to `STY.book`), `PROPS`, `glowAt`, `span`, `plank`, `astro`
  - `islandSprite(spec) -> {cv, w, h, ox, oy, anim}`, a pre-rendered sprite. `spec = {type, seed, stage, picks:[{spot, prop}], gifts:[{spot, kind, variant}], falls:[side], hw, depth, haze}`. It is drawn by page 45's `makeIsland` logic, using the island type's `rock` and `leaf` colours.
  - `islandKey(w, n, band) -> string`: changes only when the seed, stage, picks, gifts, pier sides, falls or band change.
  - `getSprite(w, n, band)`: memoised by `islandKey`, at most 64 entries (LRU)
  - `drawIsland(c, sprite, x, y, t)`: the blit plus the animated bits (falls, fireflies, lamp flicker)
  - `skyLayer(W, H, seed)`: page 45's starfield, plus **stardust**: 2–3 very soft Bayer-dithered bands in `#8aadf4`, `#c6a0f6` and `#f5a97f`, at most 6% alpha. It returns a cached ImageData.
  - `stage → look`: stage 1 is bare rock (no grass), stage 2 grass and tufts, stage 3 adds the type's home prop, stage 4 adds bloom (flowers and fireflies). Picks and gifts sit at their `SPOTS` x positions on the top.
  - **Waterfall:** a rim pick of `waterfall`, or any pier spot where water arrives, adds `falls:[side]` (the design's "waterfall forms on the side the water comes in").

- [ ] **Step 1: Write failing tests in `tests/kit.test.js`** (they run on `PixCtx` with a minimal `ImageData` shim in node)

- `the same spec draws the same pixels`: a byte-equal check.
- `different seeds or picks give different islands`: 20 seeds × the same picks give 20 distinct hashes.
- `islandKey ignores time and walkers, changes with picks`.
- `a stage-1 sprite has no grass colours`: no pixel in `STY.book` grass greens.
- `sprite cache holds at most 64`.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/kit.test.js`.

- [ ] **Step 3: Port the kit**

Keep page 45's algorithms. Replace its globals (`HZ`, the module-level `rng`) with per-call state. Keep every pixel size as in the mockup.

- [ ] **Step 4: Run them and see them pass**

Run `node --test tests/kit.test.js`.

- [ ] **Step 5: Commit**: `feat(draw): storybook pixel kit from page 45`

---

### Task 10: The horizon city view and the events on screen

**Files:**
- Create: `web/js/draw/city.js` (it replaces `draw/map.js`, which is deleted), `web/js/draw/events.js`
- Modify: `web/js/boot.js` (trial draw uses `drawCity`)
- Test: `tests/draw.test.js` (rewrite)

**Interfaces:**
- `drawCity(c, game, w, t, view={w,h,ox,oy}, input={})`, in this order:
  1. the cached sky (`skyLayer`) and the sun (small, top right)
  2. TIDE as a big curve across the **full canvas width**, using page 45's `planetLayer`, with its top at world `y = TOWN.y - 6`; the town on it, with `hub.stage` houses and lights (`1 + 2*(stage-1)` houses)
  3. islands in depth bands from their `y`: `y < 110` is far (sprite `hw` 0.7×, haze .55), `y < 190` mid (0.85×, haze .25), else near (1×)
  4. bridges: `span` + `plank` from pier to pier. A pier is on the rim facing the bridge, with a lantern post. One-way bridges show a 3-px arrow chevron at mid-span.
  5. walkers: `astro`, its backpack in `COL[load[0].k]` when it carries something, otherwise grey. A resting walker sits on its pier, with page 45's idle `z`.
  6. in play mode only: open spots glow (`glowAt`), the selection, the reach ring on hover (v1 `reachRing`, scaled to `MAXR`), and the drag preview
  7. the active event (`drawEvent`)
- `nodeAt(w, p)`: the hit test in world units, moved here from `map.js`.
- `drawEvent(c, game, view, t)`: whale, traveller and aurora, following page 44's `ev-whale`, `ev-trav` and `ev-aurora`. Progress is `(S.time - t0) / dur`. It draws nothing during catch-up.

- [ ] **Step 1: Write failing tests in `tests/draw.test.js`**

- `drawCity never writes to the game`: compare the JSON before and after one frame on `PixCtx(1146,480)`.
- `no goods are drawn on islands`: for an island with full `out` and `relay`, the pixels inside its sprite box match an identical island with empty `out` and `relay`.
- `horizon spans the canvas`: the bottom row has no sky pixels at both `x=0` and `x=w-1`.
- `drawEvent draws for each kind`: at least 40 changed pixels mid-event, and none after it ends.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/draw.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Verify**

Run `node --test tests/draw.test.js` (PASS). Then run `node scripts/shot.mjs "seed=3&mode=wallpaper&view=planet&skip=1" shots/v2-city.png 3440,1440` and the same at `1512,944`. Look at both against page 45's `lay-h` and fix what's off.

- [ ] **Step 5: Commit**: `feat(draw): horizon city view, piers, astronauts and events`

---

### Task 11: Close-up, solar-system arcs, galaxy pan, starfield everywhere

**Files:**
- Modify: `web/js/draw/closeup.js`, `web/js/draw/system.js`, `web/js/draw/galaxy.js`, `web/js/ui/input.js` (galaxy drag only), `web/js/sim/game.js` (`ui.galPan`)
- Test: `tests/system.test.js` (add arc tests), `tests/galaxy.test.js` (new)

**Interfaces:**
- `islandView(c, w, n, t, W, H)`: the island at 2× sprite size, centred over a soft horizon in the kit's style. `planetView` shows the town close up. `dawn` stays.
- `system.js`:
  - `arcPath(A, B, sun, rSun) -> [x,y][]`: a quadratic Bézier from A to B. Its control point is pushed away from the sun along the A–B normal, so every point is at least `rSun + 6` from the sun. When the straight line already clears that distance, it bows gently (control offset 0.15 × L).
  - The cable is drawn **before** the sun and planets as a 1-px dotted line (2 on, 2 off) in `mix(col, sky, .5)`. A glint dot travels it every 8 s while either world has a walker with `dir !== 0`.
  - `tube` is deleted.
- `galaxy.js`:
  - `NEIGHBOURS`: an elliptical, a ring and a small irregular galaxy, at fixed offsets around the home disc, each rendered once into a cached ImageData at a small size
  - `drawGalaxy(..., pan)` offsets everything by `game.ui.galPan`, clamped so the home disc stays at least partly on screen
  - the wallpaper ignores `galPan` and always shows home
- input: in play mode on the galaxy view, dragging changes `ui.galPan`. It is a click (select) when the move is under 4 px.
- Starfield and stardust: system, galaxy margins and close-up all start from `skyLayer`.

- [ ] **Step 1: Write failing tests**

- `arcPath never passes near the sun`: for 200 random A/B pairs on the orbits, including directly opposite ones, `min dist >= rSun + 6`.
- `arcPath bows gently when the line is clear`.
- `galaxy pan is clamped`.
- `wallpaper galaxy ignores pan`: same pixels with `galPan` 0 and 300 in wallpaper mode.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/system.test.js tests/galaxy.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Verify**

Run the tests (PASS). Then take shots of `view=system&skip=1`, `view=galaxy` and `view=close&n=home` at 3440,1440, and compare them by eye with page 45's `sc-arc` and page 38's galaxy.

- [ ] **Step 5: Commit**: `feat(draw): arcs around the sun, galaxy panning, starfield in every view`

---

### Task 12: Play input: bridges, ways, spots, the pick card, the gift tray

**Files:**
- Create: `web/js/ui/card.js`
- Modify: `web/js/ui/input.js`, `web/js/ui/dock.js` (remove the shop button and price), `web/index.html`, `web/style.css`, `web/js/main.js` (wiring)
- Delete: `web/js/ui/price.js`, `tests/dock.test.js` cases about the shop
- Test: `tests/input.test.js` (new, against pure helpers), `tests/dock.test.js` (update)

**Interfaces:**
- `input.js` (pure helpers, exported for tests):
  - `toWorld(cv, e, view) -> {x,y}`
  - `tryTie(w, a, b) -> {ok, why}`: wraps `canTie`, and `say`s a plain line per `why`:
    - reach: "Too far for a bridge."
    - piers: "<NAME> has no free pier. It gets another when it grows."
    - cross: "Bridges can't cross."
    - dup: "Already tied."
  - `tapRope(w, r)`: `cycleWay` plus a guide line
  - `spotAt(w, n, p) -> spotIdx|null`
- Gestures (play mode):
  - drag island to island (bridge tool) ties
  - drag an island (move tool) moves it, using v1's `constrain`, and for free
  - tap a bridge to cycle its way
  - tap a glowing spot to open the card
  - the right-click / panel action unties, as in v1
- `card.js`:
  - `openCard(app, w, n, i)` shows a pixel card next to the spot, built from `offers`, with each option's name and a 24×24 preview from `islandSprite` of just that prop
  - `closeCard(app)`
  - choosing calls `choose`, then the sprite cache invalidates through the `islandKey` change
  - when `game.gifts` is non-empty, the card also lists gifts for that spot (spot 4 shows only gifts)
- Tray: a strip of up to 3 pixel gift icons in the side panel. Clicking one arms it, and the next spot click places it via `placeGift`.

- [ ] **Step 1: Write failing tests**

- `tryTie says why it refused`: one case per `why`.
- `tapRope cycles both → a→b → b→a → both`.
- `spotAt hits an open spot within 4 px and misses a closed one`.
- `dock has no shop button` (in `tests/dock.test.js`).

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/input.test.js tests/dock.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Verify**

Run `npm test`. Expected: **every test file passes**, which ends the broken window. Then run `node scripts/shot.mjs "seed=3&mode=play&view=planet" shots/v2-play.png 1512,944` with no page errors.

- [ ] **Step 5: Commit**: `feat(ui): tie, steer, choose spots and place gifts`

---

### Task 13: Panel, renaming and the guide

**Files:**
- Modify: `web/js/ui/panel.js`, `web/js/ui/guide.js`, `web/js/ui/tags.js` (names use `n.name ?? type name`; the stock pips are removed)
- Test: `tests/panel.test.js` (new), `tests/tags.test.js` (update), `tests/names.test.js` (unchanged, must pass)

**Interfaces:**
- `panelHTML(app) -> string`, pure:
  - **Island:** its name (click to rename: an inline pixel text field, Enter saves via `rename`, Esc cancels), `stage n of 4`, and one row per needed good, `"<icon> 6 of 60"`. Then "makes" icons, `piers used/total`, and open spots ("2 spots to choose").
  - **Bridge:** its two ends, and its way, shown as arrows with "tap the bridge to change".
  - **Town:** `town stage n of 4` with its three rows, then, once `cableOpen`, "the long cable to CINDER" with its three rows.
  - No other numbers appear anywhere on the map.
- `guide.js`:
  - `guideText(app)` teaches in order, until each is done once:
    1. "Drag from HOME to an island to tie a bridge."
    2. "Water, light and stone travel to islands that need them."
    3. "HOME grew! Click a glowing spot to choose what grows there."
    4. "Tap a bridge to make it one-way."
  - after that it shows the first `stalls(w)` line: "<NAME> needs <good>, but nothing it can reach makes it."
  - event arrivals post "A space whale is passing!" and so on.

- [ ] **Step 1: Write failing tests**

- `island panel shows progress, not stock`: the HTML contains `6 of 60` and contains no `out` or `relay` count.
- `rename through the panel uses cleanName`.
- `guide teaches tying first, then names a stall`.
- `town panel shows the cable only once it is open`.

- [ ] **Step 2: Run them and see them fail**

Run `node --test tests/panel.test.js tests/tags.test.js`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Verify**

Run `npm test` (all pass). Then take shots of play mode with HOME selected and with a bridge selected, at 1512,944.

- [ ] **Step 5: Commit**: `feat(ui): v2 panel, renaming and guide`

---

### Task 14: CPU, shots, docs

**Files:**
- Modify: `web/js/main.js` (wallpaper cadence, only if measurement demands it), `docs/TIMINGS.md`, `README.md`, `docs/FOLLOWUPS.md`
- Create: `shots/v2/*.png`

- [ ] **Step 1: Shots**

Use `scripts/shot.mjs` for city, system, galaxy and close-up, each in wallpaper and play, at 3440,1440 and 1512,944, into `shots/v2/`. Expected: no page errors. Check every shot by eye against pages 44–45. Fix and re-shoot until they match: no goods on islands, no corner labels, arcs clear of the sun.

- [ ] **Step 2: CPU measurement**

Build and install (`scripts/install`), then run the wallpaper on the 3440×1440 display for 5 minutes. Sample `ps -o %cpu` of TinyGarden plus its `com.apple.WebKit.*` helpers every 5 s. Expected: a mean of 5% or less. If it is over, apply in this order:
1. Cache the sky and horizon into one background ImageData that repaints every 10 s.
2. Lower the city's wallpaper frame rate from 3 fps to 2.
3. Give the galaxy a coarser scale of its own, which the design allows.

Re-measure after each, and log every measurement in `docs/TIMINGS.md`.

- [ ] **Step 3: Docs**

- **README:** a v2 gameplay section (three goods, piers, spots, events).
- **FOLLOWUPS:** the design's "later" list (Dyson ring, own-art PNG folder, inviting events).
- **TIMINGS:** the pacing and CPU rows.

- [ ] **Step 4: Full test run**

Run `npm test` (all pass) and `swift build -c release` (OK).

- [ ] **Step 5: Commit**: `docs: v2 shots, timings and readme`
