// Read-only audit of the retained OSM snapshot; no claim of live official validation.
import fs from 'node:fs';
import {preparePlaces,placeAddress} from '../src/places.js';
import {distance} from '../src/data.js';
const homes=JSON.parse(fs.readFileSync('public/data/residential.json')).homes;
const snapshot=JSON.parse(fs.readFileSync('public/data/infrastructure.json'));
const {places,duplicates,excluded}=preparePlaces(snapshot.elements);
const social=places.map(p=>{
 const nearest=homes.filter(h=>!h.coordinateUnresolved).map(h=>({homeId:h.id,name:h.name,meters:Math.round(distance([p.lat,p.lon],[h.lat,h.lon]))})).sort((a,b)=>a.meters-b.meters);
 return {id:p.id,name:p.name,category:p.category,lat:p.lat,lon:p.lon,address:placeAddress(p),sources:p.sources,
  nearestHome:nearest[0],within2km:nearest.filter(h=>h.meters<=2000),operationStatus:'Не проверено',
  categoryEvidence:'OSM tags only; not independently confirmed',officialWebsiteCandidate:p.tags['contact:website']||p.tags.website||null,
  reviewReasons:[...(!p.tags.name?['Название отсутствует']:[]),...(!p.tags['addr:street']||!p.tags['addr:housenumber']?['Адрес неполный или отсутствует']:[]),
   ...(p.osmType!=='node'?['Центр контура OSM; вход не подтверждён']:[]),...(p.clinicEvidence==='name-only'?['Государственная принадлежность не подтверждена']:[]),
   ...(/^(IT\s*School|Itcity School)$/i.test(p.name)?['Возможно учебный центр; категория школы требует официальной сверки']:[])]};
});
const report={checkedAt:new Date().toISOString(),scope:'Local OSM snapshot consistency audit. Official websites and live geocoding blocked by current network policy; no newly confirmed operating institutions.',sourceTimestamp:snapshot.osm3s.timestamp_osm_base,
 summary:{homes:homes.length,excludedDistanceOrigins:homes.filter(h=>h.coordinateUnresolved).map(h=>h.id),sourceRecords:snapshot.elements.length,shown:places.length,byCategory:Object.fromEntries(['school','kindergarten','clinic'].map(k=>[k,places.filter(p=>p.category===k).length])),uniqueIds:new Set(places.map(p=>p.id)).size,duplicatePairs:duplicates.length,excluded:excluded.length,within2kmOfHomes:social.filter(p=>p.within2km.length).length,missingNames:places.filter(p=>!p.tags.name).length,incompleteAddresses:social.filter(p=>p.reviewReasons.includes('Адрес неполный или отсутствует')).length,independentlyConfirmedOperating:0},
 priority:social.filter(p=>p.within2km.length).sort((a,b)=>a.nearestHome.meters-b.nearestHome.meters),social,duplicates,excluded};
fs.writeFileSync('docs/data-audit-2026-11-02.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
