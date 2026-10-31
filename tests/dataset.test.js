import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homes} from '../src/data.js';
import {preparePlaces} from '../src/places.js';
const coordinates=JSON.parse(readFileSync(new URL('../public/data/homes.json',import.meta.url)));
test('all 17 catalog entries have sourced coordinates and approximate points are explicit',()=>{
 assert.equal(homes.length,17);assert.equal(Object.keys(coordinates).length,17);
 for(const h of homes){const p=coordinates[h.id];assert.ok(p, h.name);assert.ok(p.lat>57&&p.lat<57.4&&p.lon>65&&p.lon<66,h.name);assert.match(p.source,/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);if(p.approximate)assert.ok(p.precisionLabel||h.id===13,h.name);}
 assert.ok(coordinates[5].approximate);assert.ok(coordinates[15].approximate);
});
test('real dataset has no duplicated OSM ids and all candidate clinics remain unverified',()=>{
 const raw=JSON.parse(readFileSync(new URL('../public/data/infrastructure.json',import.meta.url)));const {places}=preparePlaces(raw.elements);assert.equal(new Set(places.map(p=>p.id)).size,places.length);assert.ok(places.filter(p=>p.category==='clinic').length>8);assert.ok(places.every(p=>p.operationStatus==='unverified'));
});
