// Full production CLI cycle in isolated local Git remotes. Never writes to GitHub/main.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {buildRequest} from '../src/housing-store.js';
const root=process.cwd(),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tumen-storage-audit-')),bare=path.join(scratch,'origin.git'),working=path.join(scratch,'working'),published=path.join(scratch,'published');
const dataPath='public/data/residential.json',productionHash=hash(fs.readFileSync(path.join(root,dataPath)));
const report={at:new Date().toISOString(),scope:'Actual production CLI, local bare Git origin, local HTTP publication and two browser contexts inside an isolated sandbox. GitHub owner identity is simulated; production data and Pages are not edited.',checks:[]};
let server,browser;
function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function ensure(ok,message){if(!ok)throw Error(message);}
function cli(request,actor='101'){
 ensure(fs.realpathSync(git(working,'remote','get-url','origin'))===fs.realpathSync(bare),'SAFETY: remote must be the temporary bare repository');
 const result=spawnSync(process.execPath,['scripts/manage-homes.mjs'],{cwd:working,encoding:'utf8',env:{...process.env,GITHUB_REPOSITORY:'evrey117/tumen-map',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR_ID:actor,EXPECTED_OWNER_ID:'101',CHANGE_REQUEST:JSON.stringify(request),GITHUB_OUTPUT:path.join(scratch,'output')}});
 return {code:result.status,message:result.stderr.trim()};
}
function revision(){return hash(fs.readFileSync(path.join(working,dataPath)));}
async function waitHome(page,id,name){await page.locator('#search').fill('');await page.waitForFunction(({id,name})=>{const node=document.querySelector(`.home-card[data-id="${id}"]`);return Boolean(node&&node.textContent.includes(name));},{id,name});}
try{
 git(scratch,'init','--bare','origin.git');git(scratch,'clone',bare,working);git(working,'switch','-c','main');
 for(const file of [dataPath,'scripts/manage-homes.mjs','src/housing-store.js']){const target=path.join(working,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
 fs.writeFileSync(path.join(working,'package.json'),'{"type":"module"}');git(working,'config','user.name','Storage audit');git(working,'config','user.email','audit@example.invalid');git(working,'add','.');git(working,'commit','-m','Initial isolated fixture');git(working,'push','origin','main');const initialSha=git(working,'rev-parse','HEAD');const initial=JSON.parse(fs.readFileSync(path.join(working,dataPath)));
 ensure(initial.homes.length>=2,'Audit fixture requires at least two homes');const draft=structuredClone(initial),removed=draft.homes[1].id;draft.homes.splice(1,1);draft.homes[0].name='AUDIT edited home';draft.homes[0].developer='AUDIT developer';draft.homes.push({...draft.homes[0],id:'audit-only-new-home',name:'AUDIT new home'});const originalRevision=revision();const request=buildRequest(initial,draft,originalRevision);const result=cli(request);ensure(result.code===0,'CLI save failed: '+result.message);const savedSha=git(bare,'rev-parse','main');ensure(savedSha!==initialSha,'No saved commit');git(scratch,'clone','--branch','main',bare,published);ensure(JSON.stringify(JSON.parse(fs.readFileSync(path.join(published,dataPath))))===JSON.stringify(draft),'Published data mismatch');report.checks.push({name:'production CLI create/edit/delete, actual commit and push to isolated bare origin',passed:true,savedSha});
 const unauth=cli({...request,baseRevision:revision()},'999');ensure(unauth.code!==0&&git(bare,'rev-parse','main')===savedSha,'Unauthorized actor changed data');const stale=cli(request);ensure(stale.code!==0&&git(bare,'rev-parse','main')===savedSha,'Stale request changed data');report.checks.push({name:'unauthorized actor and stale revision rejected without changing remote',passed:true});
 server=http.createServer((req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end('read only');return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file;if(pathname==='/data/residential.json'||pathname==='/public/data/residential.json')file=path.join(published,dataPath);else{const relative=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\//,'');file=path.resolve(root,'dist',relative);if(!file.startsWith(path.join(root,'dist')+path.sep)){res.writeHead(403);res.end();return;}}
  try{const bytes=fs.readFileSync(file);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),args:['--no-sandbox']});
 async function device(viewport){const context=await browser.newContext({viewport});await context.route(/^https:\/\//,r=>r.abort());await context.route('https://raw.githubusercontent.com/evrey117/tumen-map/main/public/data/residential.json*',async r=>r.fulfill({response:await context.request.get(url+'/public/data/residential.json')}));const page=await context.newPage();await page.goto(url);await waitHome(page,'audit-only-new-home','AUDIT new home');return {context,page};}
 const a=await device({width:1440,height:900});await a.page.reload();await waitHome(a.page,'audit-only-new-home','AUDIT new home');ensure(await a.page.locator(`.home-card[data-id="${removed}"]`).count()===0,'Deleted object survived');const b=await device({width:390,height:844});await waitHome(b.page,initial.homes[0].id,'AUDIT edited home');report.checks.push({name:'saved data published over isolated HTTP, survives reload and second mobile browser context',passed:true});
 const forbidden=await fetch(url+'/public/data/residential.json',{method:'PUT',body:'{}'});ensure(forbidden.status===405,'Public data endpoint accepts writes');
 const restored=cli({version:1,action:'restore',baseRevision:revision(),restoredFrom:initialSha});ensure(restored.code===0,'Restore failed '+restored.message);const restoredSha=git(bare,'rev-parse','main');ensure(restoredSha!==savedSha,'Restore did not create a new commit');git(published,'fetch','origin','main');git(published,'reset','--hard','origin/main');ensure(JSON.stringify(JSON.parse(fs.readFileSync(path.join(published,dataPath))))===JSON.stringify(initial),'Restoration mismatch');await a.page.locator('#retry').click();await waitHome(a.page,initial.homes[0].id,initial.homes[0].name);ensure(await a.page.locator('.home-card[data-id="audit-only-new-home"]').count()===0,'Synthetic object remains after restore');await b.page.reload();await waitHome(b.page,removed,initial.homes[1].name);report.checks.push({name:'restore historical Git version, push new commit, republish and refresh both devices',passed:true,restoredSha});
 ensure(hash(fs.readFileSync(path.join(root,dataPath)))===productionHash,'Production file changed');report.checks.push({name:'production JSON unchanged and temporary public endpoint is read only',passed:true});
}catch(e){report.checks.push({name:'sandbox audit',passed:false,error:e.message});process.exitCode=1;}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true});fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/storage-sandbox.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
