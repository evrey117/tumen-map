import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homes,normalize,distance,classify,matchAddress} from '../src/data.js';
test('17 unique housing complexes and all provided addresses',()=>{assert.equal(homes.length,17);assert.equal(new Set(homes.map(h=>h.name)).size,17);assert.ok(homes.every(h=>h.address&&h.developer));});
test('search normalizes Russian spelling',()=>{assert.equal(normalize(' НОВОСЁЛОВ '),'новоселов');});
test('distance matches known meridian distance',()=>{assert.ok(Math.abs(distance([57,65],[58,65])-111195)<10);assert.equal(distance([57,65],[57,65]),0);});
test('exclude planned, disused and private facilities',()=>{assert.equal(classify({amenity:'school',construction:'yes'}),null);assert.equal(classify({amenity:'kindergarten',disused:'yes'}),null);assert.equal(classify({amenity:'clinic',operator:'Частная клиника'}),null);assert.equal(classify({amenity:'clinic','operator:type':'government'}),'clinic');assert.equal(classify({amenity:'school'}),'school');});
test('require matching building number and city, never street centroid',()=>{const good={lat:'57.15',lon:'65.5',address:{city:'Тюмень',road:'Одесская улица',house_number:'7к1'}};assert.equal(matchAddress([good],homes[0]),good);assert.equal(matchAddress([{...good,address:{...good.address,house_number:'7'}}],homes[0]),undefined);assert.equal(matchAddress([{...good,address:{...good.address,house_number:undefined}}],homes[0]),undefined);assert.equal(matchAddress([{...good,address:{...good.address,city:'Омск'}}],homes[0]),undefined);});
