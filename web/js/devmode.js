// Developer mode's sandbox (pure: main.js hands it the bridge, a snapshot of the live game and its boot path).
//
// The real garden is never touched by dev mode. Entering saves the real game as it is (an untagged save, so
// Swift writes save.json) and keeps that snapshot (`stash`); the sandbox then boots in its place. While dev is on,
// every message the page sends carries dev:true, and Swift writes those saves to save.dev.json and ignores
// bad-save, old-save and new-map, so save.json is never written, archived, quarantined or set aside from dev.
// Leaving (⌥⇧D, `tiny-garden dev` toggles on only, or any switch to the wallpaper) saves the sandbox (dev:true),
// tells Swift, and boots the stash through the normal boot path, so the real game's clock catches up the time
// spent in dev like any other gap.
//
// JS -> Swift: {type:'dev', on:true} asks for the sandbox; Swift answers garden.boot(<save.dev.json | null>,
// 'play', now, {dev:true}) (or ignores it when not in play). {type:'dev', on:false} says dev has ended.
// Standalone (no Swift, ?dev=1) keeps the sandbox in memory (`mem`) instead of save.dev.json.
export const tagDev = (msg, on) => on ? { ...msg, dev: true } : msg;

// io: { native, post(msg) (the raw bridge), snapshot() (the live game's save object), boot(saveObj, mode, opts) }.
export function devSession(io) {
  const s = { on: false, pending: false, stash: null, mem: null };
  // Every page -> Swift message goes through here.
  s.send = msg => io.post(tagDev(msg, s.on));
  s.enter = () => {
    if (s.on || s.pending) return false;
    const real = io.snapshot();
    s.stash = real;
    io.post({ type: 'save', save: real });
    if (io.native) { s.pending = true; io.post({ type: 'dev', on: true }) }
    else io.boot(s.mem, 'play', { dev: true });
    return true;
  };
  // garden.boot calls this first: a dev boot turns dev on; any other boot (the restore, a page reload) ends it.
  s.booted = dev => { s.pending = false; s.on = !!dev; if (!dev) s.stash = null };
  // A switch to the wallpaper before Swift answered.
  s.cancel = () => { s.pending = false };
  s.leave = mode => {
    if (!s.on) return false;
    const sand = io.snapshot();
    s.send({ type: 'save', save: sand });
    s.mem = sand;
    io.post({ type: 'dev', on: false });
    const real = s.stash;
    s.on = false; s.stash = null;
    io.boot(real, mode, {});
    return true;
  };
  return s;
}
