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
