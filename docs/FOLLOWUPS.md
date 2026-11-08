# Follow-ups

Deferred minor findings and parked items from the v1 build reviews (2026-11-07). None block v1.

Task 4: minor (deferred): ui.world/ui.view not range-checked in deserialize; savedAt non-number → 0 undocumented
Task 5: minor (deferred): serve.mjs decodeURIComponent outside try (dev only); planetView unused game param (plan-mandated signature); TIDE named in draw.test/art.html (test code)
Task 6: minor (deferred): style.css crisp-edges after pixelated; tags at 4 Hz step vs sprites in system/galaxy; new map resets firstSeen; double save on new map; Esc in system/galaxy skips clearing selection; window.__app/__errs exposed + dock↔panel↔input import cycle + inline hex in panel; no committed test for main.js clock
Task 7: minor (deferred): restoreFocus may reactivate a stale app; SaveStore.load try? hides unreadable file; move() remove-then-move window; ready not reset on WebContent reload; play-mode screen change re-activates; activate(ignoringOtherApps:) deprecated; --skip no-op in app
Task 7: minor (deferred): no post-fix wallpaper screenshots committed (parity by code review + probe ≤4/255); 3 fps wallpaper / sky 10 s re-twinkle = trade-off to show Adil
Task 7b: minor (deferred): galaxy rotation jump on mode switch; lone stars may sit beside names; CPU script touched live save ui.view (restored)
Task 8: minor (deferred): README no gif; README keys not cross-checked vs app
parked — cover snapshot taken in any mode (could show stale play screen on a crash halt) — Ruling S: deferred to the next round with the resource fixes; only matters after 3 WebContent crashes in 5 min — cost if wrong: a stale frame shown until next toggle
parked — rapid play→wallpaper→play toggle may drop play once — Ruling T: accept, one toggle recovers — cost: a rare extra keypress

## Next up (from Adil)
- Resources: the town square hoards surplus that clogs bridges (e.g. FROST water through EMBER starves Heat). Proposed: town square only takes what it can use; show bridge jams in the guide.
- Goods lying loose on islands and planets: replace with storage (mockup round first).
- Live checks still to do: Finder clicks on the wallpaper, Spaces, full-screen apps, plugging in a display, ⌘Tab out of play, OmniWM exclusion.

# v2 follow-ups (2026-11-08)

## Later, not now (from the v2 design)
- A Dyson ring or sphere.
- Drawing your own art: a folder of PNGs the game picks up.
- Inviting events with goods (today they come at random).

## Decided
- ~~Wallpaper CPU at 10 fps is about 12% (city) and 14% (galaxy), against the 5% budget.~~ **Decided 2026-11-08:**
  6 fps wallpaper plus twinkling stars on CSS-animated layers (paused with the garden). The on-device CPU run is
  still pending: it needs the desktop visible (docs/TIMINGS.md, "6 fps + CSS stars").

## Seen in the Task 14 shots
- 1512×944 play, system view: CINDER (selected) has no name label.
- 1512×944 play, galaxy view: the GIANT'S RING and QUIET SUN labels nearly touch.
- 1512×944 galaxy wallpaper: a faint horizontal seam where the map meets the sky canvas below it.

## Deferred minor findings from the v2 task reviews

### Growth and picks (sim/grow.js)
- T3: the grow message uses the island type's name, not `n.name` (grow.js:20).
- T3: offers can return fewer than 2 picks under narrow filters (grow.js:299); no test pins the 2–3 offer floor.
- T3: a redundant `!n.sends` check (grow.js:296).
- T3: no test that the hub is ignored by `spotKind`; no test of "satisfied" carrying across a real grow.
- T3: the content test counts pier picks across all goods, looser than per spot.

### Town and cable (sim/town.js)
- T4: town.test.js:212 `deepEqual(bool)` checks water only; unexplained setup at town.test.js:204.
- T4: the autoPick / skip redundancy pass is untested.
- T4: a silent -1 next-world branch (town.js:25); stage overpay is discarded.
- T10: the town has two sources of truth (`TOWN` and `w.hub`).

### Events and gifts (sim/events.js, ui/card.js)
- ~~T5: the "while you were away" line is said even when a full tray dropped the gift.~~ Fixed: it says "The tray was full."
- T5: TRAVELLER_NAMES 12–13 are unreachable; `placeGift` on the planet node has no guard.
- T5: no test that an `ev` JSON round-trip continues the event stream.
- T12: gifts are keyed by index; the tray previews on the HOME rock.
- ~~T13: `eventLine` has no fallback.~~ Resolved: it falls back to "Someone is passing by!".

### Saving (sim/save.js, SaveStore.swift)
- T6: unknown pick ids survive prune (save.js:41); `cleanEv` does not check `active.world` / variant.
- T6: ~~`keepV1` replaces an older save.v1.json~~ (fixed: a second v1 save is kept as `save.v1-<stamp>.json`); no Swift test of it; no test for caught + active; no cable shape check.

### Drawing (draw/*.js, core/pixctx.js)
- T8: an unused `drawMap` import and a bare `{}` block in drawMain; stale comments in main.js.
- T8: `worldOffset` can go negative at s=1 (the city and input tolerate it).
- T9: `islandSpec` is recomputed every frame (CPU; the frame still fits the budget, docs/TIMINGS.md).
- T9: piers are in the sprite key but unused; dead consts in `fillRect` (pixctx.js:189).
- T9: house window glow and smoke ignore flip / w; the centrepiece hides part of the spot-1 tree; verdant clump spacing.
- T10: `edgeOf` runs off the body for stacked piers; per-frame allocations in `span` / `hazed`.
- T10: the layout's last-resort throw needs a comment.
- T11: the glint jumps between arcs at w = .5.
- T13: one SCRATCH buffer per size.

### Play UI (ui/*.js)
- T12: a bridge tap both cycles it and selects it; the island hit box is a rectangle.
- T12: leftover shop / rope naming in code; unused CSS. ~~The "pick Rope" guide line.~~ Resolved: the guide no longer says it.
- T12: a util.js <-> card/panel import cycle (safe today).
- T13: renaming state survives a view change; the `rename=1` dev param has no guard.

### Tests
- T8: the scale tests don't pin the max(2) floor or the round boundary; the corner-label test checks only index.html.
- T9: the LRU test can't catch FIFO; the falls test's first assertion is weak; the waterfall-pick path is untested.
- T9: no direct test of transparent `fillRect` / `drawImage`.
- T10: the boot test doesn't cover a save that makes drawCity throw.
- T11: dead code and a vacuous assert in system.test.js:259/273; planetView zoom 1 untested.
- T12: hub-miss tests use `notEqual`.

### Docs
- T7: TIMINGS.md's pacing rows use a separate table with mismatched columns.
- T9: the SPOT_X comment.
