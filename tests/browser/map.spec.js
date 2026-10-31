import initial from '../fixtures/initial-residential.json' with {type:'json'};
import {test,expect} from '@playwright/test';
// Network failures are deliberate: these tests validate UI without fabricating geographic data.
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort());await page.route('**/data/residential.json',r=>r.fulfill({json:initial}));await page.route('**/data/infrastructure.json',r=>r.abort());});
test('all 17 complexes, search, unverified detail and filters',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.home-card')).toHaveCount(17);
 await expect(page.locator('.leaflet-container')).toBeVisible();
 await page.getByRole('searchbox').fill('сердце');await expect(page.locator('.home-card')).toHaveCount(1);
 await page.locator('.home-card').click();await expect(page.locator('#detail')).toContainText('Харьковская, 74');await expect(page.locator('#detail')).toContainText('Найдено здание');
 await page.locator('[data-category="school"]').uncheck();await expect(page.locator('[data-category="school"]')).not.toBeChecked();
 await page.getByRole('button',{name:'Все ЖК'}).click();await expect(page.locator('.home-card')).toHaveCount(17);
 await page.getByRole('searchbox').fill('нет такого жк');await expect(page.locator('.empty')).toBeVisible();
 expect(errors).toEqual([]);
});
test('mobile layout, drawer and map zoom',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(page.locator('#mobile-toggle')).toBeVisible();await page.locator('#mobile-toggle').click();await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
 await page.getByRole('button',{name:'Zoom in'}).click();await page.getByRole('button',{name:'Zoom out'}).click();
 await page.locator('#mobile-toggle').click();await page.getByRole('searchbox').fill('плэй');await expect(page.locator('.home-card')).toHaveCount(1);
 await page.screenshot({path:'test-results/mobile.png'});
});
test('verified-address response creates marker; infrastructure filters hide real layer groups (synthetic API fixtures)',async({page})=>{
 await page.route('https://nominatim.openstreetmap.org/**',r=>r.fulfill({json:[{lat:'57.153',lon:'65.542',osm_type:'way',osm_id:1,display_name:'Одесская улица, Тюмень',address:{city:'Тюмень',road:'Одесская улица',house_number:'7к1'}}]}));
 await page.route('https://overpass-api.de/**',r=>r.fulfill({json:{elements:[{type:'node',id:2,lat:57.154,lon:65.542,tags:{name:'Тестовая школа',amenity:'school'}},{type:'node',id:3,lat:57.154,lon:65.543,tags:{name:'Тестовая поликлиника',amenity:'clinic','operator:type':'government'}},{type:'node',id:4,lat:57.154,lon:65.544,tags:{name:'Частная',amenity:'clinic'}}]}}));
 await page.route('**/data/residential.json',r=>r.fulfill({json:{schemaVersion:1,homes:[{...initial.homes[0],lat:57.153,lon:65.542}]}}));await page.goto('/');await expect(page.locator('.custom-marker')).toHaveCount(3);
 await page.locator('.home-card').first().click();await expect(page.locator('#nearby')).toContainText('Тестовая школа');await expect(page.locator('#nearby')).not.toContainText('Частная');
 await page.locator('[data-category="school"]').uncheck();await expect(page.locator('.custom-marker')).toHaveCount(2);
 await page.locator('[data-category="clinic"]').uncheck();await expect(page.locator('.custom-marker')).toHaveCount(1);
 await page.locator('[data-category="home"]').uncheck();await expect(page.locator('.custom-marker')).toHaveCount(0);
 await page.getByRole('button',{name:'Все ЖК'}).click();await expect(page.locator('.custom-marker')).toHaveCount(1);
});
