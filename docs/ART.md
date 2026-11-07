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
   the map is 320×200 and the side view is 200×120. Use `P(c, col, x, y, w, h)`
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
| `web/js/draw/system.js` | `drawSystem tube orb sysAt`            |
| `web/js/draw/galaxy.js` | `galInit drawGalaxy gpos galAt blackHole GSYS` |

Art that depends on content is set by data in `web/js/sim/content.js`,
never by testing an id in code:

- A world def's `surfKey` picks a `SURF` routine for the planet surface.
- A world def's `squareKey` picks a `SQUARE` style for the town square
  close-up.
- An island def's `deco` picks its decoration (house, sparks, snow,
  crystal, flowers or forge).
- `treeDx`, `treeH`, `grove` and `pine` adjust an island's tree.

## Checking your work

```sh
node scripts/shot.mjs "seed=7&mode=play&view=planet&skip=1" shots/city.png 1512,944
```

`scripts/shot.mjs` shoots `web/index.html` in standalone mode at the given
window size (default `1512,944`). The params are `seed`, `mode`
(`play` or `wallpaper`), `view` (`planet`, `system` or `galaxy`; `city`
also works), `skip=1`, `world=<index>` and `n=<island id>`, which selects
an island so the close-up shows it.

Each shot writes the page screenshot, a `-native.png` of the 320×200 map
canvas at its true size and, in play mode, a `-view.png` of the 200×120
close-up. Compare the native PNGs with the reference shots, enlarged
with nearest-neighbour. `shots/` is gitignored.

The UI is page 38's game panes at full screen. The map always sits at the
largest whole-number scale in device pixels, with the sky starfield in the
margins. The tags and the price tag scale with `--s`, and the dock and side
panel scale with the whole-number zoom `--ui`.
