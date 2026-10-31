import {test,expect} from '@playwright/test';
import initial from '../fixtures/initial-residential.json' with {type:'json'};
const central='https://raw.githubusercontent.com/evrey117/tumen-map/main/public/data/residential.json*';
async function setup(page){
 await page.route(/^https:\/\//,r=>r.abort());await page.route(central,r=>r.fulfill({json:initial}));await page.route('**/admin-config.json*',r=>r.fulfill({json:{workflowEnabled:false}}));await page.goto('/');await page.getByRole('button',{name:'Управление ЖК',exact:true}).click();await expect(page.locator('#admin-message')).toContainText('Общая версия загружена');
}
test('create, edit, confirmed delete and cancel only affect draft; no write endpoint exists',async({page})=>{
 const writes=[];page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method())&&r.url().includes('github'))writes.push(r.url());});await setup(page);
 await page.locator('#admin-new').click();await page.locator('#edit-name').fill('Тестовый ЖК');await page.locator('#edit-developer').fill('Тестовый застройщик');await page.locator('#edit-address').fill('Тестовый адрес');await page.locator('#admin-map').click({position:{x:120,y:100}});await page.locator('#edit-confirm').check();await page.locator('#admin-form button[type=submit]').click();await expect(page.locator('#admin-items button')).toHaveCount(18);
 await page.locator('#edit-developer').fill('Другой застройщик');await page.locator('#admin-form button[type=submit]').click();await page.locator('#admin-save').click();await expect(page.locator('#admin-payload')).toHaveValue(/Другой застройщик/);await expect(page.locator('#admin-auth')).toContainText('не включён');
 page.once('dialog',d=>d.dismiss());await page.locator('#admin-delete').click();await expect(page.locator('#admin-items button')).toHaveCount(18);
 page.once('dialog',d=>d.accept());await page.locator('#admin-delete').click();await expect(page.locator('#admin-items button')).toHaveCount(17);
 await page.locator('#admin-cancel').click();await expect(page.locator('#admin-summary')).toContainText('Нет несохранённых');expect(writes).toEqual([]);await expect(page.locator('.home-card')).toHaveCount(17);
});
test('geocoding offers real API result for explicit selection; moving marker resets confirmation',async({page})=>{
 await setup(page);await page.route('https://nominatim.openstreetmap.org/**',r=>r.fulfill({json:[{lat:'57.1457736',lon:'65.5963267',osm_type:'way',osm_id:123,display_name:'Одесская улица, 7к1, Тюмень',address:{house_number:'7к1'}}]}));await page.locator('#admin-new').click();await page.locator('#edit-address').fill('Одесская, 7к1');await page.locator('#admin-geocode').click();await page.locator('#admin-candidates button').click();await expect(page.locator('#edit-lat')).toHaveValue('57.1457736');await expect(page.locator('#edit-confirm')).not.toBeChecked();await page.locator('#edit-confirm').check();await page.locator('#admin-map').click({position:{x:80,y:90}});await expect(page.locator('#edit-confirm')).not.toBeChecked();
});
test('history restoration prepares immutable revision and detects concurrent changes',async({page})=>{
 await setup(page);const sha='a'.repeat(40);const previous=structuredClone(initial);previous.homes[0].name='Предыдущая версия';
 await page.route('https://api.github.com/repos/evrey117/tumen-map/commits?*',r=>r.fulfill({json:[{sha,commit:{author:{date:'2026-10-31T12:00:00Z'},message:'Тестовая версия'}}]}));await page.route(`https://raw.githubusercontent.com/evrey117/tumen-map/${sha}/**`,r=>r.fulfill({json:previous}));await page.locator('#admin-history-button').click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Восстановить в черновик'}).click();await expect(page.locator('#admin-items')).toContainText('Предыдущая версия');await page.locator('#admin-save').click();await expect(page.locator('#admin-payload')).toHaveValue(/"action":"restore"/);
 const changed=structuredClone(initial);changed.homes[0].name='Другая новая версия';await page.route(central,r=>r.fulfill({json:changed}));await page.locator('#admin-save').click();await expect(page.locator('#admin-message')).toContainText('уже изменилась');
});
test('two devices read same central data and public map refreshes after returning to page',async({browser})=>{
 const current=structuredClone(initial);const context=await browser.newContext();await context.route(/^https:\/\//,r=>r.abort());await context.route(central,r=>r.fulfill({json:current}));const a=await context.newPage();await a.goto('/');await expect(a.locator('.home-card')).toHaveCount(17);current.homes[0].name='Общая новая версия';const b=await context.newPage();await b.goto('/');await expect(b.locator('.home-card').first()).toContainText('Общая новая версия');await a.locator('#retry').click();await expect(a.locator('.home-card').first()).toContainText('Общая новая версия');await context.close();
});
test('mobile management fits screen and main layers remain present',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await expect(page.locator('#housing-admin')).toBeVisible();expect(await page.evaluate(()=>document.querySelector('#housing-admin').scrollWidth<=innerWidth)).toBe(true);await page.locator('#admin-close').click();await expect(page.locator('[data-category="industrial"]')).toBeVisible();await expect(page.locator('.home-card')).toHaveCount(17);
});
const addressResults=[
 {lat:'57.1457736',lon:'65.5963267',osm_type:'way',osm_id:1,display_name:'Первый результат: Одесская, 7к1, Тюмень',address:{house_number:'7к1'}},
 {lat:'57.1456944',lon:'65.5950341',osm_type:'way',osm_id:2,display_name:'Второй результат: Одесская, 7к2, Тюмень',address:{house_number:'7к2'}},
 {lat:'57.1462663',lon:'65.5949002',osm_type:'way',osm_id:3,display_name:'Третий результат: Одесская, 7/1, Тюмень',address:{house_number:'7/1'}},
];
for(const mobile of [false,true])test(`first, second and third address select their own coordinates and visual target (${mobile?'mobile':'desktop'})`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await setup(page);
 // Test-only observation of real Leaflet state; no coordinate hooks are added to the app.
 // Find the editor's map instance through a test-only setView wrapper, invoked on selection.
 await page.evaluate(()=>{const original=L.Map.prototype.setView;L.Map.prototype.setView=function(...args){if(this.getContainer().id==='admin-map')window.__addressTestMap=this;return original.apply(this,args);};});
 await page.route('https://nominatim.openstreetmap.org/**',r=>r.fulfill({json:addressResults}));await page.locator('#admin-geocode').click();await expect(page.locator('#admin-candidates button')).toHaveCount(3);
 for(const index of [0,1,2,0]){
  const result=addressResults[index],button=page.locator('#admin-candidates button').nth(index);await button.click();
  await expect(page.locator('#edit-lat')).toHaveValue(result.lat);await expect(page.locator('#edit-lon')).toHaveValue(result.lon);
  await expect(button).toHaveAttribute('aria-pressed','true');await expect(page.locator('#admin-candidates button.is-selected')).toHaveCount(1);await expect(page.locator('.candidate-coordinates:not([hidden])')).toHaveCount(1);await expect(button.locator('.candidate-coordinates')).toContainText(result.lat);await expect(button.locator('.candidate-coordinates')).toContainText(result.lon);
  const position=await page.evaluate(()=>{const map=window.__addressTestMap;let marker;map.eachLayer(layer=>{if(layer instanceof L.Marker)marker=layer;});const point=marker.getLatLng(),expected=map.latLngToContainerPoint(point),icon=marker.getElement().querySelector('svg').getBoundingClientRect(),box=map.getContainer().getBoundingClientRect();return {lat:point.lat,lon:point.lng,pixelError:Math.hypot(icon.x+icon.width/2-box.x-expected.x,icon.y+icon.height/2-box.y-expected.y)};});
  expect(position.lat).toBe(Number(result.lat));expect(position.lon).toBe(Number(result.lon));expect(position.pixelError).toBeLessThan(1);
 }
 await page.locator('#edit-confirm').check();await page.locator('#admin-map').click({position:{x:60,y:60}});await expect(page.locator('#admin-candidates button.is-selected')).toHaveCount(0);await expect(page.locator('#edit-confirm')).not.toBeChecked();
});
test('outdated address response does not repopulate results after the address changes',async({page})=>{
 await setup(page);let fulfill;const ready=new Promise(resolve=>fulfill=resolve);let requested;const started=new Promise(resolve=>requested=resolve);
 await page.route('https://nominatim.openstreetmap.org/**',async r=>{requested();await ready;await r.fulfill({json:addressResults});});await page.locator('#admin-geocode').click();await started;await page.locator('#edit-address').fill('Другой адрес');fulfill();await expect(page.locator('#admin-geocode')).toBeEnabled();await expect(page.locator('#admin-candidates button')).toHaveCount(0);
});
test('checking save does not erase draft or claim success after an unrelated central update',async({page})=>{
 await setup(page);await page.locator('#edit-name').fill('Мой новый заголовок');await page.locator('#admin-form button[type=submit]').click();await page.locator('#admin-save').click();await expect(page.locator('#admin-request')).toBeVisible();const unrelated=structuredClone(initial);unrelated.homes[1].name='Другая общая правка';await page.route(central,r=>r.fulfill({json:unrelated}));await page.locator('#admin-check').click();await expect(page.locator('#admin-message')).toContainText('ваш запрос не подтверждён');await expect(page.locator('#admin-items')).toContainText('Мой новый заголовок');
});
test('empty manual latitude does not move target to zero or keep confirmation',async({page})=>{
 await setup(page);const original=await page.locator('#edit-lon').inputValue();await page.locator('#edit-lat').fill('');await page.locator('#edit-lon').focus();await expect(page.locator('#edit-lon')).toHaveValue(original);await expect(page.locator('#edit-lat')).toHaveValue('');await expect(page.locator('#edit-confirm')).not.toBeChecked();await expect(page.locator('#admin-message')).toContainText('Положение метки не изменено');
});
test('save verification accepts matching changes but refuses copying a stale prepared request',async({page})=>{
 await setup(page);await page.locator('#edit-name').fill('Подтверждённое сохранение');await page.locator('#admin-form button[type=submit]').click();await page.locator('#admin-save').click();await expect(page.locator('#admin-message')).toContainText('Запрос подготовлен');
 await page.locator('#edit-developer').fill('Ещё не применённый черновик');await page.locator('#admin-copy').click();await expect(page.locator('#admin-message')).toContainText('Запрос устарел');await page.locator('#edit-developer').fill(initial.homes[0].developer);await page.locator('#admin-form button[type=submit]').click();await page.locator('#admin-save').click();await expect(page.locator('#admin-message')).toContainText('Запрос подготовлен');const updated=JSON.parse(await page.locator('#admin-payload').inputValue());const saved=structuredClone(initial);for(const change of updated.changes){if(change.type==='upsert'){const i=saved.homes.findIndex(h=>String(h.id)===String(change.home.id));if(i>=0)saved.homes[i]=change.home;else saved.homes.push(change.home);}}await page.route(central,r=>r.fulfill({json:saved}));await page.locator('#admin-check').click();await expect(page.locator('#admin-message')).toContainText('соответствует отправленному запросу');await expect(page.locator('#admin-summary')).toContainText('Нет несохранённых');
});
