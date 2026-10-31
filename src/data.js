import initialHomes from '../public/data/residential.json' with {type:'json'};
export const homes = structuredClone(initialHomes.homes);
export const categories = {home:{label:'Жилые комплексы',color:'#3467ec'},school:{label:'Школы',color:'#168b60'},kindergarten:{label:'Детские сады',color:'#ee9324'},clinic:{label:'Поликлиники',color:'#d94a58'},industrial:{label:'Промзоны',color:'#854ac6'}};
export const normalize = s => s.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
export function distance(a,b){const rad=Math.PI/180;const dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad;return 6371000*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2));}
export function classify(tags={}){
 if(tags.disused==='yes'||tags.abandoned==='yes'||tags.construction||tags.proposed||tags['disused:amenity'])return null;
 if(tags.amenity==='school')return 'school';
 if(tags.amenity==='kindergarten')return 'kindergarten';
 // Only explicit public outpatient facilities, not private clinics or hospitals.
 const publicFacility=tags['operator:type']==='government'||tags['operator:type']==='public'||/ГБУЗ|ГАУЗ|ГБУ |государствен|бюджетн/i.test(tags.operator||'');
 if(publicFacility&&(tags.amenity==='clinic'||tags.healthcare==='clinic'))return 'clinic';
 return null;
}
export function matchAddress(results,home){
 const target=normalize(home.address).split(',').map(s=>s.trim());
 return results.find(r=>{
 const a=r.address||{};
 if(!a.city?.includes('Тюмен')&&!a.town?.includes('Тюмен')&&!r.display_name?.includes('Тюмень'))return false;
 if(!r.lat||!r.lon||!a.house_number)return false;
 const compact=s=>normalize(s).replace(/[\s.,/-]/g,'').replaceAll('корпус','к');
 return normalize(a.road||'')===normalize(target[0]+' улица')&&compact(a.house_number)===compact(target[1]||'') || normalize(a.road||'').replace(/^улица | улица$/g,'')===target[0]&&compact(a.house_number)===compact(target[1]||'');
 });
}
