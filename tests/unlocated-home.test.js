import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDataset,buildRequest} from '../src/housing-store.js';
import {applyChangeRequest} from '../scripts/manage-homes.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./fixtures/unlocated-residential.json',import.meta.url)));
test('Druzheskiy preserves the original 17 located homes without inventing a point or prices',()=>{
 validateDataset(data);const home=data.homes.find(h=>h.id==='druzheskiy');
 assert.equal(data.homes.length,18);assert.equal(data.homes.filter(h=>Number.isFinite(h.lat)&&Number.isFinite(h.lon)).length,17);
 assert.equal(home.address,'Кремлёвская, 95');assert.match(home.identityNote,/Кремлёвская, 97/);
 assert.equal(home.lat,null);assert.equal(home.lon,null);assert.equal(home.source,null);assert.equal(home.pricing,undefined);
 assert.equal(home.coordinateUnresolved,true);assert.equal(home.officialWebsite,'https://xn--d1accjfe3bkp.xn--p1ai/');
 for(const change of [h=>h.approximate=false,h=>h.coordinateUnresolved=false,h=>h.lon=65.5,h=>h.officialWebsite='javascript:alert(1)']){const draft=structuredClone(home);change(draft);assert.throws(()=>validateDataset({schemaVersion:1,homes:[draft]}));}
});
test('owner workflow can preserve and update an explicitly unlocated home',()=>{
 const draft=structuredClone(data);draft.homes.find(h=>h.id==='druzheskiy').identityNote+=' Адрес требует дальнейшей проверки.';
 const request=buildRequest(data,draft,'base');assert.equal(request.changes.length,1);
 const result=applyChangeRequest(data,request,'base',{repository:'evrey117/tumen-map',event:'workflow_dispatch',ref:'refs/heads/main',actorId:'101',ownerId:'101'});
 assert.deepEqual(result,draft);assert.equal(result.homes.at(-1).lat,null);
});
