import {test,expect} from '@playwright/test';
import initial from '../fixtures/initial-residential.json' with {type:'json'};
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort());await page.route('**/data/residential.json',r=>r.fulfill({json:initial}));});
test('all social categories are on by default and stay individual at distant zooms',async({page})=>{
 await page.goto('/');await expect(page.locator('.housing-marker')).toHaveCount(17);await expect(page.locator('.social-marker')).toHaveCount(363);await expect(page.locator('.social-cluster,.marker-cluster')).toHaveCount(0);
 expect((await page.locator('.housing-marker').first().boundingBox()).width).toBe(33);expect((await page.locator('.social-marker').first().boundingBox()).width).toBe(21);
 for(const key of ['school','kindergarten','clinic'])await expect(page.locator(`[data-category="${key}"]`)).toBeChecked();
 const panes=await page.evaluate(()=>({housing:+getComputedStyle(document.querySelector('.leaflet-housing-pane')).zIndex,social:+getComputedStyle(document.querySelector('.leaflet-social-pane')).zIndex}));expect(panes.housing).toBeGreaterThan(panes.social);
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.waitForTimeout(300);await expect(page.locator('.social-marker')).toHaveCount(363);await expect(page.locator('.social-cluster,.marker-cluster')).toHaveCount(0);}
 for(const [key,remaining] of [['school',229],['kindergarten',152],['clinic',345]]){await page.locator(`[data-category="${key}"]`).uncheck();await expect(page.locator('.social-marker')).toHaveCount(remaining);await expect(page.locator('.housing-marker')).toHaveCount(17);await page.locator(`[data-category="${key}"]`).check();await expect(page.locator('.social-marker')).toHaveCount(363);}
});
test('all size presets preserve balance and selection',async({page})=>{
 await page.goto('/');await expect(page.locator('.social-marker')).toHaveCount(363);
 for(const [preset,home,social] of [['compact',32,20],['standard',33,21],['large',34,22]]){await page.locator('#marker-size').selectOption(preset);expect((await page.locator('.housing-marker').first().boundingBox()).width).toBe(home);expect((await page.locator('.social-marker').first().boundingBox()).width).toBe(social);}
 await page.locator('.home-card').first().click();expect((await page.locator('.housing-marker.is-selected').boundingBox()).width).toBeCloseTo(40.8,1);await expect(page.locator('.housing-name')).toContainText('Румянский');await page.locator('#detail .close').click();await expect(page.locator('.housing-marker.is-selected')).toHaveCount(0);
});
test('mobile keeps every infrastructure object enabled and map controls accessible',async({page})=>{
 await page.setViewportSize({width:390,height:700});await page.goto('/');await expect(page.locator('.housing-marker')).toHaveCount(17);await expect(page.locator('.social-marker')).toHaveCount(363);await expect(page.locator('.social-cluster,.marker-cluster')).toHaveCount(0);
 const control=await page.getByRole('button',{name:'Zoom in',exact:true}).boundingBox();expect(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.leaflet-control-zoom')),{x:control.x+control.width/2,y:control.y+control.height/2})).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#manage-homes').click();await expect(page.locator('#housing-admin')).toBeVisible();await page.locator('#admin-close').click();await page.screenshot({path:'test-results/marker-mobile.png'});
});
test('hidden social layers can resize and then return as individual markers',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('.social-marker')).toHaveCount(363);await page.locator('[data-category="school"]').uncheck();await page.locator('#marker-size').selectOption('compact');await page.locator('[data-category="school"]').check();await expect(page.locator('.social-marker')).toHaveCount(363);expect(errors).toEqual([]);
});
