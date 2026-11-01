import {validatePricing} from './prices.js';
export const DATA_PATH = 'public/data/residential.json';
export const RAW_ROOT = 'https://raw.githubusercontent.com/evrey117/tumen-map/';
const allowed = new Set(['id','name','developer','address','category','lat','lon','source','approximate','precisionLabel','identityNote','checkedAt','pricing','coordinateUnresolved']);
export function validateDataset(data) {
 if(data?.schemaVersion!==1||!Array.isArray(data.homes)||data.homes.length>2000)throw Error('Неверный формат списка ЖК');
 const ids=new Set();
 for(const h of data.homes){
  if(!h||Object.keys(h).some(k=>!allowed.has(k)))throw Error('Неизвестные поля объекта');
  if(!((Number.isSafeInteger(h.id)&&h.id>=0)||(typeof h.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(h.id))))throw Error('Неверный ID');
  if(ids.has(String(h.id)))throw Error('Повторяющийся ID');ids.add(String(h.id));
  for(const [k,max] of [['name',160],['developer',200],['address',400]])if(typeof h[k]!=='string'||!h[k].trim()||h[k].length>max)throw Error('Заполните название, застройщика и адрес');
  if(h.coordinateUnresolved!==undefined&&typeof h.coordinateUnresolved!=='boolean')throw Error('Неверный статус положения ЖК');
  if(h.coordinateUnresolved&&!h.approximate)throw Error('Неустановленная точка должна быть приблизительной');
  if(h.pricing!==undefined)validatePricing(h.pricing);
  if(h.category!=='home'||!Number.isFinite(h.lat)||!Number.isFinite(h.lon)||h.lat<56.8||h.lat>57.5||h.lon<65||h.lon>66.2)throw Error('Координаты должны быть в поддерживаемой области Тюмени и окрестностей');
  if(typeof h.source!=='string'||!/^https:\/\/(www\.)?openstreetmap\.org\//.test(h.source))throw Error('Нужен источник координат OpenStreetMap');
  if(typeof h.approximate!=='boolean')throw Error('Укажите точность координат');
  for(const k of ['precisionLabel','identityNote','checkedAt'])if(h[k]!==undefined&&(typeof h[k]!=='string'||h[k].length>1200))throw Error('Неверные сведения о координатах');
 }
 return data;
}
export async function revisionOf(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function buildRequest(base,draft,baseRevision,restoredFrom=null){
 validateDataset(draft);
 if(restoredFrom)return {version:1,action:'restore',baseRevision,restoredFrom};
 const changes=[];const old=new Map(base.homes.map(h=>[String(h.id),h]));const next=new Map(draft.homes.map(h=>[String(h.id),h]));
 for(const h of draft.homes)if(JSON.stringify(old.get(String(h.id)))!==JSON.stringify(h))changes.push({type:'upsert',home:h});
 for(const h of base.homes)if(!next.has(String(h.id)))changes.push({type:'delete',id:h.id});
 if(!changes.length)throw Error('Нет изменений для сохранения');
 return {version:1,action:'apply',baseRevision,changes};
}
export async function fetchCentral(ref='main'){
 if(ref!=='main'&&!/^[a-f0-9]{40}$/.test(ref))throw Error('Неверная версия');
 const response=await fetch(`${RAW_ROOT}${ref}/${DATA_PATH}?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error(`GitHub: HTTP ${response.status}`);
 const text=await response.text();return {data:validateDataset(JSON.parse(text)),revision:await revisionOf(text)};
}
// A different revision alone does not prove that this administrator's request was applied.
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
export function sameDataset(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
export function requestMatchesDataset(request,data,expectedRestore=null){
 validateDataset(data);
 if(!request)return false;
 if(request.action==='restore')return Boolean(expectedRestore)&&sameDataset(data,expectedRestore);
 if(request.action!=='apply'||!Array.isArray(request.changes)||!request.changes.length)return false;
 return request.changes.every(change=>{const id=change.type==='upsert'?change.home?.id:change.id;const home=data.homes.find(h=>String(h.id)===String(id));return change.type==='delete'?!home:change.type==='upsert'&&Boolean(home)&&sameDataset(home,change.home);});
}
