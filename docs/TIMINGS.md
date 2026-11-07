| Date | Task | Size | Wall-clock | Source |
|---|---|---|---|---|
| 2026-11-07 | Task 7: Mac app (Swift shell, installer, desktop checks) | 6 Swift files, 2 plists, install script | ~15 min agent wall-clock (first build 27 s, release build + install 27 s) | measured |

## Wallpaper CPU (Task 7, Step 6 item 6)

Measured 2 min 25 s after launch in wallpaper mode, garden visible (not paused), 3440×1440 @1x main display,
`top -l 2 -s 20 -stats pid,command,cpu`:

| Process | %CPU |
|---|---|
| tiny-garden (the app) | 1.5–1.7 |
| com.apple.WebKit.WebContent (the JS game) | 5.2 |
| com.apple.WebKit.GPU (compositing) | 11.5 |
| com.apple.WebKit.Networking | 0.0 |
| **Total** | **~18.4** |

The app itself is under the 5% bar; the WebKit helpers that draw the 10 fps wallpaper are not counted by
`top -pid $(pgrep -x tiny-garden)` and add about 17%. The garden pauses while its window is fully covered.
