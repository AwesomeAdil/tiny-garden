import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escAction } from '../web/js/ui/esc.js';

test('Esc backs out one step at a time', () => {
  assert.equal(escAction({drag:{}, shop:true, sel:{t:'node',id:'ember'}}), 'cancel-drag');
  assert.equal(escAction({drag:null, shop:true, sel:{t:'node',id:'ember'}}), 'close-shop');
  assert.equal(escAction({drag:null, shop:false, sel:{t:'node',id:'ember'}}), 'clear-selection');
  assert.equal(escAction({drag:null, shop:false, sel:{t:'node',id:'planet'}}), 'exit'); });

test('a selected bridge counts as a selection; no selection exits', () => {
  assert.equal(escAction({drag:null, shop:false, sel:{t:'rope',id:3}}), 'clear-selection');
  assert.equal(escAction({drag:null, shop:false, sel:null}), 'exit');
});
