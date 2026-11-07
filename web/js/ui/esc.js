// What Esc does right now: back out one step at a time (pure, DOM-free).
// cancel drag -> close shop -> clear selection -> exit to wallpaper.
// The town square is the default selection, so selecting it counts as nothing selected.
export function escAction({ drag, shop, sel }) {
  if (drag) return 'cancel-drag';
  if (shop) return 'close-shop';
  if (sel && !(sel.t === 'node' && sel.id === 'planet')) return 'clear-selection';
  return 'exit';
}
