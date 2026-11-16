import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../public/data/residential.json'),audit=read('../public/data/price-refresh-2026-11-16.json');
test('current price rows retain exact observed values and dates; failed checks cannot become fresh quotes',()=>{
 let verified=0,retained=0;
 for(const h of data.homes){
  const status=audit.selected[String(h.id)];assert.equal(Object.keys(status).length,5);
  for(const [key,s]of Object.entries(status)){
   const price=h.pricing.categories[key];
   if(s.state==='verified'){
    verified++;assert.equal(price.amount,s.observation.amount);assert.equal(price.url,s.observation.url);assert.equal(price.area,s.observation.area);assert.equal(price.checkedAt,'2026-11-16');
    assert.ok(!['BOOKED','SOLD','Бронь','Устная бронь'].includes(s.observation.observedStatus));
   }else if(s.state==='retained_unverified'){
    retained++;const old=audit.previousPricing[String(h.id)].categories[key];assert.equal(price.amount,old.amount);assert.equal(price.checkedAt,old.checkedAt);assert.match(price.warning,/Не удалось перепроверить/);
   }else{assert.equal(price.amount,null);assert.ok(price.reason);}
  }
 }
 assert.equal(verified,68);assert.equal(retained,15);
 assert.equal(data.homes.find(h=>h.id===5).pricing.categories.one.amount,null);
 assert.ok(audit.excluded.some(x=>x.homeId==='5'&&x.reason.includes('sold')));
 const superSky=data.homes.find(h=>h.id==='supersky');assert.equal(superSky.pricing.categories.one.amount,6724000);
});
