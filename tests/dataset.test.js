import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homes} from '../src/data.js';
import {validateDataset} from '../src/housing-store.js';
import {preparePlaces} from '../src/places.js';
const coordinates=JSON.parse(readFileSync(new URL('../public/data/homes.json',import.meta.url)));
test('current shared housing data has sourced valid coordinates',()=>{validateDataset({schemaVersion:1,homes});});
test('real dataset has no duplicated OSM ids and all candidate clinics remain unverified',()=>{
 const raw=JSON.parse(readFileSync(new URL('../public/data/infrastructure.json',import.meta.url)));const {places}=preparePlaces(raw.elements);assert.equal(new Set(places.map(p=>p.id)).size,places.length);assert.ok(places.filter(p=>p.category==='clinic').length>8);assert.ok(places.every(p=>p.operationStatus==='unverified'));
});
