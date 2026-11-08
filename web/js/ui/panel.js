// The side panel: an island's name (click to rename), its stage and what the stage still needs, the town and its
// long cable, a selected bridge, and the system and galaxy selections. Progress is shown as "6 of 60", never stock.
import { node, makes, piers } from '../sim/world.js';
import { sysPlanets } from '../sim/system.js';
import { GSYS } from '../draw/galaxy.js';
import { GOODS, NAME } from '../core/palette.js';
import { ico, uico } from '../core/icons.js';
import { cost } from '../sim/flow.js';
import { cableOpen } from '../sim/town.js';
import { rename, openSpots } from '../sim/grow.js';
import { setView, zoomTo } from './dock.js';
import { nameOf, untieRope } from './util.js';
import { say } from './guide.js';

const DEFSEL = { t: 'node', id: 'planet' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// One line per good the node still needs: "<icon> 6 of 60".
const needRows = (w, n) => {
  const c = cost(w, n);
  return GOODS.filter(k => c[k] > 0).map(k => `<p class="need" title="${NAME[k]}">${ico(k)} ${Math.min(n.paid[k], c[k])} of ${c[k]}</p>`).join('');
};

// Renaming: only while the field belongs to the island on show.
export function commitRename(app, text) {
  const n = app.renaming && node(app.w, app.renaming);
  if (!n || n.kind !== 'island' || !rename(n, text)) return false;
  app.renaming = null; return true;
}

export function panelHTML(app) {
  const game = app.game, ui = game.ui, w = app.w, S = w.S;
  if (ui.view === 'galaxy') {
    const g = GSYS.find(x => x.name === ui.galSel) || GSYS[0];
    return `<h3 style="color:${g.ours ? 'var(--yellow)' : '#8087a2'}">${esc(g.name.toUpperCase())}<small>${g.ours ? 'your home star' : 'not reached yet'}</small></h3>` + (g.ours ? '<div class="acts"><button class="act" type="button" data-act="tosys">Zoom in</button></div>' : '');
  }
  if (ui.view === 'system') {
    const ps = sysPlanets(game), p = ps.find(x => x.name === ui.sysSel) || ps[0], on = !!(p.w && p.w.started);
    return `<h3 style="color:${on ? '#8aadf4' : '#6e738d'}">${esc(p.name)}<small>${esc(p.full)}</small></h3>` + (on ? '<div class="acts"><button class="act" type="button" data-act="zoom">Zoom in</button></div>' : '<p>Not reached yet.</p>');
  }
  if (S.sel.t === 'rope') {
    const r = S.ropes.find(r => r.id === S.sel.id);
    if (!r) { S.sel = { ...DEFSEL }; return panelHTML(app) }
    const A = esc(nameOf(w, node(w, r.a))), B = esc(nameOf(w, node(w, r.b))), L = uico('arrow').replace('<img', '<img class="ar l"'), R = uico('arrow').replace('<img', '<img class="ar"');
    const arrows = r.way === 0 ? L + R : r.way === 1 ? R : L, way = r.way === 0 ? 'both ways' : 'one way';
    return `<h3 style="color:#c9a58e">BRIDGE<small>${way}</small></h3><p class="ends"><b>${A}</b> ${arrows} <b>${B}</b></p><p>tap the bridge to change</p><div class="acts"><button class="act alt" type="button" data-act="untie">Untie</button></div>`;
  }
  const n = node(w, S.sel.id) || w.hub;
  if (n.kind === 'planet') {
    let h = `<h3 style="color:#8aadf4">THE TOWN<small>town stage ${n.stage} of 4</small></h3>`;
    if (n.stage < 4) return h + needRows(w, n);
    if (cableOpen(w)) {
      const nx = game.worlds.find(x => x.def.key === w.def.next);
      h += `<h4>the long cable to ${esc((nx ? nx.def.name : 'the next world').toUpperCase())}</h4>` + needRows(w, n);
    }
    return h;
  }
  const col = w.def.isl[n.id].col, renaming = app.renaming === n.id;
  const title = renaming ? `<input id="rn" class="px" type="text" maxlength="10" spellcheck="false" autocomplete="off" value="${esc(nameOf(w, n))}" aria-label="Island name">` : `<button class="nm" type="button" data-act="rename" title="Click to rename">${esc(nameOf(w, n))}</button>`;
  const used = S.ropes.filter(r => r.a === n.id || r.b === n.id).length, sp = openSpots(n).length;
  return `<h3 style="color:${col}">${title}<small>stage ${n.stage} of 4</small></h3>` + needRows(w, n)
    + `<p class="makes">makes ${[...new Set(makes(w, n))].map(k => `<span title="${NAME[k]}">${ico(k)}</span>`).join(' ')}</p>`
    + `<p>piers ${used}/${piers(n)}</p>` + (sp ? `<p class="spots">${sp} ${sp === 1 ? 'spot' : 'spots'} to choose</p>` : '');
}

export function renderPanel(app) {
  const S = app.w.S;
  if (app.renaming && !(S.sel.t === 'node' && S.sel.id === app.renaming && app.game.ui.view === 'planet')) app.renaming = null;
  // While the name field is open, leave the DOM alone so typing isn't interrupted by progress changes.
  if (app.renaming && String(app.panelKey).includes('id="rn"')) return;
  const html = panelHTML(app);
  if (html === app.panelKey) return;
  app.panelKey = html; app.els.panel.innerHTML = html;
  if (app.renaming) { const i = app.els.panel.querySelector('#rn'); if (i) { i.focus(); i.select() } }
}

export function wirePanel(app) {
  app.els.panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const w = app.w, S = w.S, a = b.dataset.act;
    if (a === 'untie') { if (S.sel.t === 'rope') untieRope(app, S.sel.id) }
    else if (a === 'rename') { if (S.sel.t === 'node') app.renaming = S.sel.id }
    else if (a === 'zoom') { const p = sysPlanets(app.game).find(x => x.name === app.game.ui.sysSel); if (p && p.w) zoomTo(app, app.game.worlds.indexOf(p.w)) }
    else if (a === 'tosys') setView(app, 'system');
    app.panelKey = ''; renderPanel(app);
  });
  // The rename field: Enter saves, Esc (handled by the document's Esc chain) cancels, and no other key reaches the
  // game's shortcuts while typing. Moving focus to another control cancels (the window losing focus does not).
  app.els.panel.addEventListener('keydown', e => {
    if (e.target.id !== 'rn' || e.key === 'Escape') return;
    e.stopPropagation();
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (commitRename(app, e.target.value)) { say(app, 'Renamed.'); app.panelKey = ''; renderPanel(app) }
    else say(app, 'Names are 1 to 10 letters or numbers.', true);
  });
  app.els.panel.addEventListener('focusout', e => { if (e.target.id === 'rn' && e.relatedTarget && app.renaming) { app.renaming = null; app.panelKey = ''; renderPanel(app) } });
}
