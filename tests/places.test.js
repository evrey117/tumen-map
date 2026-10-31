import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePlaces,publicClinicEvidence,placeStatus} from '../src/places.js';
const item=(type,id,lat,tags)=>({type,id,lat,lon:65.54,tags});
test('dedupes same named POI and building, preserves separate campuses',()=>{
 const data=[item('node',1,57.15,{amenity:'school',name:'Школа № 10'}),item('way',2,57.1501,{amenity:'school',name:'Средняя школа №10'}),item('way',3,57.151,{amenity:'school',name:'Школа №10'})];
 const out=preparePlaces(data);assert.equal(out.places.length,2);assert.equal(out.duplicates.length,1);assert.equal(out.places.find(p=>p.id==='way/2').sources.length,2);
});
test('does not merge nearby institutions with different addresses',()=>{
 const data=[item('node',1,57.15,{amenity:'school',name:'Школа №10','addr:housenumber':'1'}),item('way',2,57.1501,{amenity:'school',name:'Школа №10','addr:housenumber':'2'})];assert.equal(preparePlaces(data).places.length,2);
});
test('numbered clinics are candidates, never confirmed public or operating',()=>{
 assert.equal(publicClinicEvidence({name:'Городская поликлиника №8'}),'name-only');
 assert.equal(publicClinicEvidence({name:'Городская поликлиника №8','operator:type':'private'}),null);
 assert.equal(publicClinicEvidence({name:'Частная клиника'}),null);
 const {places}=preparePlaces([item('node',1,57.15,{amenity:'clinic',name:'Городская поликлиника №8'})]);assert.equal(places.length,1);assert.match(placeStatus(places[0]),/государственная принадлежность не подтверждена/);assert.equal(places[0].operationStatus,'unverified');
});
test('planned, closed, research institutes and private clinics are excluded',()=>{
 const {places}=preparePlaces([item('node',1,57.15,{amenity:'school',construction:'yes'}),item('node',2,57.15,{amenity:'clinic',name:'Поликлиника №8',disused:'yes'}),item('node',3,57.15,{amenity:'school',name:'Научно-исследовательский институт экологии'}),item('node',4,57.15,{amenity:'kindergarten',opening_hours:'closed'}),item('node',5,57.15,{amenity:'clinic',name:'Частная клиника'})]);assert.equal(places.length,0);
});
test('dedupes a clinic building and its nearby named area, retaining citations',()=>{
 const out=preparePlaces([item('way',1,57.15,{amenity:'clinic',name:'поликлиника №13 «Тура»',building:'yes'}),item('way',2,57.1501,{amenity:'clinic',name:'поликлиника № 13 "Тура"'})]);assert.equal(out.places.length,1);assert.equal(out.places[0].sources.length,2);
});
