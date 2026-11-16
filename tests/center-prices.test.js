import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDataset} from '../src/housing-store.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../public/data/residential.json'),evidence=read('../public/data/center-price-evidence.json');
test('central prices use available developer offers; reserved lots and other projects cannot set the price',()=>{
 validateDataset(data);
 const chely=data.homes.find(h=>h.id===4);
 for(const [key,type]of Object.entries({studio:'C',one:'1K',two:'2E',three:'3E',four:'4E'})){
  const offers=evidence.offers.chelyuskintsev.filter(x=>x.complex==='Челюскинцев 5'&&x.status==='Свободна'&&x.type===type);
  const min=Math.min(...offers.flatMap(x=>x.costs.map(p=>p.cost).filter(p=>p>0)));
  const entry=chely.pricing.categories[key];assert.equal(entry.amount,min);
  assert.ok(offers.some(x=>entry.lot.includes(x.uid)&&x.costs.some(p=>p.cost===entry.amount)));
 }
 const mash=data.homes.find(h=>h.id==='masharov');
 assert.equal(evidence.sources.masharov.offerCount,57);
 for(const x of evidence.offers.masharov){const entry=mash.pricing.categories[x.category];assert.equal(x.status,'В продаже');assert.equal(entry.amount,x.price.price);assert.equal(entry.url,x.url);assert.equal(entry.area,x.area);}
 for(const id of ['schaste-v-tyumeni','daudel'])for(const entry of Object.values(data.homes.find(h=>h.id===id).pricing.categories)){
  assert.equal(entry.amount,null);assert.equal(entry.checkedAt,'2026-11-16');assert.ok(entry.reason.length>50);assert.ok(entry.url.startsWith('https://'));
 }
});
