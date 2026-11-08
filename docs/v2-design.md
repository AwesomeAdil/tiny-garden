# tiny garden v2: islands you shape

Status: draft for Adil's approval (lavish page 46). Built from lavish pages
44 and 45, 2026-11-07. v1's design (`docs/design.md`) still holds for
everything this document doesn't change: the Mac shell, wallpaper/play
modes, the bridge, saving, the clock and the install.

## Intent

v1 works, but it feels like a diagram, not a place. It has seven goods,
each with its own pools and needs, and piles of goods sitting on islands.
Adil wants:

- **The island is the reward.** You grow a tiny island into something
  idyllic to look at, like shaping a bonsai.
- **A bit of a network.** Bridges still matter: what you connect, and what
  you leave unconnected, decides which island grows. But the rules are few.
- **Things to look forward to.** Random visitors (a space whale, a
  traveller, an aurora) leave one-of-a-kind gifts that customise islands.
- **A wallpaper with personality.** The loneliness and coziness of living
  on a rock far from home, joined to everything by thin bridges.

## Decisions already made (by Adil, pages 44–45)

| Topic | Decision |
|---|---|
| Reward | A: the island is the reward, with a bit of a network |
| Growth | Stages; at each, choose one of a few additions (middle path) |
| Control | **Picks + spots**: you choose the spot, then the pick for it |
| Bridges shape looks | Yes: e.g. the waterfall forms on the side the water comes in |
| Island art | **Storybook + warm light**: dark outline, bright flat colours, a warm sunlit rim on the sun side |
| Bridge landings | **Piers**: each bridge lands at its own little pier with a lantern post |
| City layout | **Horizon**: TIDE is a big curve along the bottom with the town on it; islands float above at different depths |
| Walkers | **Little astronaut**, backpack in the colour of the good it carries |
| Events | **Space whale, traveller, aurora** |
| Goods on islands | **Never drawn sitting on islands.** You see goods only on walkers |
| Planet connections | **Arc**: a thin dotted thread that bows around the sun, with a glint when goods move |
| Corner labels | No view title and no ⌥E hint in the corners |
| Galaxy | Keep the look; let you pan to see other galaxies |
| Stars | More starfield, with some stardust colour |
| Pixel detail | Finer pixels on big screens (his is 3440×1440); today it's too chunky |
| Names | Islands can be renamed |
| Later, not now | Dyson ring/sphere, drawing your own art (a PNG folder), inviting events with goods |

## Approaches considered

1. **Rework v1 in place (picked, my call).** Keep the Swift shell, bridge,
   save store, clock, modes and install, which work and were reviewed.
   Replace the economy, the island and city art, and the panel content.
2. **New repo from scratch.** Rejected: the shell and wallpaper plumbing
   took most of v1's effort and nothing about them is changing.
3. **Trim v1's economy step by step.** Rejected: seven goods with upkeep,
   pools and a shop is the thing he wants gone. Trimming would leave its
   shape behind.

## Goals

- An island visibly grows through stages, and two islands never end up
  looking the same.
- Three goods, and every rule fits on one screen.
- The bridge layout matters: it decides which island grows next and how
  islands look.
- Rare events you notice on the wallpaper and look forward to.
- On a 3440×1440 screen it looks finer and richer than v1, and stays
  within v1's CPU budget.

## Non-goals (v2)

- Dyson ring or sphere, RIME/TEMPEST, reaching other galaxies (they're
  only to look at).
- Your own PNG art, inviting events with goods, events beyond the three.
- Upkeep, fraying, a shop, docks and quick walkers. All of v1's economy is
  removed.

## Anti-goals

- Goods piled or stacked on islands, or any clutter that hides the island.
- A spreadsheet feel: per-island pools of many goods, or numbers on the map.
- Picks so narrow every island converges on the same look.
- Text labels in the wallpaper's corners.

## The design

### Goods and islands

- **Three goods: water, light, stone.**
- Each island starts making one good, from its type:

  | Island | Makes | Island | Makes |
  |---|---|---|---|
  | HOME | stone | ASH | stone |
  | EMBER | light | EMBERFALL | light |
  | FROST | water | GEYSER | water |
  | AMETHYST | light | OBSIDIAN | light |
  | VERDANT | water | KILN | stone |
  | ANVIL | stone | | |

- **An island grows by receiving the goods it doesn't make.** Each stage
  costs an amount of each of those goods, delivered to it.
- **Goods are used the moment they arrive.** Nothing is stored or drawn on
  an island. Progress shows only in the island's panel, e.g. "next stage:
  6 of 10 water, 2 of 10 light".
- **Making is on demand.** An island makes its good only while some island
  it can reach still needs it. Otherwise its walker rests on its pier.

### Bridges and flow

- **Bridges are free.** Their limits are reach (as in v1) and piers: an
  island starts with 2 piers and gains more as it grows. The town has 4.
  Upkeep, rope cost, fraying and the shop are gone. (My call: costs
  existed to make choices matter, and piers plus reach now do that.)
- **Walkers carry goods toward the nearest island that needs them.** An
  island along the way that also needs that good **takes its share first**,
  so a chain feeds its near end before its far end.
- **One-way bridges:** tapping a bridge cycles it through both ways, A→B
  only, and B→A only, so you can steer a supply past an island.
- Moving islands is free (drag), within reach of their bridges, as in v1.
- To show how bridges work, the guide teaches tying one the first time,
  and hovering an island shows where its bridges could reach.

### Stages, spots and picks

- **Four stages:** bare rock, grass, a home, and full bloom.
- **Each stage up opens 1–2 spots.** A spot is a place on the island's top
  (left, middle or right). In play mode the open spots glow. Clicking one
  opens a small pixel card with 2–3 picks for that spot.
- **What's offered depends on the spot:**
  - A spot next to a pier offers picks that suit the good arriving on that
    bridge. With water it might be a pond, a waterfall or reeds; with light,
    lanterns or a crystal; with stone, a stair or a quarry.
  - Middle spots offer homes, trees and gardens from the island's type.
- **Some picks change what the island sends.** A waterfall makes it send
  water too, a lantern grove sends light. An island that makes a second
  good no longer needs it for later stages, so over time your system shares
  out its own roles. Other picks are only for looks, like an orchard.
- Islands keep their type's flavour (FROST frosty, AMETHYST crystalline),
  so picks are drawn from a per-type list.
- A **wallpaper-mode island never waits on you to grow.** If a stage is
  paid for while you're away, the island reaches the new stage with its
  spots open, and they wait for your picks the next time you play. Open
  spots aren't required to keep growing.

### The town, the goal, and the next world

- The town on TIDE's horizon grows too, in stages, by receiving all three
  goods. More houses and lights appear along the curve.
- **The cable to CINDER** unlocks when every TIDE island has reached stage
  3. It costs a delivery of all three goods to the town. After that,
  CINDER plays the same way with its own islands, and v2 ends where v1
  did.

### Events

- **Three events:** a space whale drifts past, a traveller sails in and
  asks to stay, and an aurora fills the sky for an evening.
- **About one event every 6 hours** of the app running, at random, in
  either mode. Each one plays on screen for 1–3 minutes, and in wallpaper
  mode too, so you might just glance up and see the whale.
- **Each event leaves a gift.** The whale leaves song coral, the traveller
  a neighbour's hut (with a name), and the aurora sky banners. A gift waits
  in a small tray until you choose an island and an open spot for it in
  play mode. Gifts are mostly for looks. Each has one small, gentle perk,
  for example the coral makes walkers on that island's bridges 15% faster.
- If an event happens during catch-up after time away, its gift is waiting,
  with one line saying what passed by.

### Art

- **Island style: Storybook + warm light (page 45).** A dark outline round
  the island and its props, bright flat colours, and a rock body built from
  rounded lobes with embedded boulders and hanging roots/moss. A warm
  sunlit rim on the side facing the sun. Page 45's mockup is the reference.
- An island's sprite is built from its seed, type, stage, picks and gifts,
  and redrawn only when one of those changes.
- **Bridges:** sagging plank bridges with a rope rail, landing at piers on
  the rim. Each pier has a lantern post. Bridges never cross an island's
  top.
- **Walkers:** the little astronaut. Its backpack shows the good's colour,
  and it rests on its pier when idle. No goods sprites anywhere else.
- **City view: Horizon.** TIDE fills the bottom as a curve with the town on
  it. Islands float above it in 2–3 depth bands: far ones are smaller and
  fade toward the sky colour. Bridges rise from the town to the nearest
  islands. The sun is small, in the sky.
- **Close-up view:** keeps its role, showing the chosen island large, now
  in the new style.
- **Starfield and stardust in every view:** more stars in a few depth
  layers, some faintly tinted warm or cool. There are very soft dithered
  stardust bands in 2–3 quiet colours. It must not look like the galaxy's
  nebula.
- **Solar system:** connections between planets are thin dotted arcs that
  bow around the sun, with a glint travelling along them when goods move.
  They're never drawn across the sun.
- **Galaxy:** unchanged, plus dragging in play mode pans to neighbouring
  galaxies (an elliptical, a ring galaxy, a small irregular one). They're
  only to look at. The wallpaper shows the home galaxy.
- **No corner labels**, in either mode. Names follow v1's N toggle and are
  shown in play mode only.

### Pixel scale

- v1 scales a fixed-size world to the screen (5× on 1440 px tall). v2
  picks the scale from the screen: **`s = max(2, round(screenHeight /
  480))`**, so 3× on Adil's 3440×1440. The world canvas is then the
  screen's size divided by `s` (about 1146×480 on his).
- Sprites keep their pixel sizes, so a bigger canvas means smaller,
  finer-looking pixels and more sky, not stretched art. The city layout
  places islands relative to the canvas size.
- **CPU budget stays v1's:** about 5% aggregate (app plus WebKit helpers)
  on 3440×1440 in wallpaper mode. If the galaxy's per-pixel render can't
  meet it at the finer scale, the galaxy may keep a coarser scale of its
  own.

### Saving

- The save version goes to 2. A v1 save can't be converted meaningfully
  (different goods), so **v2 starts a fresh game** and keeps the old save
  as `save.v1.json`. (My call. Adil has played v1 only briefly.)
- The save adds: per-island stage, opened spots and their picks, gifts
  placed and waiting, island names, bridge directions, the event clock, and
  the town stage.

### Testing

- Sim unit tests cover:
  - goods flow toward need
  - chains take their share first
  - one-way bridges
  - on-demand making (idle when no one needs it)
  - stage costs
  - picks adding a sent good
  - the cable unlock
  - events firing at the expected average rate under a seeded RNG
  - the gift tray
  - save round-trip and the v1-save fallback
- A pacing test: with a sensible bridge layout, a seeded game reaches the
  cable within the pacing target.
- Screenshot dumps (scripts/shot.mjs) for each view at 3440×1440 and
  1512×944, checked by eye against pages 44–45.


## Settled after the builder check (my calls)

1. **What exists at the start.** As in v1, every island in a world exists
   from the start, as a bare rock at stage 1, in a random layout that is
   checked for reachability. TIDE has HOME, EMBER, FROST, AMETHYST, VERDANT
   and ANVIL. CINDER has ASH, EMBERFALL, GEYSER, OBSIDIAN and KILN. There
   are no bridges at the start. The number of bridges is limited only by
   reach, piers, and v1's no-crossing rule.
2. **No world can get stuck.** Each world has at least one maker of each
   good (see the table). An idle maker starts again as soon as anyone it
   can reach needs its good. A stall can only come from your layout, and
   the guide names it ("FROST needs light, but nothing it can reach makes
   it").
3. **Walkers:**
   - One walker per bridge, as in v1. It carries a batch of 3.
   - Goods relay across several bridges toward the nearest island that
     needs them, by hops first, then distance, and one-way bridges are
     respected.
   - Every island on the route that still needs that good for its current
     stage takes what it needs first.
   - An island that needs nothing (stage 4, or already paid up) lets goods
     pass through.
4. **Picks are frozen once grown.** What's grown stays, like a bonsai.
   - A pier sits on the rim, on the side facing its bridge, and moves if
     the bridge or the island moves.
   - Spot positions are fixed per island seed.
   - A pier-side spot offers picks for the good arriving on that side at
     the moment you choose. Later changes don't alter it.
   - Picks can't be undone in v2.
5. **Role-changing picks:**
   - At most one per island, so an island makes at most two goods.
   - When one is grown, progress already paid toward the current stage is
     kept. That good counts as satisfied for the current stage and is left
     out of every later stage's cost.
6. **The end state.**
   - Stage 4 is final: the island needs nothing and keeps making its goods
     on demand.
   - The town has 4 stages with fixed piers (4), and after that needs goods
     only for the cable.
   - The cable needs all the islands of that world (a fixed set) at
     stage ≥ 3.
   - Once everything is paid, walkers rest. That calm is fine.
7. **Events and gifts.**
   - Events repeat. Each gift is its own (coral colours vary, and each
     traveller has a name).
   - The tray holds 3 gifts. An event that comes while the tray is full
     still plays but leaves nothing.
   - A gift takes an open spot. At stage 4 each island gains one extra
     spot just for a gift.
   - Catch-up after time away fires at most one event.
8. **World size.** The sim uses a fixed world of **640×300 world units**,
   for positions, reach and saves. The canvas (screen ÷ s) shows that world
   centred. The extra width becomes sky, and TIDE's horizon spans the whole
   canvas width. So 3440×1440 (canvas 1146×480) and 1512×944 (canvas
   756×472) play the same game with the same layout.

## Pacing (my proposal; Adil may change it)

- The first stage up comes within about 5 minutes of playing.
- TIDE to the cable takes about 3–5 days of the wallpaper running, with
  roughly 10 minutes of play a day.

## Left to the builder

- Stage costs and making rates, tuned to the pacing target.
- The exact pick lists per island type and spot kind. Each type needs at
  least 6 picks across its stages, and at least one role-changing pick per
  good.
- Spot positions and how a pick's sprite fits its spot.
- Gift perks within "small and gentle".
- Event animation details, matching page 44's mockups.
- Panel layout, keeping v1's pixel UI style.
