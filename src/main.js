import {preparePlaces,placeStatus} from './places.js';
import L from 'leaflet';
import './style.css';
import {homes,categories,normalize,distance,matchAddress} from './data.js';
async function init(){
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map=L.map('map',{zoomControl:false}).setView([57.153,65.542],12);
L.control.zoom({position:'topright'}).addTo(map);
let tileLoaded=false;
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
tiles.on('tileload',()=>{tileLoaded=true;$('#tile-warning').hidden=true;});
tiles.on('tileerror',()=>{if(!tileLoaded)$('#tile-warning').hidden=false;});
const layers=Object.fromEntries(Object.keys(categories).map(k=>[k,L.layerGroup().addTo(map)]));
let selected=null,infrastructure=[],busy=false;
function readCache(){try{return JSON.parse(localStorage.getItem('tyumen-geocodes-v1')||'{}');}catch{return {};}}
const cache=readCache();
try{const bundledHomes=await getJSON(import.meta.env.BASE_URL+'data/homes.json');for(const h of homes){if(validPoint(bundledHomes[h.id]))Object.assign(h,bundledHomes[h.id]);}}catch(e){console.warn(e.message);}
function persist(){try{localStorage.setItem('tyumen-geocodes-v1',JSON.stringify(cache));}catch{}}
function validPoint(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>56.8&&p.lat<57.5&&p.lon>65&&p.lon<66.2&&p.source;}
for(const h of homes){if(!h.lat&&validPoint(cache[h.id]))Object.assign(h,cache[h.id]);}
function icon(category){return L.divIcon({className:'custom-marker',html:`<div class="pin" style="--color:${categories[category].color}"><span>${{home:'⌂',school:'Ш',kindergarten:'Д',clinic:'+'}[category]}</span></div>`,iconSize:[29,35],iconAnchor:[14,35],popupAnchor:[0,-35]});}
for(const [key,c] of Object.entries(categories)){
 const label=document.createElement('label');label.className='filter';label.style.setProperty('--color',c.color);
 label.innerHTML=`<input type="checkbox" checked data-category="${key}"><span class="dot"></span>${c.label}`;
 label.querySelector('input').addEventListener('change',e=>{e.target.checked?layers[key].addTo(map):map.removeLayer(layers[key]);});$('#filters').append(label);
}
function enable(key){const input=$(`[data-category="${key}"]`);input.checked=true;layers[key].addTo(map);}
function renderList(){const q=normalize($('#search').value);const filtered=homes.filter(h=>normalize(h.name).includes(q));$('#count').textContent=filtered.length;
 $('#homes').replaceChildren();
 if(!filtered.length){$('#homes').innerHTML='<p class="empty">ЖК не найден. Попробуйте другое название.</p>';return;}
 for(const h of filtered){const b=document.createElement('button');b.className='home-card'+(selected?.id===h.id?' active':'');b.dataset.id=h.id;b.innerHTML=`<span class="home-icon">⌂</span><span><strong>${escape(h.name)}</strong><small>${escape(h.developer)}</small><small>${escape(h.address)}</small><small class="${h.lat&&!h.approximate?'verified':'state'}">${h.lat?(h.approximate?'≈ '+(h.precisionLabel||'Приблизительно'):'✓ Адрес найден в OSM'):'Координаты не подтверждены'}</small></span><span class="arrow">↗</span>`;b.onclick=()=>selectHome(h);$('#homes').append(b);}
}
function drawHomes(){layers.home.clearLayers();for(const h of homes){if(!h.lat)continue;h.marker=L.marker([h.lat,h.lon],{icon:icon('home'),title:h.name}).addTo(layers.home).bindPopup(`<strong>${escape(h.name)}</strong><br>${escape(h.developer)}<br>${escape(h.address)}<br><small>${h.approximate?(h.precisionLabel||'Приблизительная точка'):'Адрес найден в OSM'}</small>`);h.marker.on('click',()=>selectHome(h,false));}}
function detail(h){$('#detail').hidden=false;$('#detail').innerHTML=`<button class="close" aria-label="Закрыть карточку">×</button><span class="eyebrow">ЖИЛОЙ КОМПЛЕКС</span><h2>${escape(h.name)}</h2><p>${escape(h.developer)}<br>Тюмень, ${escape(h.address)}</p><p>${h.lat?(h.approximate?'≈ '+(h.precisionLabel||'Приблизительная точка района; не адрес здания.'):'✓ Найдено здание с совпадающим адресом в OpenStreetMap.'):'Координаты не подтверждены. Метка появится после успешной проверки адреса.'}</p>${h.identityNote?`<p class="state">${escape(h.identityNote)}</p>`:''}${h.source?`<a class="source" href="${escape(h.source)}" target="_blank" rel="noopener">Источник координат ↗</a>`:''}<div class="nearby" id="nearby">${h.lat?'Инфраструктура в радиусе 2 км…':'Поиск инфраструктуры доступен после определения координат.'}</div>`;$('.close').onclick=()=>{$('#detail').hidden=true;selected=null;renderList();};}
function selectHome(h,fly=true){selected=h;renderList();detail(h);if(h.lat){enable('home');if(fly)map.flyTo([h.lat,h.lon],15,{duration:.6});h.marker?.openPopup();loadNearby(h);}}
$('#search').addEventListener('input',renderList);$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){const h=homes.find(h=>normalize(h.name).includes(normalize($('#search').value)));if(h)selectHome(h);}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&e.target.tagName!=='INPUT'){e.preventDefault();$('#search').focus();}});
$('#all').onclick=()=>{selected=null;$('#detail').hidden=true;enable('home');$('#search').value='';renderList();const points=homes.filter(h=>h.lat).map(h=>[h.lat,h.lon]);if(points.length)map.fitBounds(points,{padding:[50,50],maxZoom:13});else map.setView([57.153,65.542],12);};
$('#mobile-toggle').onclick=()=>{const collapsed=$('.sidebar').classList.toggle('collapsed');$('#mobile-toggle').textContent=collapsed?'ЖК и фильтры':'Скрыть список';};
async function getJSON(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function geocode(h){
 const query=h.id===13?'Закалужская улица, Тюмень':`${h.address}, Тюмень`;
 const url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:query,format:'jsonv2',addressdetails:'1',limit:'5',countrycodes:'ru',viewbox:'65.05,57.4,66.0,56.9',bounded:'1','accept-language':'ru'});
 const results=await getJSON(url);
 const found=h.id===13?results.find(r=>r.address?.road&&r.display_name.includes('Тюмень')):matchAddress(results,h);
 if(!found)return false;
 const p={lat:Number(found.lat),lon:Number(found.lon),source:`https://www.openstreetmap.org/${found.osm_type}/${found.osm_id}`,approximate:h.id===13,checkedAt:new Date().toISOString()};
 if(!validPoint(p))return false;
 Object.assign(h,p);cache[h.id]=p;persist();return true;
}
async function resolveHomes(){if(busy)return;busy=true;$('#retry').disabled=true;let failures=0;
 for(const h of homes){if(h.lat)continue;$('#status').textContent=`Проверка адресов · ${h.id+1}/17`;
 try{await geocode(h);}catch(e){failures++;console.warn('Геокодер недоступен:',e.message);if(failures>=2)break;}
 drawHomes();renderList();if(selected?.id===h.id){detail(h);if(h.lat)loadNearby(h);}await delay(1100);
 }
 const count=homes.filter(h=>h.lat).length;$('#status').textContent=`Координаты: ${count}/17${failures?' · геокодер недоступен':count<17?' · есть неподтверждённые адреса':''}`;busy=false;$('#retry').disabled=false;
 if(count===17)$('#all').click();
}
let infrastructureRequest=null;
async function fetchInfrastructure(){if(infrastructureRequest)return infrastructureRequest;
 const query='[out:json][timeout:30];(nwr[amenity=school](56.95,65.15,57.3,65.85);nwr[amenity=kindergarten](56.95,65.15,57.3,65.85);nwr[amenity=clinic](56.95,65.15,57.3,65.85););out center tags;';
 infrastructureRequest=(async()=>{let data;try{data=await getJSON(import.meta.env.BASE_URL+'data/infrastructure.json');}catch{}let lastError;for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){if(data)break;try{data=await getJSON(host,{method:'POST',body:new URLSearchParams({data:query})});break;}catch(e){lastError=e;}}if(!data)throw lastError;
 const prepared=preparePlaces(data.elements);infrastructure=prepared.places;
 for(const i of infrastructure){i.marker=L.marker([i.lat,i.lon],{icon:icon(i.category),title:i.name}).addTo(layers[i.category]).bindPopup(`<strong>${escape(i.name)}</strong><br>${categories[i.category].label}<br>${escape([i.tags['addr:street'],i.tags['addr:housenumber']].filter(Boolean).join(', '))}<br><small>${escape(placeStatus(i))}</small><br>${i.sources.map((source,index)=>`<a href="${escape(source)}" target="_blank" rel="noopener">Источник OSM ${index+1} ↗</a>`).join('<br>')}`);}
 return infrastructure;})();
 try{return await infrastructureRequest;}catch(e){infrastructureRequest=null;throw e;}
}
async function loadNearby(h){try{await fetchInfrastructure();if(selected?.id!==h.id)return;const nearby=infrastructure.map(i=>({...i,meters:distance([h.lat,h.lon],[i.lat,i.lon])})).filter(i=>i.meters<=2000).sort((a,b)=>a.meters-b.meters);
 $('#nearby').innerHTML=`<strong>Рядом · до 2 км по прямой</strong><p>По данным OSM. Работа учреждений не подтверждена. Поликлиники без сведений о публичном операторе отмечены как кандидаты.</p>${Object.keys(categories).filter(k=>k!=='home').map(k=>`<div>${categories[k].label}: ${nearby.filter(i=>i.category===k).length}</div>`).join('')}${nearby.map(i=>`<button data-place="${i.id}">${escape(i.name)}${i.category==='clinic'&&i.clinicEvidence==='name-only'?' (гос. статус не подтверждён)':''} · ${Math.round(i.meters)} м ↗</button>`).join('')}${!nearby.length?'<p>В OSM поблизости объектов не найдено. Это не означает их отсутствия.</p>':''}`;
 $('#nearby').querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=infrastructure.find(i=>i.id===b.dataset.place);enable(i.category);map.flyTo([i.lat,i.lon],16);i.marker.openPopup();});
 }catch{if(selected?.id===h.id)$('#nearby').innerHTML='<strong>Инфраструктура пока недоступна</strong><p>Не удалось получить данные Overpass. Повторите запрос после восстановления доступа.</p><button id="retry-nearby">Повторить</button>';$('#retry-nearby')?.addEventListener('click',()=>loadNearby(h));}}
$('#retry').onclick=()=>{resolveHomes();fetchInfrastructure().catch(()=>{});};
renderList();drawHomes();$('#status').textContent=`ЖК на карте: ${homes.filter(h=>h.lat).length}/17 · есть приблизительные`;fetchInfrastructure().catch(e=>console.warn('Overpass недоступен:',e.message));

}
init().catch(e=>{console.error(e);document.querySelector("#status").textContent="Ошибка запуска карты";});
