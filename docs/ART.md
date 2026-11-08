# tiny-garden art rules (v2)

The look is guarded. v2's art is the "storybook" kit, ported from a design
mockup. (Note: design mockups were private review pages, not in this repo.)
The committed reference renders are `shots/v2/` and `docs/img/`; compare any
drawing change against them.

## The rules

1. **Pixels only.** Everything is whole-pixel `fillRect`, `globalAlpha` and
   `putImageData`, on a canvas 2D context or on `PixCtx`
   (`core/pixctx.js`). No arcs, anti-aliased strokes or smooth gradients:
   soft light is dithered through a ramp with the Bayer matrices (`B8`).
2. **No emoji, no corner labels, no rounded or system-styled controls.**
   Icons are 12px pixel maps (`core/icons.js`), frames are the square,
   beveled `.px` frame (`style.css`), and text is monospace.
3. **Integer scaling.** Canvases are shown with `image-rendering: pixelated`
   at whole-number scales only.
4. **Drawing never changes the game.** Draw code only reads `game` / `w`.
   `tests/draw.test.js` and `web/index.html?dump=1` both check this.
5. **Colours** come from the Macchiato tokens in `core/palette.js` and the
   kit's own ramps in `draw/kit.js`. Keep a new colour next to the routine
   that owns it, and reuse an existing shade before adding one.

## The storybook kit (`web/js/draw/kit.js`)

The kit holds the primitives (`P`, `A`, `hazed`), the sky (`skyLayer`,
`twinkle`, the Milky band), planets (`planetLayer`, `tideWorld`,
`tideColour`), islands (`islandSpec`, `islandSprite`, `makeIsland`,
`getSprite`, `drawIsland`), and the city's bits (`span`, `plank`, `pier`,
`astro`, `PROPS`, `glowAt`, `lamp`). Every random stream is seeded per call;
there are no globals. Island sprites are pre-rendered into a transparent
`PixCtx` and blitted; only animated bits (falls, smoke, lamp flicker,
fireflies, willows, banners) are drawn live.

## The world and its scale

- The sim's world is **640×300** units (`sim/content.js` `W`, `H`).
- Each view's canvas is the stage in device pixels divided by
  `s = max(2, round(stageHeight / 480))`, lowered until the whole world fits
  (`core/pixel.js` `viewScale`). Bigger screens get finer pixels and more
  sky, not stretched art.
- The city maps the world onto its canvas by `k = min(w/640, h/300)`,
  centred (`worldView`). The sim stays in world units.
- **Islands are built natively per band**, at the mapped size: an island's
  sprite is made for its depth band (`far`, `mid`, `near`, with haze .55,
  .25 and 0) at half-width `hw × k`, never a scaled bitmap. Bridges, piers,
  walkers, glows and the town keep their native pixel sizes.

## Close-ups

A close-up is a **zoom, not a rebuild**: the subject's own sprite blitted at
the largest whole zoom that fits (`draw/closeup.js` `zoomFor`: 4, 3 or 2
within about 45% of the width and 80% of the height; `dawnFrame` for the
dawn layout). The subject is the world's selected island, otherwise its
town, over a TIDE limb at sunrise.

## Sky and planet

- **The Milky band**: a tilted galactic band (peach lower left, mauve,
  cool blue upper right) with a dark dust rift through it, stippled with a
  dense band of stars (`kit.js` `milkyBand`, `bandStars`).
- **Seeded TIDE**: each game's home planet has its own continents from the
  game seed (`tideWorld(seed)`), the same in the city, the close-ups and the
  system view.

## Wallpaper cadence

- The wallpaper draws at **6 fps** (`core/cadence.js` `WALL_MS`), and only
  the box of pixels that changed is put on screen (`core/present.js`).
- **Twinkling stars live on CSS-animated layers**, not the canvas
  (`core/stars.js`, `#stars` and `@keyframes twinkle` in `style.css`); they
  pause with the garden (`body.paused`). The full-screen sky around the map
  repaints every 10 s, and the close-up's dawn planet every 4 s.
- Measurements are in `docs/TIMINGS.md`.

## Names

Galaxy and system names are pixel text in the 5×7 `FONT`, placed off the art
by `ui/names.js`. They are a play-mode aid: the wallpaper never shows them,
and N toggles them in play.

## Checking your work

```sh
node scripts/shot.mjs "seed=7&mode=play&view=planet&skip=1" shots/city.png 1512,944
```

`scripts/shot.mjs` shoots `web/index.html` in standalone mode (set `CHROME`
to use a different Chrome binary). Params: `seed`, `mode`
(`play`/`wallpaper`), `view` (`planet`, `system`, `galaxy`, `close`),
`skip=1`, `world=<index>`, `n=<island id>`, `names=0`. It writes the page,
a `-native.png` of the map at its true size, a `-names.png` and, in play, a
`-view.png` of the side close-up. Compare native PNGs enlarged with
nearest-neighbour.
