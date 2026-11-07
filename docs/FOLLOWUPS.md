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
