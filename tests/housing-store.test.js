import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateDataset,buildRequest} from '../src/housing-store.js';
import {applyChangeRequest,executeRequest} from '../scripts/manage-homes.mjs';
const initial=JSON.parse(fs.readFileSync(new URL('./fixtures/initial-residential.json',import.meta.url)));
const context={repository:'evrey117/tumen-map',event:'workflow_dispatch',ref:'refs/heads/main',actorId:'101',ownerId:'101'};
test('canonical dataset preserves all 17 housing complexes',()=>{assert.equal(validateDataset(initial).homes.length,17);});
test('create, edit and delete are atomic and validate fields',()=>{
 const draft=structuredClone(initial);draft.homes[0].developer='Обновлённый застройщик';draft.homes.push({...draft.homes[0],id:'new-home',name:'Новый ЖК'});draft.homes.splice(1,1);
 const request=buildRequest(initial,draft,'current');assert.equal(request.changes.length,3);const saved=applyChangeRequest(initial,request,'current',context);assert.deepEqual(saved,draft);assert.equal(initial.homes[0].developer,'Баланс Девелопмент');
 assert.throws(()=>applyChangeRequest(initial,{...request,changes:[...request.changes,{type:'upsert',home:{...draft.homes[0],lat:0}}]},'current',context));assert.equal(initial.homes.length,17);
});
test('unauthorized actors, wrong repo, stale versions and automatic events cannot write',()=>{
 const draft=structuredClone(initial);draft.homes[0].name='Черновик';const request=buildRequest(initial,draft,'old');
 for(const altered of [{actorId:'102'},{ownerId:undefined},{repository:'someone/fork'},{event:'pull_request'},{ref:'refs/heads/other'}])assert.throws(()=>applyChangeRequest(initial,request,'old',{...context,...altered}));
 assert.throws(()=>applyChangeRequest(initial,request,'new',context),/уже изменились/);
});
test('server persistence, cross-device read and historical restore use real git versions',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'housing-test-'));const file=path.join(root,'public/data/residential.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(initial,null,2)+'\n');
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{git('init','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-m','initial');const historical=git('rev-parse','HEAD');
 const revision=()=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');const draft=structuredClone(initial);draft.homes[0].name='Сохранённое изменение';executeRequest(root,buildRequest(initial,draft,revision()),context);
 assert.equal(JSON.parse(fs.readFileSync(file)).homes[0].name,'Сохранённое изменение');git('add','.');git('commit','-m','update');
 const secondDevice=JSON.parse(fs.readFileSync(file));assert.equal(secondDevice.homes[0].name,draft.homes[0].name);
 executeRequest(root,{version:1,action:'restore',baseRevision:revision(),restoredFrom:historical},context);assert.deepEqual(JSON.parse(fs.readFileSync(file)),initial);
 const before=fs.readFileSync(file,'utf8');assert.throws(()=>executeRequest(root,{version:1}, {...context,actorId:'999'}));assert.equal(fs.readFileSync(file,'utf8'),before);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
import {requestMatchesDataset} from '../src/housing-store.js';
test('unrelated revision cannot be mistaken for saving this request',()=>{
 const draft=structuredClone(initial);draft.homes[0].name='My change';const request=buildRequest(initial,draft,'base');const other=structuredClone(initial);other.homes[1].name='Someone else change';assert.equal(requestMatchesDataset(request,other),false);assert.equal(requestMatchesDataset(request,draft),true);assert.equal(requestMatchesDataset({action:'restore'},other,initial),false);
});
