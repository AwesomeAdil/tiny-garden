import { slots } from './economy.js';

const say = (w, msg, warn) => w.events.push({ msg, warn: !!warn });
const nextWorld = (game, w) => w.def.next ? game.worlds.find(x => x.def.key === w.def.next) : null;

export const SHOP_ITEMS = [
  { id: 'cable', icon: 'cable', name: 'The first long cable',
    what: (game, w) => { const n = nextWorld(game, w); return n ? 'Reaches ' + n.def.name + ', the ' + n.def.full + ', and starts trade between the two planets.' : 'The next planet comes later.' },
    cost: (game, w) => w.def.goal, target: 'none', can: (game, w) => !w.S.cable },
  { id: 'dock', icon: 'dock', name: 'Wider dock',
    what: () => 'One more bridge slot on an island or the town square, so it can take another bridge without jamming.',
    cost: () => ({ rock: 4, tools: 2 }), target: 'node' },
  { id: 'fast', icon: 'walker', name: 'Quick walker',
    what: () => "This bridge's walker goes 50% faster. Good for long, busy bridges.",
    cost: () => ({ tools: 2, heat: 2 }), target: 'rope', can: (game, w, t) => !!t && !t.fast },
  { id: 'survey', icon: 'survey', name: 'Lantern survey',
    what: () => 'Light up the faint islands, so you can see what each one makes before you tie a rope to it.',
    cost: () => ({ light: 4 }), target: 'none', can: (game, w) => !w.S.survey },
  { id: 'patch', icon: 'patch', name: 'Patch kit',
    what: (game, w) => 'Upkeep goes down a quarter for good. Bought ' + w.S.patch + ' of 2.',
    cost: () => ({ tools: 4, growth: 3 }), target: 'none', can: (game, w) => w.S.patch < 2 },
];

export function canBuy(game, w, id, target) {
  const it = SHOP_ITEMS.find(x => x.id === id);
  if (!it) return false;
  if (it.target !== 'none' && !target) return false;
  if (it.can && !it.can(game, w, target)) return false;
  const c = it.cost(game, w);
  return Object.keys(c).every(k => w.hub.stock[k] >= c[k]);
}

const tname = (w, it, tg) => it.target === 'node'
  ? (tg.kind === 'planet' ? 'the town square' : w.def.isl[tg.id].name)
  : '';

export function buy(game, w, id, target) {
  if (!canBuy(game, w, id, target)) return false;
  const it = SHOP_ITEMS.find(x => x.id === id), c = it.cost(game, w);
  Object.keys(c).forEach(k => w.hub.stock[k] -= c[k]);
  if (id === 'cable') launch(game, w);
  else if (id === 'dock') { target.dock = (target.dock || 0) + 1; say(w, 'Wider dock on ' + tname(w, it, target) + ': ' + slots(target) + ' slots now.') }
  else if (id === 'fast') { target.fast = true; say(w, 'Quick walker hired.') }
  else if (id === 'survey') { w.S.survey = true; say(w, 'The lanterns show every faint island.') }
  else if (id === 'patch') { w.S.patch++; say(w, 'Patched: upkeep is down a quarter.') }
  return true;
}

// Starts the world named by w.def.next and joins the two hubs with a cable.
export function launch(game, w) {
  w.S.cable = true;
  const nx = nextWorld(game, w);
  if (nx && !nx.started) {
    nx.started = true;
    game.cables.push({ a: game.worlds.indexOf(w), b: game.worlds.indexOf(nx), u: 0, dir: 0, load: [], blocked: false });
    say(w, 'The first long cable is up! It reaches ' + nx.def.name + ', a ' + nx.def.full + '. Press System to zoom out.');
  } else say(w, 'Cable launched. The next planet comes later.');
}
