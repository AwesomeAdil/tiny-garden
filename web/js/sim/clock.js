// The wall clock behind the sim (pure, DOM-free). main.js owns one clock: { lastMs, behind }.
// lastMs is the wall time the sim has been run up to (minus `behind`); behind is time still to catch up, in s.
// Any gap over 1 s (sleep, quit, throttling, a pause) becomes catch-up, capped at 12 h, and is run in chunks of
// at most CHUNK s per frame, never in one go. A backwards clock counts as no time.
export const MAX_GAP = 43200, CHUNK = 1800;

// A clock for a game saved at savedAtMs, booted at nowMs.
export const startClock = (nowMs, savedAtMs) => ({ lastMs: nowMs, behind: Math.min(MAX_GAP, Math.max(0, (nowMs - (savedAtMs ?? nowMs)) / 1000)) });

// One frame at nowMs: `live` s to advance in the current mode, then `chunk` s of catch-up (in wallpaper mode).
export function clockStep(c, nowMs) {
  const dt = (nowMs - c.lastMs) / 1000; c.lastMs = nowMs;
  let live = 0, chunk = 0;
  if (dt > 1) c.behind = Math.min(MAX_GAP, c.behind + dt);
  else if (dt > 0) live = dt;
  if (c.behind > 0) { chunk = Math.min(CHUNK, c.behind); c.behind -= chunk; if (c.behind < 1e-6) c.behind = 0 }
  return { live, chunk };
}

// The wall time the sim is current as of: what a save records. While paused no frame runs, so this stays at the
// last frame and the pause shows up as a gap on the next frame or the next launch.
export const clockSavedAt = c => c.lastMs - c.behind * 1000;
