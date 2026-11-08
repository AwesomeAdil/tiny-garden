# Tiny Garden: design

Date: 2026-11-07. Status: approved by Adil 2026-11-07 (lavish page 40).
Source of truth for look and rules: the lavish prototype series in
`~/dotfiles/.lavish/tiny-garden/`, especially page 38
(`38-galaxy-and-homes.html`, the latest playable build) and page 39
(`39-where-it-lives.html`, the platform decision). This doc lives in dotfiles
until the new repo exists, then moves to `tiny-garden/docs/`.
(Note: design mockups were private review pages, not in this repo.)

## Intent

Adil wants a small pixel-art space world that lives beside his work all day,
in the spirit of Desktop Goose. It's something alive in the corner of his eye
while he applies to jobs and watches a show, and something he can drop into
for a minute and tinker with. What matters most to him: **the look of the
world**, its uniqueness, and the feeling of **connecting things** (an island
city, not one big hub). The prototype is fun ("pretty enjoyable like an ant
farm"), and he wants it to exist outside lavish, as a real GitHub project, and
**not in a browser**.

## Decisions already made (by Adil)

- **Where it lives: W3, wallpaper with a play key.** Most of the time the
  garden is the desktop wallpaper: a living world with no menus, behind every
  window and visible through his transparent Ghostty. Pressing one key brings
  it in front with its toolbar and panel, ready to click. Pressing it again
  (or Esc) sends it back.
- **How it's built: A, a Swift app reusing the game code.** A native macOS
  app hosts the existing canvas/JavaScript game in an embedded `WKWebView`,
  the same pattern as `bin/reading-overlay.swift`. No browser is ever opened.
- **Wallpaper view: whatever he last looked at.** City, System or Galaxy,
  for the world he was last in.
- **Aesthetic rule (standing):** every UI piece follows the pixel-art world.
  Icons are hand-drawn on the 12px grid with the shared palette, frames are
  square and beveled, lettering is monospace. **No emoji and no rounded modern
  widgets**, ever.
- **Game content:** everything in page 38 (below) carries over.

## Approaches considered

| | What | Why it was or wasn't chosen |
|---|---|---|
| **A · Swift app + WKWebView (chosen)** | Native window; the game is the existing JS, split into files | Keeps every pixel routine, and Swift can place a window at the desktop layer. Needs no new toolchain and matches how his overlays are built. |
| B · Tauri | Same JS in a Rust-based app | Has no desktop-layer window option, so it would need Mac-specific native code anyway. Needs Rust, which isn't installed. |
| C · Swift/SpriteKit rewrite | Native rewrite | Redoes a working engine for no visible gain. |
| W1 · floating window | Toggle a small overlay | Hidden most of the time, which loses the "always there" feeling |
| W2 · wallpaper only | Watch, never play | Can't click a wallpaper |

## Goals

1. The garden runs as his wallpaper all day, on every Space, on the main
   display.
2. One key switches between **wallpaper** and **play** in well under a second.
   The same window and the same game state are used in both modes.
3. Play mode is the full page-38 game: City, System and Galaxy views, ropes,
   moving, the shop, upkeep, cables, close-ups and price tags.
4. The world **saves** and **keeps going**: progress survives quitting,
   reboots and the Mac sleeping.
5. It's a clean public GitHub repo that someone else could clone, build and
   run.

## Non-goals (v1)

- RIME and TEMPEST, the Dyson ring and sphere, other stars (they stay
  visible but unreachable, as in page 38), sphere and cosmetic customization.
- Windows/Linux, App Store, notarized `.app` distribution, auto-update.
- Multiple displays (main display only), sound, notifications.
- Hooking into the ⌥W wallpaper picker or palette swapping (a later idea).
- The lavish-only parts of the prototype: the "ideas as switches" panel, the
  feedback form, the `pages.js` strip and the explanatory prose. Every switch is
  fixed **on**.

## Anti-goals (failure even if it "works")

- **It interrupts work.** It must never steal focus, pop up, beep or notify
  in wallpaper mode. Clicks on the desktop must still reach Finder.
- **It punishes neglect.** Nothing dies or is lost while he's away. Unmet
  needs only slow things down, as in the prototype's gentle rule.
- **It drifts from the art.** Blurry scaling, emoji, or system-styled
  controls in the game UI.
- **It eats the battery.** It must stay a quiet background process.
- **It feels like a web page.** No scrollbars, text selection, context
  menus, rubber-banding or browser chrome.

## Constraints

- macOS (Darwin 25), Apple Silicon. Swift via Command Line Tools only (no
  Xcode). Node is available for tests.
- No third-party dependencies, in either Swift or JS.
- Palette: Catppuccin Macchiato plus the prototype's own ramps.
- The desktop is OmniWM + skhd + Look. Script keys go in `skhd/skhdrc` and
  launchable things get a row in `bin/look-overlays` (dotfiles repo).
  Free ⌥ keys today: a d e h i k o q u v x y z.

## The design

### Repo and layout

New public repo **`AwesomeAdil/tiny-garden`**, cloned at
`~/Documents/dev/tiny-garden`:

```
tiny-garden/
  README.md            what it is, screenshot/gif, build + run
  Package.swift        SwiftPM executable target "tiny-garden"
  Sources/TinyGarden/  the Mac shell (window modes, hotkey bridge, save file, lifecycle)
  web/                 the game: index.html + JS files + no build step
    index.html
    js/  core (helpers, palette, icons), world (worlds, islands, layout),
         sim (step, routing, costs, upkeep, cables), draw (map, close-ups,
         galaxy, system), ui (dock, panel, shop, price tag, tags), main (loop,
         modes, save/load, Swift bridge)
  tests/               node:test unit tests for the sim (no DOM)
  scripts/install      builds, copies the binary + web/ into place, installs the launch agent
  docs/                this design, the plan, art notes
```

The **simulation must be DOM-free** (pure functions over state), so it can be
unit-tested in node and catch-up time can run without drawing. Drawing and UI
read the state; they never own it.

### The Mac shell

- One borderless window covering the main screen's full frame, with an
  opaque black background so nothing shows through during load.
- The app runs as an accessory (no Dock icon, no app switcher entry, no
  menu bar menu). It's started at login by a LaunchAgent
  (`~/Library/LaunchAgents/local.tiny-garden.plist`) and restarted if it
  crashes.
- **Wallpaper mode** (default): window level = desktop
  (`CGWindowLevelForKey(.desktopWindow)`), `ignoresMouseEvents = true`, and
  `collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]`. It
  never becomes key or active. Desktop icons draw above it as usual.
- **Play mode**: the same window rises to a level above normal windows,
  accepts mouse and keys, becomes key, and the app activates. It covers the
  screen, so "windows step aside" simply means they're behind it. Leaving
  play mode drops it back to the desktop level and gives focus back to the
  app that was frontmost before.
- **The play key** is a global hotkey: skhd runs `tiny-garden toggle`, and the
  running app picks it up (a distributed notification or a small local
  socket; that's the builder's call). Proposed key: **⌥E**, free today. Esc
  inside play mode also returns to wallpaper. Look gets a "Tiny Garden" row
  that does the same toggle. `tiny-garden quit` stops it.
- **Bridge:** Swift ↔ JS through `WKScriptMessageHandler` (JS→Swift: save,
  request wallpaper mode) and `evaluateJavaScript` (Swift→JS: `setMode`,
  `pause/resume`, and the loaded save on start), like the reading overlay.
- **Feels native, not web:** disable text selection, the context menu,
  magnification, scroll bounce and link navigation in the web view.
- **Sleep, lock, full screen:** pause drawing when the screen sleeps or
  locks, or when a full-screen app covers the desktop (the window is
  occluded). The simulation doesn't depend on drawing (see Time).

### Rendering and scale

- The world is drawn at its native size (map 320×200) and scaled up with
  nearest-neighbour only (`image-rendering: pixelated`, an integer scale
  where possible) to fill the screen. A 16:10 screen fits exactly. For other
  aspect ratios, keep the world centred at the largest integer scale and
  fill the margins with the same starfield background, never stretched.
- HTML text labels (island names, tags, price tag) scale with the world, so
  they stay in proportion with the pixels.
- **Frame rate:** about 10 fps in wallpaper mode (walkers, twinkles and the
  galaxy turn slowly) and full rate in play mode. The galaxy's per-pixel
  render already runs at about 10 fps in the prototype.

### Wallpaper mode contents

- Only the world: no dock, panel, guide, stock bar or hints. Island name
  tags stay (small, as in the prototype), plus the "where" label
  (e.g. `TIDE`).
- It shows the view he last used (City / System / Galaxy) for the world he
  last zoomed into. A close-up selection isn't part of wallpaper mode.
- A brief, quiet in-world hint (e.g. a small pixel `⌥E PLAY` tag in a corner)
  for the first few days only. It's never a popup.

### Play mode layout

The lavish layout turns into a full-screen game screen with the same parts:
the **dock** (toolbar) along the top, the **map** filling the screen, and a
**side panel** on the right holding the close-up view and the context panel
(island, bridge, town square, shop, system or galaxy info). Below the map sit
the guide line, stock bar with upkeep, and hint line. All of it uses the
pixel `.px` style and pixel icons from page 37–38. Exact proportions are the
builder's call, but it must look like page 38's game panes, made to fit a
screen.

### Time, saving, and being away

- The sim is stepped from **wall-clock time**: each tick advances by the real
  time since the last tick, in 0.1 s sub-steps, so a throttled or paused web
  view catches up instead of freezing.
- **Save** to `~/Library/Application Support/tiny-garden/save.json` (written
  by Swift, atomically), every 30 s, on mode change, and on quit. The save
  holds every world (nodes, positions, ropes, stocks, levels, found islands,
  docks and quick walkers, upkeep state), cables, UI (last view, world,
  speed), and a timestamp. It has a version field for later migration.
- **On launch,** simulate the time since the save (catch-up), **capped at
  12 hours**. This is my proposal; Adil may change it. Nothing can be lost
  during catch-up, because the gentle rule and the upkeep fraying are
  slowdowns only.
- **New game:** the first launch (no save) starts TIDE with a random layout,
  as in page 38. "New map" in play mode asks for confirmation once, then
  starts over (the old save is kept as `save.prev.json`).
- Page 38's **Skip** button stays as a hidden developer option (a launch
  flag), not in the dock.

### The game (carried over from page 38)

Rules and numbers stay exactly as in page 38's code unless noted:

- **Worlds:** TIDE (ocean, start HOME, goal 8 Tools, 8 Growth, 10 Light,
  10 Heat, bonus Water) and CINDER (lava, start ASH, goal 10 Tools, 20 Heat,
  6 Growth, bonus Heat). RIME and TEMPEST are shown but unreachable.
- **Islands** (one makes, one or two need). TIDE: HOME, EMBER, FROST,
  AMETHYST, VERDANT, ANVIL. CINDER: ASH, EMBERFALL, GEYSER, OBSIDIAN, KILN.
  Random layout around the planet (the town square), checked for
  reachability.
- **Routing:** pull routing to the nearest island that wants a good, else the
  town square. One walker per rope relays goods (carry 3). Islands keep 4 of
  what they need first. The town square keeps one minute of Rock upkeep
  before sharing.
- **Growth:** an island with its needs met thrives, uses 0.1 of each need per
  second, and levels up every 45 s to level 3 (×1, ×1.5, ×2). Unmet needs run
  at ×0.35. Neighbour bonus is +25% (Amethyst, Anvil, Obsidian, Kiln). The
  world bonus is ×1.5.
- **Costs:** a rope costs about d²/1000 Rock (min 1, max reach 112). Moving
  costs 1 Rock per 12 px. Upkeep is 0.2 + length/150 Rock per minute per
  bridge, plus 0.35 per level above 1 per island. If upkeep is unpaid,
  bridges fray and walkers go at half speed.
- **Slots:** 3 bridges per island, 4 for the town square. Each extra bridge
  slows walkers at that dock (÷(1+0.35×extra)).
- **Shop:** first long cable, Wider dock (+1 slot), Quick walker (×1.5 on a
  bridge), Lantern survey (reveal faint islands), Patch kit (−25% upkeep, ×2).
- **Cables:** TIDE↔CINDER tube carries what the other world can't make. The
  star blocks it. Priority is selectable.
- **Views:** City (map + close-ups at the dawn horizon), System (orbits,
  far-side planets drawn behind the star), Galaxy (page 08's "Blade", home
  star Quiet Sun, others named but unreachable).
- **Art:** everything as drawn in page 38: islands, level decorations
  (tree, lamp, cottage, flowers, fireflies), piers, flags, goods sprites,
  pixel icons, price tags.

### Testing

- `node --test tests/`: sim unit tests. They cover routing delivers to
  requesters, the rope cost curve, upkeep fraying and recovery, slot jams,
  each shop item's effect, cable carrying and star blocking, catch-up
  equivalence (one 10-minute catch-up gives the same result as stepping it
  live), and save → load round-trip.
- A scripted 15-minute full-city run must stay solvent (as the page 36
  simulation did).
- Manual checks, listed in the plan:
  - Desktop clicks reach Finder in wallpaper mode.
  - The play key round-trips focus to the previous app.
  - It shows on every Space and hides behind full-screen apps.
  - CPU in wallpaper mode stays low (target: under ~5% of one core; measured,
    not assumed).

### Dotfiles integration (separate, small change in the dotfiles repo)

- `skhd/skhdrc`: `alt - e : <full path>/tiny-garden toggle` (bare env, full
  path, per repo rules; `test/skhd.bats` must pass).
- `bin/look-overlays`: a "Tiny Garden" row.
- Project Library: set `code`, `repo` and stage `building`.

## Settled after the builder check (my calls unless marked)

- **OmniWM must leave the window alone.** The app gets a fixed bundle ID
  (e.g. `local.tiny-garden`) and is added to OmniWM's `excludedBundleIDs`
  **through OmniWM's Settings window** (it rewrites `omniwm/settings.toml`,
  so never hand-edit). The plan includes a manual check that OmniWM neither
  tiles nor hides the window in either mode.
- **Play mode stops below sketchybar** (his bar stays visible, like the
  wallpaper does). It doesn't cover the menu bar area.
- **Time while running:** any gap (Mac asleep, app quit, app throttled) is
  caught up the same way, **capped at 12 hours**. The 1×/4× speed applies
  only while he's in play mode. Wallpaper mode and catch-up always run at
  1×, and speed resets to 1× when play mode ends.
- **Esc backs out one step at a time:** cancel a drag, then close the shop,
  then clear the selection, then leave play mode. It only exits when
  nothing is open.
- **Code wins over this doc.** Every number listed above was checked against
  page 38's code and matches. If anything still differs, page 38's code is
  the truth unless this doc says "change".
- **After both goals (Adil decided):** v1 ends with
  CINDER's cable. Its launch shows "the next planet comes later", and play
  continues as tinkering: growing islands, rearranging, upgrades.

## Left to the builder

- How the toggle command reaches the running app (notification vs socket).
- How JS files load in `WKWebView` (classic scripts in order, or a custom
  URL scheme if ES modules from `file://` don't load). No bundler either way.
- Exact play-mode proportions, and the first-days hint wording and duration.
- File-by-file split of the JS, naming, and the README's look (it should
  open with a pixel-art screenshot or gif).

## Changes after approval

Decisions from the wallpaper polish pass (Task 7b):

- The galaxy and the solar system are fitted to the screen aspect.
- The solar system uses the D3 + Dusk look, with no clutter.
- Names show only in play mode. N toggles them, the choice is remembered, and name slots are stable.
- A fourth view, close (key 4).
- A smoother galaxy.
- Wallpaper text sits below the sketchybar inset.
