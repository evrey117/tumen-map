import {test,expect} from '@playwright/test';
import initial from '../fixtures/initial-residential.json' with {type:'json'};
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort());await page.route('**/data/residential.json',r=>r.fulfill({json:initial}));});
test('housing dominates infrastructure, separate panes and clusters preserve category filters',async({page})=>{
 await page.goto('/');await expect(page.locator('.housing-marker')).toHaveCount(17);await expect(page.locator('.social-cluster')).not.toHaveCount(0);
 const house=page.locator('.housing-marker').first();expect((await house.boundingBox()).width).toBe(46);await expect(page.locator('#marker-size')).toHaveValue('standard');
 const panes=await page.evaluate(()=>({housing:+getComputedStyle(document.querySelector('.leaflet-housing-pane')).zIndex,social:+getComputedStyle(document.querySelector('.leaflet-social-pane')).zIndex,industrial:+getComputedStyle(document.querySelector('.leaflet-industrial-pane')).zIndex}));expect(panes.housing).toBeGreaterThan(panes.social);expect(panes.social).toBeGreaterThan(panes.industrial);
 await page.locator('.home-card').first().click();await expect(page.locator('.housing-marker.is-selected')).toHaveCount(1);expect((await page.locator('.housing-marker.is-selected').boundingBox()).width).toBeCloseTo(55.2,1);await expect(page.locator('.housing-name')).toContainText('Румянский');
 await page.waitForTimeout(800);await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('#map')).toHaveClass(/show-social-labels/);await expect(page.locator('.social-cluster')).toHaveCount(0);await expect(page.locator('.social-marker')).toHaveCount(363);expect((await page.locator('.social-marker').first().boundingBox()).width).toBe(16);
 await page.locator('[data-category="school"]').uncheck();await expect(page.locator('.social-marker')).toHaveCount(229);await expect(page.locator('.housing-marker')).toHaveCount(17);
 await page.getByRole('button',{name:'Все ЖК'}).click();await expect(page.locator('.housing-marker.is-selected')).toHaveCount(0);await expect(page.locator('.social-cluster')).not.toHaveCount(0);await expect(page.locator('#map')).not.toHaveClass(/show-social-labels/);
});
test('three marker sizes apply to housing, selection, singles and clusters',async({page})=>{
 await page.goto('/');await expect(page.locator('.housing-marker')).toHaveCount(17);for(const [preset,size] of [['compact',42],['standard',46],['large',48]]){await page.locator('#marker-size').selectOption(preset);expect((await page.locator('.housing-marker').first().boundingBox()).width).toBe(size);}
 await page.locator('.home-card').first().click();expect((await page.locator('.housing-marker.is-selected').boundingBox()).width).toBeCloseTo(57.6,1);await page.locator('#detail .close').click();await expect(page.locator('.housing-marker.is-selected')).toHaveCount(0);
});
test('mobile marker settings, controls and administration remain accessible',async({page})=>{
 await page.setViewportSize({width:390,height:700});await page.goto('/');await page.locator('#marker-size').selectOption('large');await expect(page.locator('.housing-marker')).toHaveCount(17);
 const control=page.getByRole('button',{name:'Zoom in',exact:true});const box=await control.boundingBox();expect(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.leaflet-control-zoom')),{x:box.x+box.width/2,y:box.y+box.height/2})).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#manage-homes').click();await expect(page.locator('#housing-admin')).toBeVisible();await page.locator('#admin-close').click();await page.screenshot({path:'test-results/marker-mobile.png'});
});
test('clusters open their contents and hidden layers tolerate size changes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('.social-cluster')).not.toHaveCount(0);
 const index=await page.locator('.social-cluster').evaluateAll(nodes=>nodes.findIndex(node=>{const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return document.elementFromPoint(x,y)?.closest('.social-cluster')===node;}));expect(index).toBeGreaterThanOrEqual(0);
 const before=await page.locator('.leaflet-proxy').getAttribute('style');await page.locator('.social-cluster').nth(index).click();await expect.poll(()=>page.locator('.leaflet-proxy').getAttribute('style')).not.toBe(before);await expect(page.locator('.housing-marker')).toHaveCount(17);
 await page.locator('[data-category="school"]').uncheck();await page.locator('#marker-size').selectOption('compact');await page.locator('[data-category="school"]').check();expect(errors).toEqual([]);
});
