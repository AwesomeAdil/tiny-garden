| Date | Task | Size | Wall-clock | Source |
|---|---|---|---|---|
| 2026-11-07 | Task 7: Mac app (Swift shell, installer, desktop checks) | 6 Swift files, 2 plists, install script | ~15 min agent wall-clock (first build 27 s, release build + install 27 s) | measured |

## Wallpaper CPU (Task 7, Step 6 item 6)

The target is under about 5% of one core for the **whole** wallpaper: the app plus WebKit's WebContent and GPU
helper processes. All numbers below are on the 3440×1440 @1x main display, with the garden visible (not paused),
taken by `top -l 2 -s 20` over the app pid and the three WebKit helpers it started. WindowServer is listed
for information only: it idles at about 20% on this machine with the garden quit.

**Verdict: PASS, just.** After 2 minutes in each view the total is 4.0 (city), 4.0 (system) and 4.9 (galaxy).
Before the fix it was 18.1, 18.3 and 21.9.

### Final (fix round 1), after 2 min in each wallpaper view

| View | app | WebContent | GPU | **Total** | WindowServer |
|---|---|---|---|---|---|
| city | 0.5 | 1.6 | 1.9 | **4.0** | 24.8 |
| system | 0.5 | 1.5 | 2.0 | **4.0** | 23.0 |
| galaxy | 0.5 | 2.4 | 2.0 | **4.9** | 22.8 |

### Before (Task 7 as first shipped: 10 fps, full-screen sky every frame)

| View | app | WebContent | GPU | **Total** |
|---|---|---|---|---|
| city | 1.7 | 5.1 | 11.3 | **18.1** |
| system | 1.9 | 5.0 | 11.4 | **18.3** |
| galaxy | 1.4 | 7.7 | 12.8 | **21.9** |

### Where the cost was, and what each change saved (20 s samples after 15 s warm-up)

Each frame WebKit puts on screen costs about 1% of a core, and more the more screen it covers: the GPU
process repaints the CSS-scaled canvas into the page. Drawing the art itself is cheap: about 0.5 ms
for a city frame, and about 4 ms for the per-pixel galaxy.

| Step | city | galaxy | Kept? |
|---|---|---|---|
| Baseline (10 fps, sky every frame) | 18.1 | 21.9 | – |
| Map at 4 fps, full-screen sky at 1 fps | 7.3 | 10.4 | yes (then 3 fps and every 10 s) |
| `will-change: transform` on #map and #sky | 7.3 | 10.6 | no: no change |
| `willReadFrequently` (software) canvases | 7.9 | 10.0 | no: no change |
| Probes: nothing drawn / sky only at 1 Hz / static map updates at 4 Hz | 1.0 / 2.5 / 4.2 | – | the per-frame cost is in display, not drawing |
| Map split into 160 tiles, only changed tiles redrawn (about 9% per frame) | 7.1 | 11.3 | no: the area that changed doesn't matter |
| Same, each tile its own layer | 7.6 | – | no |
| Draw in JS (PixCtx), then one `putImageData` per frame, skipping unchanged frames | 5.3 | – | yes |
| Pre-scaled device-size #wall canvas | 5.7 | – | no |
| CSS `transform: scale()` (4.0, but blurry: CA filters it linearly) | 4.0 | – | no: breaks crisp pixels |
| Galaxy disc recomputed in 0.5 s turn steps, panel/tags at 1 Hz in wallpaper | 5.3 | 6.6 | yes |
| 3 fps, galaxy turning in 1 s steps | 4.0 | 5.0 | yes (final) |

Play mode is unchanged: animation frames, with the #map canvas drawn as before.
