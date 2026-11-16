import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isCenterHome,housingLayer} from '../src/center-homes.js';
import {validateDataset} from '../src/housing-store.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/residential.json',import.meta.url)));
test('central group uses four distinct housing records and sourced address buildings',()=>{
 validateDataset(data);
 const central=data.homes.filter(isCenterHome);
 assert.equal(central.length,4);assert.ok(data.homes.length>=21);
 assert.equal(data.homes.filter(h=>h.name==='Челюскинцев, 5').length,1);
 assert.equal(central.find(h=>h.id===4).name,'Челюскинцев, 5');
 assert.deepEqual(central.map(h=>housingLayer(h)),Array(4).fill('center'));
 const evidence=JSON.parse(fs.readFileSync(new URL('../public/data/center-geocoder-responses.json',import.meta.url)));
 for(const h of central.filter(h=>h.id!==4)){
  const source=Object.values(evidence.responses).flat().find(x=>h.source===`https://www.openstreetmap.org/${x.osm_type}/${x.osm_id}`);
  assert.ok(source);assert.equal(source.category,'building');
  assert.equal(h.lat,Number(source.lat));assert.equal(h.lon,Number(source.lon));
 }
 assert.equal(housingLayer(data.homes.find(h=>h.id==='druzheskiy')),'home');
 assert.equal(isCenterHome({id:11,name:'Сердце Сибири'}),false);
 assert.equal(isCenterHome({id:4,name:'Переименованная карточка'}),true);
});
