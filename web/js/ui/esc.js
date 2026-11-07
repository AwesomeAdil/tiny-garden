// Pure keyboard helpers (DOM-free): what Esc does, and the order Tab walks the views in.

// The big views, in dock and Tab order: 1 city, 2 system, 3 galaxy, 4 close-up.
export const VIEWS = ['planet', 'system', 'galaxy', 'close'];
export const nextView = v => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length];

// What Esc does right now: back out one step at a time.
// cancel drag -> close shop -> clear selection -> exit to wallpaper.
// The town square is the default selection, so selecting it counts as nothing selected.
export function escAction({ drag, shop, sel }) {
  if (drag) return 'cancel-drag';
  if (shop) return 'close-shop';
  if (sel && !(sel.t === 'node' && sel.id === 'planet')) return 'clear-selection';
  return 'exit';
}
