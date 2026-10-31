import {test,expect} from '@playwright/test';
import {homes} from '../../src/data.js';
test('all 17 real bundled housing markers exist, are searchable, and show information',async({page})=>{
 await page.route('https://**',route=>route.abort());await page.goto('/');await expect(page.locator('.home-card')).toHaveCount(17);
 for(const category of ['school','kindergarten','clinic'])await page.locator(`[data-category="${category}"]`).uncheck();
 await expect(page.locator('.custom-marker')).toHaveCount(17);
 for(const home of homes){await expect(page.locator(`.custom-marker[title="${home.name}"]`)).toHaveCount(1);await page.getByRole('searchbox').fill(home.name);await expect(page.locator('.home-card')).toHaveCount(1);await page.locator('.home-card').click();await expect(page.locator('#detail')).toContainText(home.name);await expect(page.locator('#detail')).toContainText(home.address);if([5,15].includes(home.id))await expect(page.locator('#detail')).toContainText('Приблизительно');}
 await page.getByRole('button',{name:'Все ЖК'}).click();await expect(page.locator('.home-card')).toHaveCount(17);await expect(page.locator('#detail')).toBeHidden();
});
