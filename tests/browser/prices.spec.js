import {test,expect} from '@playwright/test';
import data from '../../public/data/residential.json' with {type:'json'};
import {PRICE_CATEGORIES,formatPrice} from '../../src/prices.js';
const central='https://raw.githubusercontent.com/evrey117/tumen-map/main/public/data/residential.json*';
async function setup(page,getData=()=>data){
 await page.route(/^https:\/\//,r=>r.abort());
 await page.route(central,r=>r.fulfill({json:getData()}));
 await page.route('**/admin-config.json*',r=>r.fulfill({json:{workflowEnabled:true}}));
 await page.goto('/');await expect(page.locator('.home-card')).toHaveCount(17);
}
for(const mobile of [false,true])test(`all 17 cards show five sourced prices, missing values and official links (${mobile?'mobile':'desktop'})`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));if(mobile)await page.setViewportSize({width:390,height:844});await setup(page);
 if(!mobile){await page.locator('.custom-marker[title="Румянский"]').click();await expect(page.locator('#detail .price-row')).toHaveCount(5);await page.locator('#detail .close').click();}
 for(const home of data.homes){
  await page.locator('.home-card').filter({hasText:home.name}).click();
  const card=page.locator('#detail');await expect(card).toBeVisible();await expect(card.locator('.housing-prices h3')).toHaveText('Найденные цены квартир');
  await expect(card.locator('.price-row')).toHaveCount(5);
  for(const key of Object.keys(PRICE_CATEGORIES)){const entry=home.pricing.categories[key],row=card.locator(`[data-price-category="${key}"]`);await expect(row.locator('strong')).toHaveText(formatPrice(entry.amount));if(entry.url)await expect(row.locator('a')).toHaveAttribute('href',entry.url);}
  await expect(card.locator('.official-website')).toHaveAttribute('href',home.pricing.website);await expect(card.locator('time')).toHaveText('01.11.2026');
  await card.locator('.close').click();await expect(card).toBeHidden();
  if(mobile)await page.locator('#mobile-toggle').click();
 }
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(mobile?390:1280);
});
test('price administration preserves owner confirmation, detects conflicts and refreshes a second device',async({page,context})=>{
 let latest=structuredClone(data);await setup(page,()=>latest);
 await page.locator('#manage-homes').click();await expect(page.locator('#admin-message')).toContainText('Общая версия загружена');
 await expect(page.locator('#edit-price-studio')).toHaveValue('5220000');
 await page.locator('#edit-price-studio').fill('5400000');await page.locator('#edit-price-one').fill('');await page.locator('#edit-price-date').fill('2026-11-02');await page.locator('#edit-price-date-studio').fill('2026-11-02');await page.locator('#edit-price-conditions-studio').fill('100% оплата — обновлено владельцем');
 await page.locator('#admin-form button[type=submit]').click();await page.locator('#admin-save').click();
 await expect(page.locator('#admin-payload')).toHaveValue(/baseRevision/);
 const request=JSON.parse(await page.locator('#admin-payload').inputValue());const home=request.changes[0].home;
 expect(home.pricing.categories.studio.amount).toBe(5400000);expect(home.pricing.categories.one.amount).toBeNull();expect(home.pricing.categories.studio.checkedAt).toBe('2026-11-02');expect(home.pricing.categories.studio.conditions).toContain('100%');
 expect(latest.homes[0].pricing.categories.studio.amount).toBe(5220000);
 // Emulate only the response of the separately unit-tested owner-approved server.
 latest.homes[0]=home;await page.locator('#admin-check').click();await expect(page.locator('#admin-message')).toContainText('соответствует отправленному запросу');
 const second=await context.newPage();await setup(second,()=>latest);await second.locator('.home-card').first().click();await expect(second.locator('[data-price-category=studio] strong')).toHaveText(formatPrice(5400000));await expect(second.locator('[data-price-category=one] strong')).toHaveText('Цена не указана');await second.close();
});
test('known incorrect Dobro location never produces misleading nearby distances',async({page})=>{
 await setup(page);await page.locator('.home-card[data-id="5"]').click();
 await expect(page.locator('#detail')).toContainText('Охотская, 17');
 await expect(page.locator('#detail')).toContainText('метка другого ЖК недостоверна');
 await expect(page.locator('#nearby')).toContainText('не рассчитаны');
 await expect(page.locator('#industrial-nearby')).toContainText('не рассчитаны');
 await expect(page.locator('#detail .price-row')).toHaveCount(5);
});
