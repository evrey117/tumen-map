import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {validateDataset,DATA_PATH} from '../src/housing-store.js';
export function authorizeContext(context){
 if(context.repository!=='evrey117/tumen-map'||context.event!=='workflow_dispatch'||context.ref!=='refs/heads/main'||!/^\d+$/.test(context.actorId||'')||context.actorId!==context.ownerId)throw Error('Сохранение разрешено только владельцу репозитория из main');
}
export function applyChangeRequest(current,request,currentRevision,context,restored=null){
 authorizeContext(context);validateDataset(current);
 if(request?.version!==1||!['apply','restore'].includes(request.action)||request.baseRevision!==currentRevision)throw Error('Данные уже изменились. Обновите список и повторите изменения.');
 if(request.action==='restore'){
  if(!/^[a-f0-9]{40}$/.test(request.restoredFrom||'')||!restored)throw Error('Неверная версия восстановления');return structuredClone(validateDataset(restored));
 }
 if(!Array.isArray(request.changes)||request.changes.length<1||request.changes.length>200)throw Error('Неверный список изменений');
 const homes=structuredClone(current.homes),seen=new Set();
 for(const change of request.changes){
  const id=change.type==='upsert'?change.home?.id:change.id;
  if(!['upsert','delete'].includes(change.type)||id===undefined||seen.has(String(id)))throw Error('Неверная или повторяющаяся операция');seen.add(String(id));
  const index=homes.findIndex(h=>String(h.id)===String(id));
  if(change.type==='delete'){if(index<0)throw Error('Удаляемый ЖК не найден');homes.splice(index,1);}
  else if(index<0)homes.push(change.home);else homes[index]=change.home;
 }
 return validateDataset({schemaVersion:1,homes});
}
export function executeRequest(root,request,context){
 authorizeContext(context);
 const file=`${root}/${DATA_PATH}`,text=fs.readFileSync(file,'utf8'),current=JSON.parse(text);
 const revision=createHash('sha256').update(text).digest('hex');let restored=null;
 if(request.action==='restore'){
  if(!/^[a-f0-9]{40}$/.test(request.restoredFrom||''))throw Error('Неверная версия');
  execFileSync('git',['merge-base','--is-ancestor',request.restoredFrom,'HEAD'],{cwd:root});
  restored=JSON.parse(execFileSync('git',['show',`${request.restoredFrom}:${DATA_PATH}`],{cwd:root,encoding:'utf8'}));
 }
 const next=applyChangeRequest(current,request,revision,context,restored);
 fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const raw=process.env.CHANGE_REQUEST||'';if(Buffer.byteLength(raw)>60000)throw Error('Запрос слишком большой');
  const context={repository:process.env.GITHUB_REPOSITORY,event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,actorId:process.env.GITHUB_ACTOR_ID,ownerId:process.env.EXPECTED_OWNER_ID};
  let request;try{request=JSON.parse(raw);}catch{throw Error('Некорректный JSON запроса. Используйте запрос, подготовленный панелью.');}
  executeRequest(process.cwd(),request,context);
  execFileSync('git',['config','user.name','github-actions[bot]']);execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
  execFileSync('git',['add','--',DATA_PATH]);
  let changed=true;try{execFileSync('git',['diff','--cached','--quiet','--',DATA_PATH]);changed=false;}catch{}
  if(changed){execFileSync('git',['commit','-m','Update housing data approved by repository owner']);execFileSync('git',['push','origin','HEAD:main']);}
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`revision=${sha}\n`);
  console.log('Данные проверены и сохранены.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
