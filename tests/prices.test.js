import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRICE_CATEGORIES,validatePricing,formatPrice} from '../src/prices.js';
import {validateDataset,buildRequest,requestMatchesDataset} from '../src/housing-store.js';
import {applyChangeRequest} from '../scripts/manage-homes.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/residential.json',import.meta.url)));
const evidence=JSON.parse(fs.readFileSync(new URL('../public/data/price-evidence.json',import.meta.url)));
const owner={repository:'evrey117/tumen-map',event:'workflow_dispatch',ref:'refs/heads/main',actorId:'101',ownerId:'101'};
test('all 85 categories exactly match eligible Excel evidence; 37 archived rows never become prices',()=>{
 validateDataset(data);let filled=0,missing=0;
 for(const home of data.homes){
  const name=Object.keys(evidence.mapping).find(name=>evidence.mapping[name]===home.id);
  assert.equal(Object.keys(home.pricing.categories).length,5);
  for(const [key,label] of Object.entries(PRICE_CATEGORIES)){
   const entry=home.pricing.categories[key],offers=evidence.sheets['Источники'].slice(1).filter(row=>row[1]===name&&row[2]===label&&row[11]===1);
   if(offers.length){filled++;assert.equal(entry.amount,Math.min(...offers.map(row=>row[3])));const row=offers.find(row=>row[0]===entry.offerId);assert.ok(row);assert.equal(entry.url,row[5]);assert.equal(entry.area,row[4]);assert.equal(entry.conditions,row[7]);assert.equal(entry.checkedAt,row[6]);}
   else{missing++;assert.equal(entry.amount,null);assert.ok(entry.reason);}
  }
 }
 assert.equal(filled,67);assert.equal(missing,18);assert.equal(evidence.sheets['Источники'].length-1,104);
 assert.equal(data.homes.find(h=>h.id===13).pricing.categories.studio.amount,3257600);
 assert.equal(data.homes.find(h=>h.id===5).pricing.categories.three.amount,8725000);
});
test('pricing rejects injected URLs, invalid dates, negative/fractional prices and unknown fields; legacy homes remain valid',()=>{
 const original=data.homes[0].pricing;
 for(const change of [p=>p.website='javascript:alert(1)',p=>p.website='https://user:password@example.com',p=>p.checkedAt='2026-02-30',p=>p.categories.studio.amount=-1,p=>p.categories.studio.amount=1.5,p=>p.categories.studio.amount='5220000',p=>p.categories.studio.url='data:text/html,evil',p=>p.categories.studio.area=-3,p=>p.categories.studio.secret='hidden',p=>delete p.categories.four]){const p=structuredClone(original);change(p);assert.throws(()=>validatePricing(p));}
 const legacy=structuredClone(data);for(const h of legacy.homes)delete h.pricing;assert.equal(validateDataset(legacy).homes.length,17);
 assert.equal(formatPrice(null),'Цена не указана');assert.match(formatPrice(5220000),/5\s220\s000 ₽/);
});
test('price edits and removal persist through existing owner workflow, cross-device reload and restore',()=>{
 const draft=structuredClone(data);draft.homes[0].pricing.categories.studio.amount=6000000;draft.homes[0].pricing.categories.four={amount:null,checkedAt:'2026-11-02',reason:'Цена удалена'};
 const request=buildRequest(data,draft,'base');assert.equal(request.changes.length,1);
 const saved=applyChangeRequest(data,request,'base',owner);assert.deepEqual(saved,draft);
 const secondDevice=JSON.parse(JSON.stringify(saved));assert.equal(secondDevice.homes[0].pricing.categories.studio.amount,6000000);assert.equal(requestMatchesDataset(request,secondDevice),true);
 const restored=applyChangeRequest(saved,{version:1,action:'restore',baseRevision:'next',restoredFrom:'a'.repeat(40)},'next',owner,data);assert.deepEqual(restored,data);
 assert.throws(()=>applyChangeRequest(data,request,'base',{...owner,actorId:'102'}));
});
