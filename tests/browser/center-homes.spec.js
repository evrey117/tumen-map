import {test,expect} from '@playwright/test';
import data from '../../public/data/residential.json' with {type:'json'};
for(const mobile of [false,true])test(`central homes remain distinct through filters, selection and resizing (${mobile?'mobile':'desktop'})`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.route(/^https:\/\//,r=>r.abort());
 await page.route('**/data/residential.json',r=>r.fulfill({json:data}));
 await page.goto('/');
 await expect(page.locator('.housing-marker')).toHaveCount(data.homes.length);
 await expect(page.locator('.center-marker')).toHaveCount(4);
 await page.locator('[data-category="home"]').uncheck();
 await expect(page.locator('.housing-marker')).toHaveCount(4);
 await page.locator('[data-category="center"]').uncheck();
 await expect(page.locator('.housing-marker')).toHaveCount(0);
 await page.getByRole('button',{name:'Все ЖК'}).click();
 await expect(page.locator('.housing-marker')).toHaveCount(data.homes.length);
 for(const name of ['Челюскинцев, 5','Машаров','Счастье в Тюмени','Даудель']){
  await page.getByRole('searchbox').fill(name);await page.locator('.home-card').click();
  await expect(page.locator('#detail .detail-center')).toHaveText('Центр');
  await expect(page.locator(`.center-marker[title="${name}"]`)).toHaveCount(1);
  await page.locator('#detail .close').click();
  if(mobile)await page.locator('#mobile-toggle').click();
 }
 await page.locator('#marker-size').selectOption('large');
 await expect(page.locator('.center-marker')).toHaveCount(4);
 expect(await page.locator('.center-marker .housing-symbol').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(229, 184, 63)');
});
