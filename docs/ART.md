# tiny-garden art rules

The look is guarded. Every change to drawing or UI is checked against
page 38's reference shots:

- `~/dotfiles/.lavish/tiny-garden/img/live-city.png`
- `~/dotfiles/.lavish/tiny-garden/img/live-system.png`
- `~/dotfiles/.lavish/tiny-garden/img/live-galaxy.png`
- `~/dotfiles/.lavish/tiny-garden/img/live-closeup.png`

If the art visibly drifts from these shots, the review fails.

## The five rules

1. **Pixels only.** Everything is drawn as whole pixels on a small canvas:
   the city map is 320×200, the side view is 200×120, and the galaxy, system
   and close-up views have sizes fitted to the screen (see "View sizes" below). Use `P(c, col, x, y, w, h)`
   from `core/pixel.js`, which rounds every rect to whole pixels. Never draw
   arcs, anti-aliased strokes or gradients. Draw soft light the way page 38
   does: dither through a ramp with the Bayer matrices `D` (4×4) or `B8` (8×8).
2. **Shared palette.** Every colour is a Macchiato token or one of the hex
   values already in `core/palette.js`. Add a new colour there first, never
   inline in a draw routine.
3. **Integer nearest-neighbour scaling.** Canvases and icons are scaled
   with `image-rendering: pixelated`, and only by whole numbers (×2, ×3,
   ×4). A 12px icon is shown at 12, 24 or 36 px, never at 18.
4. **No emoji. No rounded or system-styled controls.** Every icon is a
   12px pixel map. Every frame is square and beveled (the `.px` frame
   below). Text is monospace (`ui-monospace, "JetBrains Mono"`).
5. **Drawing never changes the game.** Each draw function takes its
   `game` or world `w` as an argument and only reads from it. There are no
   globals. `tests/draw.test.js` and `web/index.html?dump=1` both check this.

## Palette

Macchiato UI tokens:

| Token     | Hex       |
|-----------|-----------|
| crust     | `#181926` |
| space     | `#14151f` |
| base      | `#24273a` |
| mantle    | `#1e2030` |
| surface   | `#363a4f` |
| text      | `#cad3f5` |
| subtext   | `#a5adcb` |
| mauve     | `#c6a0f6` |
| yellow    | `#eed49f` |
| green     | `#a6da95` |
| red       | `#ed8796` |
| peach     | `#f5a97f` |
| blue      | `#8aadf4` |

Each resource has one colour (`COL`):

| Resource | Hex       |
|----------|-----------|
| rock     | `#a5adcb` |
| heat     | `#f5a97f` |
| water    | `#8aadf4` |
| light    | `#eed49f` |
| growth   | `#a6da95` |
| tools    | `#b7bdf8` |

The icon keys (`PAL`, and `UPAL` for UI icons and goods) map one letter
to one colour. A lowercase letter is the light shade and its uppercase is
the other shade.

| Key | Hex       | Key | Hex       |
|-----|-----------|-----|-----------|
| e   | `#a6da95` | E   | `#5f9a68` |
| v   | `#b7bdf8` | V   | `#7f85c8` |
| c   | `#7dc4e4` | C   | `#4a8fb0` |
| p   | `#f0c6c6` | P   | `#c99a9a` |
| y   | `#eed49f` | Y   | `#fff4d6` |
| b   | `#8aadf4` | B   | `#c9dafb` |
| g   | `#7f849c` | G   | `#a5adcb` |
| o   | `#f5a97f` | r   | `#ed8796` |
| d   | `#a8473f` | m   | `#a98a7c` |
| k   | `#494d64` | n   | `#3f5fa8` |
| w   | `#ffffff` |     |           |
| h   | `#6e5a55` | H   | `#c9a58e` |
| s   | `#24273a` |     |           |

`h`, `H` and `s` exist only in `UPAL`. The scene colours (`C`) and the
dither ramps (`R_ARM`, `R_IN`, `R_CORE`, `R_TEAL`, `R_PINK`) also live in
`palette.js`.

## The 12px icon grid

An icon is an array of up to 12 strings of up to 12 characters. Each
string is a row, read from top to bottom, and each character is one pixel.
`.` is clear, and any key that isn't in the palette is also clear. Leave
the right column and the bottom row clear so the icon has a little air,
as the existing ones do.

`core/icons.js` holds three maps:

| Map     | Size | Keys | Used for                     |
|---------|------|------|------------------------------|
| `ICON`  | 12px | PAL  | resource chips               |
| `UICON` | 12px | UPAL | dock, shop and view buttons  |
| `GOODS` | 8px  | UPAL | goods stacked in close-ups   |

To get an icon, call `iconURL(k)` or `uiconURL(k)`. Each returns a PNG
data URL for an `<img>`, built once and then cached. `goodsCanvas(k)`
returns an 8×8 canvas for `drawImage`. Show icons with
`image-rendering: pixelated` at an integer size.

### Worked example: adding a `bell` UI icon

1. Draw it on a 12×12 grid in UPAL keys. Here `y` and `Y` are the bell,
   `h` is the wooden hanger and `k` is the clapper:

   ```js
   bell:['.....hh.....',
         '.....hh.....',
         '....yyyy....',
         '...yYYYyy...',
         '...yYyyyy...',
         '...yYyyyy...',
         '..yYyyyyyy..',
         '..yyyyyyyy..',
         '.yyyyyyyyyy.',
         '.....kk.....',
         '............',
         '............'],
   ```

2. Add the entry to `UICON` in `web/js/core/icons.js`, next to the
   others. Each row must be exactly 12 characters and there must be 12
   rows. Count them, because a short row shifts every pixel after it.
3. Use it in markup as `<img src="${uiconURL('bell')}" alt="">`, inside a
   `.px` frame, at 24px (×2).
4. Check it with your eyes, enlarged. Keep the colours to two or three
   shades from the palette, with light on the top-left and shade on the
   bottom-right, like every other icon.

## The `.px` frame

Every panel, button and tag frame is square and beveled. Never use a
rounded corner, a system button or a native control style.

```css
.px { border-radius: 0 !important; border: 2px solid #14151f !important;
      box-shadow: inset 2px 2px 0 #494d64, inset -2px -2px 0 #24273a; }
```

- The border is 2px of space colour (`#14151f`).
- The bevel is a 2px inset light edge on the top-left and a 2px inset dark
  edge on the bottom-right.
- A pressed state swaps the two bevel colours. `.dk[aria-pressed]` uses
  `#1e1730` and `#7350a0` on `#4f3876`.
- Action buttons (`.act`) and shop items (`.shopi`) follow the same
  pattern with their own colours. Copy them from page 38's CSS.

## Where each art routine lives

| File                   | Holds                                   |
|------------------------|-----------------------------------------|
| `web/js/core/pixel.js` | `P`, `D`, `B8`, `NZ`/`NN` noise, `pickR`, `mix`, `rgb`, `ramp`, `rngf` |
| `web/js/core/palette.js` | `RES COL NAME PAL UPAL KD C`, ramps, `SURF` planet surfaces |
| `web/js/core/icons.js` | `ICON UICON GOODS`, `iconURL uiconURL goodsCanvas` |
| `web/js/draw/scene.js` | `star planet rock bg pt stream walker pxTree snail lantern tuft firefly sky bridgeOut island levelDeco piles` |
| `web/js/draw/map.js`   | `drawMap ropeDraw geomR reachRing nodeAt` |
| `web/js/draw/closeup.js` | `dawn planetView islandView bridgesOut SQUARE` |
| `web/js/draw/system.js` | `drawSystem tube orb sysAt sysView planeXY sysXY sysSpots` |
| `web/js/draw/galaxy.js` | `galInit drawGalaxy gpos galAt blackHole GSYS discScale galAbove` |
| `web/js/ui/names.js`   | `artMask placeNames` (pure name layout) |
| `web/js/ui/tags.js`    | `renderTags pips renderNames` |
| `web/js/core/icons.js` | also `FONT pixText textW`, the 5×7 name font |

Art that depends on content is set by data in `web/js/sim/content.js`,
never by testing an id in code:

- A world def's `surfKey` picks a `SURF` routine for the planet surface.
- A world def's `squareKey` picks a `SQUARE` style for the town square
  close-up.
- An island def's `deco` picks its decoration (house, sparks, snow,
  crystal, flowers or forge).
- `treeDx`, `treeH`, `grove` and `pine` adjust an island's tree.

## View sizes

`core/pixel.js` `viewSize(view, stageW, stageH)` picks each view's canvas,
counted in device pixels of the stage:

| View | Canvas | Scale |
|---|---|---|
| city (`planet`) | 320×200 | largest whole scale that fits |
| `galaxy`, `system` | `floor(W/s)×floor(H/s)` | `s = max(1, floor(H/288))` |
| `close` | 344×144, widened to cover the stage | largest whole scale for 344×144 |

On the 3440×1440 wallpaper that is 320×200 at 7×, 688×288 at 5× and 344×144
at 10×. The sky canvas fills any margin at the same pixel size.

- **Galaxy.** `galInit(W, H, sc)` takes the size and the disc scale
  (`discScale`: 262 at 688×288, the whole disc with a margin). The jets, the
  black hole and the disc-star count scale with `k = sc/150.4` (stars by k²).
  Only pixels the disc or bulge can reach are recomputed as it turns; the
  rest is space with a seeded starfield (90 per 64 000 px²).
  In wallpaper the disc turns at 0.2 of play's spin, in steps of 2/3 s,
  so its edge moves under one pixel a step and reads as smooth.
- **System, "D3 + Dusk".** The sim keeps its orbit space (centred on
  [160,100]; cable star-blocking is unchanged). `sysView(W, H)` maps it to the
  canvas: centre (W/2, H/2), orbit scale `k = 1.6·min(W/688, H/288)`, plane
  ratio .34, rolled −0.1 rad. Far-side planets go behind the sun and are
  dimmed by .25 (a world with `sys.lift`, like CINDER, gets a brighter night
  instead). The **dusk** is a 4-step ramp `R_DUSK` (space → blue .045 →
  sapphire .08 → teal .12), value `(1 − d/1.25)^1.6` with d the per-axis
  distance from the sun, dithered with B8. It, the sun's corona (R_CORE, 6
  soft lobes, out to 3.3r) and the starfield are built once per size and
  copied in each frame. Orbits are faint dots every ~6 px (`ORBIT`).
  **Trails** run 1.25 rad behind each planet in `mix(sys.col, blue, .45)`,
  then .38 (near) / .62 (far) toward space, solid for the first quarter and
  thinning out through B8. Planets are shaded day / terminator / night
  through B8 with a white highlight, surfaces saturated ×1.25, and an
  optional lit rim (`sys.rim`). Nothing is drawn around planets; in play the
  selected one gets a 3-pixel mauve chevron above it.
- **Close-up (`close`).** `dawn`, `planetView` and `islandView` take `(W, H)`
  (default 200×120, the side panel, drawn exactly as page 38). Wider, the dawn
  planet grows with `f = W/200` (radius 226f, noise and sun offset scaled,
  light radii ×√f, 55 stars per 24 000 px²); the town square keeps page 38's
  layout centred over full-width hills and ground, with extra sky above,
  the sky islands spread over 0.1–0.9 W, and tufts, rocks and a lantern (or
  ember sparks, `SQUARE[k].side`) in the side areas. The subject is the
  world's selected found island, else its town square. The dawn body is
  per-pixel, so in wallpaper it re-renders every 4 s (`rt`).

## Names (galaxy and system)

Page 43's A3. Names are pixel text in the 5×7 `FONT` (advance 6), drawn on
the `#names` canvas over the map at `u` device pixels per font pixel
(`round(0.6·s)`, 2–4: u = 3 at the wallpaper's 5×), with a 1u `#14151f`
shadow. Colours are `NAMEC`: home star yellow, other stars `#8087a2`,
settled worlds blue, others `#6e738d`. Leaders are 1u wide, `#494d64`
(`#6e738d` for home and settled worlds), straight, or with one elbow when
the name had to shift sideways.

`ui/names.js` places them from the frame just drawn: dense bright pixels
(max channel over 60 for the system, 36 for the galaxy, and 3+ in the 5×5
window) are art; names keep off art padded by 2 (system) or 6 (galaxy) px,
off each other and 24 screen px from the edge; leaders never cross
unpadded art. Each name goes above or below the plane's centre line, then
the names on one side snap to one shared row where that stays clear. No
clear spot means no name, never a name over art. A placed name keeps its
slot from one placement to the next while that slot stays clear and its
leader can still reach it, so names hold still and only the leader follows
its star or planet; a name moves only once art covers its slot (slots reset
on a view or size change).

Names are a play-mode aid: the wallpaper never shows them. In play the N key
toggles them (`game.ui.names`, saved, default on).

## The wallpaper and sketchybar

sketchybar covers the top 38 pt of the screen (`TINY_GARDEN_TOP_INSET`;
Swift passes it to `garden.boot` as `{topInset}`). In wallpaper mode the
overlay text at the top of the map (`#where`, `#catch`) moves down by
`--inset` so it is never cut off.

## Checking your work

```sh
node scripts/shot.mjs "seed=7&mode=play&view=planet&skip=1" shots/city.png 1512,944
```

`scripts/shot.mjs` shoots `web/index.html` in standalone mode at the given
window size (default `1512,944`). The params are `seed`, `mode`
(`play` or `wallpaper`), `view` (`planet`, `system`, `galaxy` or `close`;
`city` also works), `skip=1`, `world=<index>`, `n=<island id>`, which
selects an island so the close-ups show it, and `names=0`, which hides the
galaxy and system names.

Each shot writes the page screenshot, a `-native.png` of the map canvas at
its true size, a `-names.png` of the names layer and, in play mode, a
`-view.png` of the 200×120 side close-up. The page-38 references above
still hold for the city and the side panel; the galaxy, system and close-up
references are page 42/43's renders in `img/v42/` and `img/v43/`
(`c-galaxy-out`, `d3-dusk`, `a3-*`, `b1-island-344x144`). Compare the native PNGs with the reference shots, enlarged
with nearest-neighbour. `shots/` is gitignored.

The UI is page 38's game panes at full screen. The map always sits at the
largest whole-number scale in device pixels, with the sky starfield in the
margins. The tags and the price tag scale with `--s`, and the dock and side
panel scale with the whole-number zoom `--ui`.
