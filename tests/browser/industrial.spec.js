import {test,expect} from '@playwright/test';
test('real industrial polygons toggle independently; nearest boundary opens sourced popup',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/');
 const polygons=page.locator('path.leaflet-interactive');await expect(polygons).not.toHaveCount(0);const count=await polygons.count();expect(count).toBeGreaterThan(200);
 await expect(page.locator('.home-card')).toHaveCount(17);const markers=await page.locator('.custom-marker').count();
 await page.locator('[data-category="industrial"]').uncheck();await expect(polygons).toHaveCount(0);await expect(page.locator('.custom-marker')).toHaveCount(markers);
 await page.locator('.home-card').first().click();await expect(page.locator('#industrial-nearby button')).toHaveCount(5);await expect(page.locator('#industrial-nearby')).toContainText('до границы');
 await page.locator('#industrial-nearby button').first().click();await expect(page.locator('[data-category="industrial"]')).toBeChecked();await expect(polygons).toHaveCount(count);
 await expect(page.locator('.leaflet-popup-content').filter({hasText:'landuse=industrial'})).toContainText('landuse=industrial');await expect(page.locator('.leaflet-popup-content').filter({hasText:'landuse=industrial'})).toContainText('Площадь');await expect(page.locator('.leaflet-popup-content').filter({hasText:'landuse=industrial'})).toContainText('не является оценкой опасности');await expect(page.locator('.leaflet-popup-content').filter({hasText:'landuse=industrial'}).locator('a')).toHaveAttribute('href',/^https:\/\/www.openstreetmap.org\//);
});
test('industrial filter and approximate-home distance warning work on mobile',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('searchbox').fill('Сезоны');await page.locator('.home-card').click();await expect(page.locator('#industrial-nearby')).toContainText('расстояния также ориентировочные');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-category="industrial"]').uncheck();await expect(page.locator('path.leaflet-interactive')).toHaveCount(0);
});
