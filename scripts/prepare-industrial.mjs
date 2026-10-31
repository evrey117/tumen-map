// Convert genuine Overpass inline geometry. No buffering, circles, repairs or invented vertices.
import fs from 'node:fs';
import osmToGeoJSON from 'osmtogeojson';
import booleanValid from '@turf/boolean-valid';
import kinks from '@turf/kinks';
import area from '@turf/area';
const input=process.argv[2]||'/tmp/tyumen-industrial-overpass.json';
const raw=JSON.parse(fs.readFileSync(input));
if(raw.remark||!Array.isArray(raw.elements)||!raw.elements.length)throw Error('Missing or incomplete Overpass response');
const converted=osmToGeoJSON(raw,{flatProperties:false});
const features=[],rejected=[];
for(const feature of converted.features){
 const tags=feature.properties.tags||{};
 if(tags.landuse!=='industrial')continue;
 const geometry=feature.geometry;
 const rings=geometry?.type==='Polygon'?geometry.coordinates:geometry?.type==='MultiPolygon'?geometry.coordinates.flat():[];
 const closed=rings.length>0&&rings.every(r=>r.length>=4&&r.every(p=>p.length===2&&p.every(Number.isFinite))&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]);
 if(feature.properties.tainted||!closed||!booleanValid(feature)||kinks(feature).features.length||!Number.isFinite(area(feature))||area(feature)<=0){rejected.push({id:feature.id,reason:'incomplete-or-invalid-polygon'});continue;}
 feature.properties={id:feature.id,name:tags.name||tags['name:ru']||'Промышленная территория',tags,source:`https://www.openstreetmap.org/${feature.id}`,areaM2:area(feature)};
 features.push(feature);
}
const result={type:'FeatureCollection',metadata:{source:'OpenStreetMap / Overpass API',licence:'ODbL 1.0, © OpenStreetMap contributors',cityBoundary:'https://www.openstreetmap.org/relation/2049854',query:'[out:json][timeout:60];rel(2049854);map_to_area->.city;(way[landuse=industrial](area.city);relation[landuse=industrial](area.city););out geom;',osmTimestamp:raw.osm3s?.timestamp_osm_base,collectedAt:new Date().toISOString(),scope:'Industrial polygons selected by the OSM administrative area of Tyumen; complete original contours preserved, including parts crossing the city boundary.',rejected},features};
if(!features.length)throw Error('No valid industrial polygons');
fs.writeFileSync('public/data/industrial.geojson',JSON.stringify(result));
fs.writeFileSync('docs/industrial-audit.json',JSON.stringify({metadata:result.metadata,rawElements:raw.elements.length,converted:converted.features.length,valid:features.length,polygons:features.filter(f=>f.geometry.type==='Polygon').length,multiPolygons:features.filter(f=>f.geometry.type==='MultiPolygon').length,holes:features.reduce((sum,f)=>sum+(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).reduce((n,p)=>n+p.length-1,0),0)},null,2));
console.log(JSON.parse(fs.readFileSync('docs/industrial-audit.json')));
