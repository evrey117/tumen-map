import {test,expect} from '@playwright/test';
import data from '../fixtures/unlocated-residential.json' with {type:'json'};
for(const mobile of [false,true])test(`Druzheskiy is searchable without a fabricated marker (${mobile?'mobile':'desktop'})`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https:\/\//,r=>r.abort());await page.route('https://raw.githubusercontent.com/evrey117/tumen-map/main/public/data/residential.json*',r=>r.fulfill({json:data}));
 await page.route('**/data/residential.json',r=>r.fulfill({json:data}));await page.goto('/');await expect(page.locator('.home-card')).toHaveCount(18);await expect(page.locator('.housing-marker')).toHaveCount(17);await expect(page.locator('.housing-marker[title="Дружеский"]')).toHaveCount(0);
 await page.locator('#retry').click();await expect(page.locator('#status')).toContainText('ЖК на карте: 17 · без координат: 1');
 await page.getByRole('searchbox').fill('дружеский');await expect(page.locator('.home-card')).toHaveCount(1);await page.locator('.home-card').click();
 await expect(page.locator('#detail')).toBeVisible();await expect(page.locator('#detail')).toContainText('Кремлёвская, 95');await expect(page.locator('#detail')).toContainText('Кремлёвская, 97');await expect(page.locator('#detail')).toContainText('Координаты не подтверждены');
 await expect(page.locator('#detail .price-row')).toHaveCount(5);await expect(page.locator('#detail .price-row strong')).toHaveText(Array(5).fill('Цена не указана'));
 await expect(page.locator('#detail .official-website')).toHaveAttribute('href','https://xn--d1accjfe3bkp.xn--p1ai/');await expect(page.locator('#nearby button')).toHaveCount(0);
 await page.locator('#detail .close').click();await expect(page.locator('#detail')).toBeHidden();expect(errors).toEqual([]);
});
test('admin can keep unknown coordinates while editing the new home in a private draft',async({page})=>{
 await page.route(/^https:\/\//,r=>r.abort());await page.route('https://raw.githubusercontent.com/evrey117/tumen-map/main/public/data/residential.json*',r=>r.fulfill({json:data}));await page.route('**/data/residential.json',r=>r.fulfill({json:data}));await page.goto('/');await page.locator('#manage-homes').click();await expect(page.locator('#admin-message')).toContainText('Общая версия загружена');
 await page.locator('#admin-items [data-home-id="druzheskiy"]').click();await expect(page.locator('#edit-lat')).toHaveValue('');await page.locator('#edit-developer').fill('Тестовый черновик');await page.locator('#admin-form button[type=submit]').click();await expect(page.locator('#admin-message')).toContainText('применены в черновик');await page.locator('#admin-save').click();await expect(page.locator('#admin-payload')).toHaveValue(/druzheskiy/);
 const request=JSON.parse(await page.locator('#admin-payload').inputValue());expect(request.changes[0].home.lat).toBeNull();expect(request.changes[0].home.source).toBeNull();await page.locator('#admin-cancel').click();await expect(page.locator('#edit-developer')).toHaveValue(data.homes[0].developer);
});
