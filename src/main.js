import {markerIcon} from './markers.js';
import {defaultMarkerSize} from './marker-sizes.js';
import {mountHousingAdmin} from './admin.js';
import {fetchCentral,validateDataset,revisionOf} from './housing-store.js';
import {industrialArea,nearestIndustrial,formatDistance,formatArea} from './industrial.js';
import {preparePlaces,placeStatus,placeAddress} from './places.js';
import L from 'leaflet';
import './style.css';
import {homes,categories,normalize,distance} from './data.js';
async function init(){
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map=L.map('map',{zoomControl:false}).setView([57.153,65.542],12);
L.control.zoom({position:'topright'}).addTo(map);
let tileLoaded=false;
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
tiles.on('tileload',()=>{tileLoaded=true;$('#tile-warning').hidden=true;});
tiles.on('tileerror',()=>{if(!tileLoaded)$('#tile-warning').hidden=false;});
let markerPreset=defaultMarkerSize;
for(const [name,zIndex] of [['industrialPane',350],['socialPane',500],['housingPane',620]])map.createPane(name).style.zIndex=zIndex;
const layers=Object.fromEntries(Object.keys(categories).map(k=>[k,L.layerGroup().addTo(map)]));
function updateSocialLabels(){map.getContainer().classList.toggle('show-social-labels',map.getZoom()>=16);}
map.on('zoomend',updateSocialLabels);updateSocialLabels();
let selected=null,infrastructure=[],busy=false;
let industrialFeatures=[],industrialRequest=null;
const industrialLayers=new Map();
let housingEvidence={byId:{}};
try{housingEvidence=await getJSON(import.meta.env.BASE_URL+'data/verification.json');}catch{}
function housingEvidenceNote(h){const evidence=housingEvidence.byId?.[String(h.id)];if(!evidence||evidence.source!==h.source||evidence.address!==h.address||evidence.lat!==h.lat||evidence.lon!==h.lon)return '';const checked=Number.isFinite(Date.parse(housingEvidence.checkedAt))?new Date(housingEvidence.checkedAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):'дата не указана';return `Проверка источника OSM: ${checked}. `+(evidence.constructionTag?'В этом снимке объект помечен как строительство. Сдача и заселение ЖК официально не подтверждены.':'Совпадение адреса в OSM не подтверждает принадлежность здания ЖК, застройщика или сдачу объекта.');}

let currentDataset={schemaVersion:1,homes:structuredClone(homes)},currentRevision=null;
try{const response=await fetch(import.meta.env.BASE_URL+'data/residential.json',{cache:'no-store'});if(response.ok){const text=await response.text();currentDataset=validateDataset(JSON.parse(text));currentRevision=await revisionOf(text);homes.splice(0,homes.length,...structuredClone(currentDataset.homes));}}catch(e){console.warn('Используется резервный список ЖК:',e.message);}
function updateHomeVisuals(){
 for(const h of homes){if(!h.marker)continue;const active=selected&&String(h.id)===String(selected.id);h.marker.setIcon(markerIcon('home',markerPreset,active));h.marker.setZIndexOffset(active?500:0);h.marker.unbindTooltip();const name=document.createElement('span');name.textContent=h.name;h.marker.bindTooltip(name,{permanent:Boolean(active),direction:'bottom',className:'housing-name',offset:[0,3]});if(active)h.marker.openTooltip();}
}
$('#marker-size').value=markerPreset;
$('#marker-size').addEventListener('change',e=>{
 markerPreset=e.target.value;updateHomeVisuals();for(const i of infrastructure)i.marker.setIcon(markerIcon(i.category,markerPreset));
});
for(const [key,c] of Object.entries(categories)){
 const label=document.createElement('label');label.className='filter';label.style.setProperty('--color',c.color);
 label.innerHTML=`<input type="checkbox" checked data-category="${key}"><span class="dot"></span>${c.label}`;
 label.querySelector('input').addEventListener('change',e=>{e.target.checked?layers[key].addTo(map):map.removeLayer(layers[key]);});$('#filters').append(label);
}
function enable(key){const input=$(`[data-category="${key}"]`);input.checked=true;layers[key].addTo(map);}
function renderList(){const q=normalize($('#search').value);const filtered=homes.filter(h=>normalize(h.name).includes(q));$('#count').textContent=filtered.length;
 $('#homes').replaceChildren();
 if(!filtered.length){$('#homes').innerHTML='<p class="empty">ЖК не найден. Попробуйте другое название.</p>';return;}
 for(const h of filtered){const b=document.createElement('button');b.className='home-card'+(selected?.id===h.id?' active':'');b.dataset.id=h.id;b.innerHTML=`<span class="home-icon">⌂</span><span><strong>${escape(h.name)}</strong><small>${escape(h.developer)}</small><small>${escape(h.address)}</small><small class="${h.lat&&!h.approximate?'verified':'state'}">${h.lat?(h.approximate?'≈ '+escape(h.precisionLabel||'Приблизительно'):'✓ Адрес совпадает с OSM'):'Координаты не подтверждены'}</small></span><span class="arrow">↗</span>`;b.onclick=()=>selectHome(h);$('#homes').append(b);}
}
function drawHomes(){layers.home.clearLayers();for(const h of homes){if(!h.lat)continue;h.marker=L.marker([h.lat,h.lon],{icon:markerIcon('home',markerPreset),pane:'housingPane',title:h.name}).addTo(layers.home).bindPopup(`<strong>${escape(h.name)}</strong><br>${escape(h.developer)}<br>${escape(h.address)}<br><small>${h.approximate?escape(h.precisionLabel||'Приблизительная точка'):'Адрес найден в OSM'}</small>`);h.marker.on('click',()=>selectHome(h,false));}updateHomeVisuals();}
function detail(h){$('#detail').hidden=false;$('#detail').innerHTML=`<button class="close" aria-label="Закрыть карточку">×</button><span class="eyebrow">ЖИЛОЙ КОМПЛЕКС</span><h2>${escape(h.name)}</h2><p>${escape(h.developer)}<br>Тюмень, ${escape(h.address)}</p><p>${h.lat?(h.approximate?'≈ '+escape(h.precisionLabel||'Приблизительная точка района; не адрес здания.'):'В OSM найден объект с совпадающим адресом. Принадлежность ЖК отдельно не подтверждена.'):'Координаты не подтверждены. Метка появится после успешной проверки адреса.'}</p>${housingEvidenceNote(h)?`<p class="state">${escape(housingEvidenceNote(h))}</p>`:''}${h.identityNote?`<p class="state">${escape(h.identityNote)}</p>`:''}${h.source?`<a class="source" href="${escape(h.source)}" target="_blank" rel="noopener">Источник координат ↗</a>`:''}<div class="nearby industrial-nearby" id="industrial-nearby">${h.lat?'Ближайшие промышленные территории…':'Расстояния до промзон доступны после определения координат.'}</div><div class="nearby" id="nearby">${h.lat?'Инфраструктура в радиусе 2 км…':'Поиск инфраструктуры доступен после определения координат.'}</div>`;$('.close').onclick=()=>{$('#detail').hidden=true;map.closePopup();selected=null;renderList();updateHomeVisuals();};}
function selectHome(h,fly=true){selected=h;updateHomeVisuals();renderList();detail(h);if(h.lat){enable('home');if(fly)map.flyTo([h.lat,h.lon],15,{duration:.6});h.marker?.openPopup();loadNearby(h);loadIndustrialNearby(h);}}
$('#search').addEventListener('input',renderList);$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){const h=homes.find(h=>normalize(h.name).includes(normalize($('#search').value)));if(h)selectHome(h);}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&e.target.tagName!=='INPUT'){e.preventDefault();$('#search').focus();}});
$('#all').onclick=()=>{map.closePopup();selected=null;updateHomeVisuals();$('#detail').hidden=true;enable('home');$('#search').value='';renderList();const points=homes.filter(h=>h.lat).map(h=>[h.lat,h.lon]);if(points.length)map.fitBounds(points,{padding:[50,50],maxZoom:13});else map.setView([57.153,65.542],12);};
$('#mobile-toggle').onclick=()=>{const collapsed=$('.sidebar').classList.toggle('collapsed');$('#mobile-toggle').textContent=collapsed?'ЖК и фильтры':'Скрыть список';};
async function getJSON(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
function replaceHousing(latest){
 if(latest.revision===currentRevision)return;
 currentDataset=structuredClone(latest.data);currentRevision=latest.revision;
 const selectedId=selected?.id;homes.splice(0,homes.length,...structuredClone(currentDataset.homes));drawHomes();renderList();
 if(selectedId!==undefined){const home=homes.find(h=>String(h.id)===String(selectedId));if(home){selected=home;updateHomeVisuals();detail(home);loadNearby(home);loadIndustrialNearby(home);}else{selected=null;$('#detail').hidden=true;}}
 $('#status').textContent=`ЖК на карте: ${homes.length} · общая версия обновлена`;
}
async function refreshHousing(manual=false){try{const latest=await fetchCentral();replaceHousing(latest);if(manual)$('#status').textContent=`ЖК на карте: ${homes.length} · данные GitHub актуальны`;}catch(e){if(manual)$('#status').textContent='GitHub недоступен · показана последняя загруженная версия';}}
mountHousingAdmin({getDataset:()=>structuredClone(currentDataset),onRefresh:replaceHousing});
setInterval(()=>{if(!document.hidden)refreshHousing();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHousing();});
let infrastructureRequest=null;
async function fetchInfrastructure(){if(infrastructureRequest)return infrastructureRequest;
 const query='[out:json][timeout:30];(nwr[amenity=school](56.95,65.15,57.3,65.85);nwr[amenity=kindergarten](56.95,65.15,57.3,65.85);nwr[amenity=clinic](56.95,65.15,57.3,65.85););out center tags;';
 infrastructureRequest=(async()=>{let data;try{data=await getJSON(import.meta.env.BASE_URL+'data/infrastructure.json');}catch{}let lastError;for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){if(data)break;try{data=await getJSON(host,{method:'POST',body:new URLSearchParams({data:query})});break;}catch(e){lastError=e;}}if(!data)throw lastError;
 const prepared=preparePlaces(data.elements);infrastructure=prepared.places;
 for(const i of infrastructure){i.marker=L.marker([i.lat,i.lon],{icon:markerIcon(i.category,markerPreset),pane:'socialPane',title:''}).addTo(layers[i.category]).bindPopup(`<strong>${escape(i.name)}</strong><br>${categories[i.category].label} · категория по OSM<br>${escape(placeAddress(i))}<br><small>${escape(placeStatus(i))} ${i.osmType==='node'?'Точка OSM.':'Центр контура OSM, не подтверждённый вход в учреждение.'}</small><br>${i.sources.map((source,index)=>`<a href="${escape(source)}" target="_blank" rel="noopener">Источник OSM ${index+1} ↗</a>`).join('<br>')}`);const name=document.createElement('span');name.textContent=i.name;i.marker.bindTooltip(name,{className:'social-label',direction:'top',offset:[0,-8]});i.marker.getElement()?.setAttribute('aria-label',i.name);i.marker.on('add',()=>i.marker.getElement()?.setAttribute('aria-label',i.name));}
 return infrastructure;})();
 try{return await infrastructureRequest;}catch(e){infrastructureRequest=null;throw e;}
}
async function loadNearby(h){try{await fetchInfrastructure();if(selected?.id!==h.id)return;const nearby=infrastructure.map(i=>({...i,meters:distance([h.lat,h.lon],[i.lat,i.lon])})).filter(i=>i.meters<=2000).sort((a,b)=>a.meters-b.meters);
 $('#nearby').innerHTML=`<strong>Рядом · до 2 км по прямой</strong><p>По данным OSM. Работа учреждений не подтверждена. Поликлиники без сведений о публичном операторе отмечены как кандидаты.</p>${Object.keys(categories).filter(k=>k!=='home'&&k!=='industrial').map(k=>`<div>${categories[k].label}: ${nearby.filter(i=>i.category===k).length}</div>`).join('')}${nearby.map(i=>`<button data-place="${i.id}">${escape(i.name)}${i.category==='clinic'&&i.clinicEvidence==='name-only'?' (гос. статус не подтверждён)':''} · ${Math.round(i.meters)} м ↗</button>`).join('')}${!nearby.length?'<p>В OSM поблизости объектов не найдено. Это не означает их отсутствия.</p>':''}`;
 $('#nearby').querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=infrastructure.find(i=>i.id===b.dataset.place);enable(i.category);map.setView([i.lat,i.lon],16,{animate:false});i.marker.openPopup();});
 }catch{if(selected?.id===h.id)$('#nearby').innerHTML='<strong>Инфраструктура пока недоступна</strong><p>Не удалось получить данные Overpass. Повторите запрос после восстановления доступа.</p><button id="retry-nearby">Повторить</button>';$('#retry-nearby')?.addEventListener('click',()=>loadNearby(h));}}

const industrialWarning='Промышленное назначение не является оценкой опасности. Нет проверенных сведений о действующем производстве и воздействии на окружающую среду.';
async function loadIndustrial(){
 if(industrialRequest)return industrialRequest;
 industrialRequest=(async()=>{
  const data=await getJSON(import.meta.env.BASE_URL+'data/industrial.geojson');
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid industrial dataset');
  industrialFeatures=data.features;
  const style={color:'#783bb1',weight:2,opacity:0.95,fillColor:'#9854d2',fillOpacity:0.23};
  L.geoJSON(data,{pane:'industrialPane',style,onEachFeature:(feature,layer)=>{
   const p=feature.properties,t=p.tags||{};
   const status=t.disused==='yes'||t['disused:landuse']?'В OSM есть отметка о неиспользовании территории. ':'';
   const popup=`<strong>${escape(p.name)}</strong><br><span>Промышленная территория</span><br>Площадь по контуру OSM: ${formatArea(industrialArea(feature))}<br>Тег использования в OpenStreetMap: landuse=industrial${t.industrial?' · '+escape(t.industrial):''}<br>${t.operator?'Оператор по OSM: '+escape(t.operator)+'<br>':''}<p>${escape(status+industrialWarning)}</p><small>Расчёт площади по сферической модели Земли. Это не кадастровые сведения, ВРИ, зонирование ПЗЗ или санитарно-защитная зона.</small><br><a href="${escape(p.source)}" target="_blank" rel="noopener">Источник: OpenStreetMap ↗</a>`;
   layer.bindPopup(popup);layer.bindTooltip(p.name,{sticky:true});
   layer.on('mouseover',()=>layer.setStyle({weight:3,fillOpacity:0.33}));
   layer.on('mouseout',()=>layer.setStyle(style));
   industrialLayers.set(p.id,layer);
  }}).addTo(layers.industrial);
  const filter=$('[data-category="industrial"]').closest('label');filter.title=`${industrialFeatures.length} территорий · © OpenStreetMap · ${data.metadata?.osmTimestamp||''}`;
  return industrialFeatures;
 })();
 try{return await industrialRequest;}catch(e){industrialRequest=null;throw e;}
}
async function loadIndustrialNearby(h){
 try{
  const features=await loadIndustrial();if(selected?.id!==h.id)return;
  const nearby=nearestIndustrial([h.lon,h.lat],features);
  $('#industrial-nearby').innerHTML=`<strong>Ближайшие промышленные территории</strong><p>По прямой до границы, с учётом внутренних контуров.${h.approximate?' Точка ЖК приблизительная — расстояния также ориентировочные.':''}</p>${nearby.map(item=>`<button data-industrial="${escape(item.feature.properties.id)}">${escape(item.feature.properties.name)} · ${formatDistance(item.meters)} до границы${item.inside?' · ЖК внутри территории':''}</button>`).join('')}${!nearby.length?'<p>В загруженной выборке промышленные территории не найдены.</p>':''}<p>${industrialWarning}</p>`;
  $('#industrial-nearby').querySelectorAll('button').forEach(b=>b.onclick=()=>{
   enable('industrial');map.closePopup();const layer=industrialLayers.get(b.dataset.industrial);map.fitBounds(layer.getBounds(),{padding:[40,40],maxZoom:16});layer.openPopup();
  });
 }catch(e){
  if(selected?.id===h.id){$('#industrial-nearby').innerHTML='<strong>Промзоны недоступны</strong><p>Не удалось загрузить реальные контуры. Расстояния не рассчитаны.</p><button id="retry-industrial">Повторить</button>';$('#retry-industrial').onclick=()=>loadIndustrialNearby(h);}
 }
}
$('#retry').onclick=()=>{refreshHousing(true);fetchInfrastructure().catch(()=>{});loadIndustrial().then(()=>{if(selected)loadIndustrialNearby(selected);}).catch(()=>{});};
renderList();drawHomes();refreshHousing();$('#status').textContent=`ЖК на карте: ${homes.filter(h=>h.lat).length} · есть приблизительные`;fetchInfrastructure().catch(e=>console.warn('Overpass недоступен:',e.message));loadIndustrial().catch(e=>{console.warn('Промзоны недоступны:',e.message);const filter=$('[data-category="industrial"]').closest('label');filter.append(' · недоступны');filter.title='Не удалось загрузить реальные контуры';});

}
init().catch(e=>{console.error(e);document.querySelector("#status").textContent="Ошибка запуска карты";});
