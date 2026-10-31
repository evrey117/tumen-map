import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundaryDistance,industrialArea,nearestIndustrial,formatDistance} from '../src/industrial.js';
const feature=(coordinates,type='Polygon')=>({type:'Feature',properties:{},geometry:{type,coordinates}});
const square=feature([[[0,0],[.02,0],[.02,.02],[0,.02],[0,0]]]);
test('distance is to edge, not centroid; point on boundary returns zero',()=>{
 assert.ok(Math.abs(boundaryDistance([.01,-.001],square)-111.195)<.5);
 assert.ok(boundaryDistance([0,.01],square)<.01);
 assert.ok(Math.abs(boundaryDistance([.01,.01],square)-1111.95)<1);
});
test('holes and multiple polygons contribute actual boundaries',()=>{
 const withHole=feature([...square.geometry.coordinates,[[.008,.008],[.008,.012],[.012,.012],[.012,.008],[.008,.008]]]);
 assert.ok(Math.abs(boundaryDistance([.01,.01],withHole)-222.39)<1);
 assert.equal(nearestIndustrial([.01,.01],[withHole])[0].inside,false);
 assert.equal(nearestIndustrial([.005,.005],[withHole])[0].inside,true);
 const multi=feature([square.geometry.coordinates,[[[1,1],[1.02,1],[1.02,1.02],[1,1.02],[1,1]]]],'MultiPolygon');
 assert.ok(Math.abs(boundaryDistance([1.01,.999],multi)-111.195)<1);
 assert.ok(industrialArea(withHole)<industrialArea(square));
});
test('spherical area and nearest ordering are meaningful',()=>{
 assert.ok(Math.abs(industrialArea(square)-4945738)<100);
 const distant=feature([[[1,1],[2,1],[2,2],[1,2],[1,1]]]);
 assert.equal(nearestIndustrial([0,0],[distant,square])[0].feature,square);
 assert.equal(formatDistance(1500),'1,5 км');
});
import fs from 'node:fs';
import booleanValid from '@turf/boolean-valid';
import kinks from '@turf/kinks';
test('all released industrial contours are valid and use original OSM vertices',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data/industrial.geojson',import.meta.url)));
 const raw=JSON.parse(fs.readFileSync(new URL('../data-sources/industrial-overpass.json',import.meta.url)));
 const source=new Map(raw.elements.map(e=>[`${e.type}/${e.id}`,e]));
 assert.ok(data.features.length>0);assert.equal(new Set(data.features.map(f=>f.properties.id)).size,data.features.length);
 for(const f of data.features){
  assert.equal(f.properties.tags.landuse,'industrial');assert.ok(booleanValid(f));assert.equal(kinks(f).features.length,0);assert.ok(industrialArea(f)>0);
  const original=source.get(f.properties.id);assert.ok(original);
  const vertices=new Set([...(original.geometry||[]),...(original.members||[]).flatMap(m=>m.geometry||[])].map(p=>`${p.lon},${p.lat}`));
  const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
  for(const ring of rings){assert.deepEqual(ring[0],ring.at(-1));for(const vertex of ring)assert.ok(vertices.has(vertex.join(',')),f.properties.id);}
 }
});
