export const PRICE_CATEGORIES = {studio:'Студия',one:'1-комнатная',two:'2-комнатная',three:'3-комнатная',four:'4-комнатная'};
export const formatPrice = amount => amount == null ? 'Цена не указана' : `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`;
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function safeWebsite(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export function validatePricing(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['checkedAt','website','notes','categories'].includes(k)))throw Error('Неверный формат цен');
 if(!validDate(p.checkedAt)||!safeWebsite(p.website)||p.website.length>2000)throw Error('Укажите дату проверки и официальный HTTPS-сайт');
 if(typeof p.notes!=='string'||p.notes.length>4000)throw Error('Слишком длинные условия цен');
 if(!p.categories||Object.keys(p.categories).length!==5||Object.keys(p.categories).some(k=>!Object.hasOwn(PRICE_CATEGORIES,k)))throw Error('Нужны пять категорий квартир');
 for(const entry of Object.values(p.categories)){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(k=>!['amount','area','url','checkedAt','conditions','lot','layout','offerId','warning','reason'].includes(k)))throw Error('Неверная категория цены');
  if(entry.amount!==null&&(!Number.isSafeInteger(entry.amount)||entry.amount<=0||entry.amount>100000000000))throw Error('Цена должна быть положительным целым числом рублей');
  if(!validDate(entry.checkedAt))throw Error('Неверная дата цены');
  if(entry.area!=null&&(!Number.isFinite(entry.area)||entry.area<=0||entry.area>10000))throw Error('Неверная площадь квартиры');
  if(entry.url!==undefined&&entry.url!==''&&(!safeWebsite(entry.url)||entry.url.length>2000))throw Error('Нужна HTTPS-ссылка источника цены');
  for(const key of ['conditions','lot','layout','offerId','warning','reason'])if(entry[key]!==undefined&&(typeof entry[key]!=='string'||entry[key].length>4000))throw Error('Неверные сведения о цене');
 }
 return p;
}
export function pricesMarkup(home,escape){
 const p=home.pricing;
 const date=value=>validDate(value)?value.split('-').reverse().join('.'):'Не указана';
 return `<section class="housing-prices" aria-label="Найденные цены квартир"><h3>Найденные цены квартир</h3><p class="price-explanation">Наименьшие среди найденных предложений. Не гарантированный минимум по всему ЖК. Комнатность — по обозначению застройщика, включая европланировки.</p><dl>${Object.entries(PRICE_CATEGORIES).map(([key,label])=>{
  const e=p?.categories[key];
  const details=e&&(e.url||e.conditions||e.warning||e.reason);
  return `<div class="price-row" data-price-category="${key}"><dt>${label}</dt><dd><strong>${formatPrice(e?.amount)}</strong>${e?.amount!=null?`<small>${e.area!=null?`${escape(String(e.area))} м² · `:''}${escape(e.layout||label)} · ${date(e.checkedAt)}</small>`:''}${details?`<details class="price-source-details"><summary>${e.amount==null?'Почему цена не указана':e.warning?'Условия и расхождения с архивом':'Условия и источник'}</summary>${e.url?`<a href="${escape(e.url)}" target="_blank" rel="noopener noreferrer">Предложение застройщика ↗</a>`:''}${e.conditions?`<small>${escape(e.conditions)}</small>`:''}${e.lot?`<small>${escape(e.lot)}</small>`:''}${e.warning?`<small class="state">${escape(e.warning)}</small>`:''}${e.reason&&e.amount==null?`<small>${escape(e.reason)}</small>`:''}</details>`:''}</dd></div>`;
 }).join('')}</dl><p>Дата проверки цен: <time>${date(p?.checkedAt)}</time></p>${p?.notes?`<p>${escape(p.notes)}</p>`:''}${p?.website?`<a class="official-website" href="${escape(p.website)}" target="_blank" rel="noopener noreferrer">Официальный сайт застройщика ↗</a>`:''}<p><a class="price-audit" href="${import.meta.env?.BASE_URL||'/'}data/price-evidence.json" target="_blank" rel="noopener">Источники и архив Excel</a></p></section>`;
}
