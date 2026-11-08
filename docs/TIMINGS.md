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

## Wallpaper CPU (Task 7b: fitted views, Dusk system, close-up, smooth galaxy)

Same method as Task 7: 3440×1440 @1x, the app plus the three WebKit helpers it started, `top -l 2 -s 20`
after a 100 s warm-up (about 2 minutes per view). The garden is restarted per view with `ui.view` set in
save.json; the script:

```sh
# m.sh VIEW WARM SAMPLE
tiny-garden quit; while pgrep -qx tiny-garden; do sleep .1; done
python3 -c 'import json,sys; p=sys.argv[1]; s=json.load(open(p)); s["ui"]["view"]=sys.argv[2]; json.dump(s,open(p,"w"))' \
  "$HOME/Library/Application Support/tiny-garden/save.json" "$VIEW"
before=$(pgrep -f 'com.apple.WebKit\.(WebContent|GPU|Networking)' | sort)
launchctl kickstart gui/$(id -u)/local.tiny-garden; sleep 3
after=$(pgrep -f 'com.apple.WebKit\.(WebContent|GPU|Networking)' | sort)
new=$(comm -13 <(echo "$before") <(echo "$after")); sleep "$WARM"
top -l 2 -s "$SAMPLE" -pid $(pgrep -x tiny-garden) $(for p in $new; do echo -pid $p; done) -stats pid,command,cpu
```

The machine was busier than during Task 7 (WindowServer 13–27 instead of 23–25), so the 69e014e build
(Task 7's) was measured again in the same session as the baseline.

| View | 69e014e, Task 7 log | 69e014e, same session | **7b** | 7b canvas |
|---|---|---|---|---|
| city | 4.0 | 5.2 | **5.1** | 320×200 at 7× |
| system | 4.0 | 4.6 | **4.7** | 688×288 at 5× |
| galaxy | 4.9 | 4.7 | **4.7** | 688×288 at 5× |
| close | – | – | **4.8** | 344×144 at 10× |

Verdict: no view costs more than Task 7's build did under the same conditions (differences are within the
±0.3 noise). The city is 5.1 only because the session baseline was 5.2.

What it took (7b steps, same session):

| Step | system | galaxy |
|---|---|---|
| First build: names on in wallpaper (re-placed every second), names canvas always shown, galaxy disc recomputed every frame at 0.4 spin | 5.4 | 7.1 |
| Names never in wallpaper; an empty names canvas is `display:none` (a full-screen transparent layer still costs a composite per frame) | 4.7 | 5.4 |
| Galaxy at 0.2 of play's spin, disc recomputed in 2/3 s steps (0.75 px at the edge per step) | – | **4.7** |

Other measures:
- The galaxy disc only recomputes "active" pixels (where the disc or bulge can reach, about a fifth of
  688×288) from precomputed per-pixel factors: about 2.5 ms per turn step in Node, against 4 ms for the
  whole 320×200 before.
- The system's dusk, sun corona and starfield are built once per size and copied in.
- The close-up's dawn planet body re-renders every 4 s in wallpaper (it drifts under a pixel in that time).

| Date | Task | Size | Wall-clock | Source |
|---|---|---|---|---|
| 2026-11-07 | Task 7b: fitted views, Dusk system, names, close-up, smooth galaxy | 20 files, 3 new | ~2.5 h agent wall-clock (6 rounds of 2 min × 4-view CPU runs ≈ 45 min of it) | measured |

## Tiny garden v2 pacing (Task 7)

| Date | Task | Size | Wall-clock | Source |
|---|---|---|---|---|
| 2026-11-07 | v2 Task 7: pacing test + tuning (`tests/pacing.test.js`) | seeds 1/2/3, 1 s steps, autoNet + autoPick every 60 s | test ~13 s total (4-5 s per seed). Sim time: first stage-up 227 / 109 / 107 s; cable 223 293 / 204 592 / 197 506 s (RATE 1/25, STAGE_COST [0,4,300,1500], TOWN_COST [0,40,400,1200], CABLE_COST 6000) | measured |

## Wallpaper CPU (v2 Task 14: 10 fps wallpaper)

Adil's v2 requirement: walkers, waterfalls, events and twinkling at 10 fps or more in wallpaper mode, inside v1's
budget of about 5% aggregate, by cheaper frames and never a lower frame rate. **Verdict: over budget.** The city
at 10 fps costs about 12% of a core, against 4.4 at 3 fps. Stopped and reported, as the plan says.

Method: 3440×1440 @1x, the app plus the WebKit helpers it started (new pids after a `launchctl kickstart`),
`ps -o %cpu,time` every 5 s after a 30 s warm-up. "cpu" below is the mean of the cpu-time deltas over each 5 s
interval (ps's own %cpu is a decaying average; it reads 1–2 points lower). Samples taken while the garden was in
play mode or paused are dropped. Experiments swapped files inside the installed bundle and restarted the agent.
WindowServer is not counted.

| Date | Build | View | Frames | app | WebContent | GPU | **Total** | Run |
|---|---|---|---|---|---|---|---|---|
| 2026-11-08 | v1 (as installed) | city | 3 fps | 0.7 | 2.5 | 2.4 | **5.6** | 40 s (Adil opened play after that) |
| 2026-11-08 | v2, whole frame | city | 3 fps | 0.5 | 1.8 | 2.1 | **4.4** | 2 min |
| 2026-11-08 | v2, whole frame | city | 10 fps | 1.4 | 4.3 | 6.0 | **11.7** | 2 min |
| 2026-11-08 | v2, changed rows (row band) | city | 10 fps | 1.4 | 3.4 | 5.0 | **9.8** | 31 intervals of 5 min (Adil played in between) |
| 2026-11-08 | v2, ~100 tile rects per frame (32×16) | city | 10 fps | 0.7 | 24.1 | 6.1 | **30.9** | 2 min |
| 2026-11-08 | v2, fillRect per changed run | city | 10 fps | 1.4 | 5.4 | 5.5 | **12.2** | 2 min |
| 2026-11-08 | v2, changed box (committed) | city | 10 fps | 1.4 | 4.5 | 6.4 | **12.2** | 2 min |
| 2026-11-08 | v2, changed box (committed) | galaxy | 10 fps | 1.3 | 6.6 | 6.1 | **13.9** | 2 min |
| 2026-11-08 | probe: changed box, twinkling frozen | city | 10 fps | 1.2 | 4.3 | 3.3 | **8.8** | 2 min |
| 2026-11-08 | probe: only a 16×16 put per frame | city | 10 fps | 1.1 | 4.0 | 1.1 | **6.3** | 2 min |
| 2026-11-08 | **v2, changed box (committed), headline** | city | 10 fps | 1.4 | 4.5 | 6.3 | **12.1** (p90 12.6; ps %cpu mean 10.6, p90 12.6) | 5 min, 60 samples |

What the probes say:
- **WebKit repaints one box around everything drawn in a frame.** The GPU cost follows that box's area: about 1%
  for a 16×16 put, about 6% for the whole canvas. A hundred small puts or a few hundred 1-pixel fillRects cost as
  much GPU as one put of the box around them, and each putImageData call costs about 0.2 ms in WebContent.
- **Twinkling stars are spread over the whole sky,** so some star changes in almost every row and column of every
  frame: in Node, a city frame changes only 400–700 pixels, but their box covers 89% of the canvas. With twinkling
  frozen the box is 2% (new game) to 28% (mid-game), and the total drops to 8.8.
- **About 5% is per frame whatever changes** (the 16×16 probe: WebContent 4.0, app 1.1, GPU 1.1): drawing in JS
  (0.4–0.5 ms per city frame in Node), comparing the frame (0.5 ms) and WebKit's per-frame commit. At 10 fps that
  alone is the whole budget.
- So no put strategy reaches 5% at 10 fps. What could: twinkling moved out of the canvas (for example CSS-animated
  star elements that Core Animation runs without WebKit drawing), plus cutting the per-frame JS. That is a
  design change, left for Adil's decision (docs/FOLLOWUPS.md).

### 6 fps + CSS stars (Adil's decision, 2026-11-08)

Wallpaper at 6 fps (`WALL_MS = 167`). The twinkling stars are on 6 CSS-animated layers over the map
(core/stars.js), so the canvas only changes where walkers, waterfalls and events move. In Node (city, 1/6 s
frames) the repaint box goes from 91% of the canvas to 3.3% in a fresh game (33 of 60 frames put nothing) and
31% mid-game. The on-device CPU run is pending: the desktop was covered (garden paused) for the whole window I had.

| Date | Task | Size | Wall-clock | Source |
|---|---|---|---|---|
| 2026-11-08 | v2 Task 14: 10 fps cadence, dirty-box present, CPU runs, shots, docs | 3 code files, 16 shots, 4 docs | ~1.5 h agent wall-clock (about 50 min of it CPU runs, several restarted when Adil was playing) | measured |
