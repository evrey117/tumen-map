import {test,expect} from '@playwright/test';
import data from '../../public/data/residential.json' with {type:'json'};
for(const mobile of [false,true])test(`Druzheskiy sourced marker opens the correct home (${mobile?'mobile':'desktop'})`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.route(/^https:\/\//,r=>r.abort());
 await page.route('**/data/residential.json',r=>r.fulfill({json:data}));
 await page.goto('/');
 await expect(page.locator('.housing-marker')).toHaveCount(data.homes.length);
 await page.getByRole('searchbox').fill('Дружеский');
 const marker=page.locator('.housing-marker[title="Дружеский"]');
 await expect(marker).toHaveCount(1);await marker.click({force:true});
 await expect(page.locator('#detail')).toBeVisible();
 await expect(page.locator('#detail')).toContainText('Кремлёвская, 95');
 await expect(page.locator('#detail')).toContainText('Кремлёвская, 97');
 await expect(page.locator('#detail')).not.toContainText('Координаты не подтверждены');
 const home=data.homes.find(h=>h.id==='druzheskiy');
 expect(home.source).toBe('https://www.openstreetmap.org/way/1245167703');
 expect([home.lat,home.lon]).toEqual([57.1324251,65.4749158]);
});
