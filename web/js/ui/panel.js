// The side panel, minimal for now (Task 13 writes the full v2 panel): the selected island's name and stage, the
// town's stage, a selected bridge (its way, and Untie), and the system and galaxy selections.
import { node, untie } from '../sim/world.js';
import { sysPlanets } from '../sim/system.js';
import { GSYS } from '../draw/galaxy.js';
import { say } from './guide.js';
import { setView, zoomTo } from './dock.js';

const DEFSEL = { t: 'node', id: 'planet' };
const nameOf = (w, n) => n.kind === 'planet' ? 'The town' : n.name || w.def.isl[n.id].name;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function panelHTML(app) {
  const game = app.game, ui = game.ui, w = app.w, S = w.S;
  if (ui.view === 'galaxy') {
    const g = GSYS.find(x => x.name === ui.galSel) || GSYS[0];
    return [`gal${g.name}`, `<h3 style="color:${g.ours ? 'var(--yellow)' : '#8087a2'}">${esc(g.name.toUpperCase())}<small>${g.ours ? 'your home star' : 'not reached yet'}</small></h3>` + (g.ours ? '<div class="acts"><button class="act" type="button" data-act="tosys">Zoom in</button></div>' : '')];
  }
  if (ui.view === 'system') {
    const ps = sysPlanets(game), p = ps.find(x => x.name === ui.sysSel) || ps[0], on = !!(p.w && p.w.started);
    return [`sys${p.name}${on}`, `<h3 style="color:${on ? '#8aadf4' : '#6e738d'}">${esc(p.name)}<small>${esc(p.full)}</small></h3>` + (on ? '<div class="acts"><button class="act" type="button" data-act="zoom">Zoom in</button></div>' : '<p>Not reached yet.</p>')];
  }
  if (S.sel.t === 'rope') {
    const r = S.ropes.find(r => r.id === S.sel.id);
    if (!r) { S.sel = { ...DEFSEL }; return panelHTML(app) }
    const A = esc(nameOf(w, node(w, r.a))), B = esc(nameOf(w, node(w, r.b))), way = r.way === 0 ? 'Both ways' : r.way === 1 ? `${A} to ${B} only` : `${B} to ${A} only`;
    return [`r${r.id}:${r.way}`, `<h3 style="color:#c9a58e">BRIDGE<small>${A} to ${B}</small></h3><p>${way}. Click the bridge to change it.</p><div class="acts"><button class="act alt" type="button" data-act="untie">Untie</button></div>`];
  }
  const n = node(w, S.sel.id) || w.hub;
  if (n.kind === 'planet') return [`p${n.stage}`, `<h3 style="color:#8aadf4">THE TOWN<small>stage ${n.stage}</small></h3>`];
  return [`i${n.id}${n.stage}${n.name}`, `<h3 style="color:${w.def.isl[n.id].col}">${esc(nameOf(w, n))}<small>stage ${n.stage}</small></h3>`];
}

export function renderPanel(app) {
  const [key, html] = panelHTML(app);
  if (key === app.panelKey) return;
  app.panelKey = key; app.els.panel.innerHTML = html;
}

export function wirePanel(app) {
  app.els.panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const w = app.w, S = w.S, a = b.dataset.act;
    if (a === 'untie') { untie(w, S.sel.id); S.sel = { ...DEFSEL }; say(app, 'Bridge untied.') }
    else if (a === 'zoom') { const p = sysPlanets(app.game).find(x => x.name === app.game.ui.sysSel); if (p && p.w) zoomTo(app, app.game.worlds.indexOf(p.w)) }
    else if (a === 'tosys') setView(app, 'system');
    app.panelKey = ''; renderPanel(app);
  });
}
