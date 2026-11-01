import { categories, classify, distance, normalize } from './data.js';

export function publicClinicEvidence(tags = {}) {
  if (tags['operator:type'] === 'private' || tags.access === 'private') return null;
  if (['government', 'public'].includes(tags['operator:type']) || /ГБУЗ|ГАУЗ|ГБУ |государствен|бюджетн/i.test(tags.operator || '')) return 'operator';
  // This is a candidate for verification, not evidence of state ownership.
  if (/^(городская |детская )?поликлиника\s*№\s*\d+/iu.test(tags.name || '')) return 'name-only';
  return null;
}

function identity(place) {
  const name = normalize(place.name);
  const number = name.match(/№\s*(\d+)/)?.[1];
  const kind = place.category;
  if (number && !/корпус|филиал/iu.test(name)) return `${kind}:${number}`;
  return `${kind}:${name.replace(/[«»"'\s-]/g, '')}`;
}

export function preparePlaces(elements) {
  const places = [];
  const excluded = [];
  for (const element of elements) {
    const tags = element.tags || {};
    const clinicEvidence = publicClinicEvidence(tags);
    let category = classify(tags);
    // Only numbered public-looking polyclinics are admitted as explicitly unverified candidates.
    const clinicCandidate = (tags.amenity === 'clinic' || tags.healthcare === 'clinic') && clinicEvidence;
    const inactive = tags.disused === 'yes' || tags.abandoned === 'yes' || tags.construction || tags.proposed || tags['disused:amenity'] || tags['abandoned:amenity'] || tags['construction:amenity'] || tags['proposed:amenity'] || tags.opening_hours === 'closed';
    if (!category && clinicCandidate && !inactive) category = 'clinic';
    if (inactive || !category) { excluded.push({id: `${element.type}/${element.id}`, reason: inactive ? 'inactive-or-planned' : 'not-eligible'}); continue; }
    if (category === 'clinic' && !clinicEvidence) continue;
    // A research institute incorrectly tagged as a school is not a general education school.
    if (category === 'school' && /научно-исследовательский институт/iu.test(tags.name || '')) {excluded.push({id: `${element.type}/${element.id}`, reason:'not-school'});continue;}
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    places.push({id: `${element.type}/${element.id}`, osmType: element.type, name: tags.name || `${categories[category].label} · название не указано в OSM`, category, lat, lon, tags, clinicEvidence: category === 'clinic' ? clinicEvidence : null, sources: [`https://www.openstreetmap.org/${element.type}/${element.id}`], operationStatus: 'unverified'});
  }
  // Prefer buildings over POIs; preserve distinct buildings/campuses with the same name.
  const priority=p=>p.osmType==='node'?2:p.tags.building?0:1;
  places.sort((a,b) => priority(a)-priority(b) || a.id.localeCompare(b.id));
  const unique = [];
  const duplicates = [];
  for (const place of places) {
    const match = unique.find(other => {
      if (place.id === other.id) return true;
      if (place.category !== other.category || identity(place) !== identity(other)) return false;
      const meters = distance([place.lat,place.lon],[other.lat,other.lon]);
      if (meters < 1) return true;
      const mixedGeometry = (place.osmType === 'node') !== (other.osmType === 'node');
      const buildingAndArea = (Boolean(place.tags.building) !== Boolean(other.tags.building)) && place.osmType !== 'node' && other.osmType !== 'node';
      const bothNamed = Boolean(place.tags.name && other.tags.name);
      const address = t => [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(',');
      const conflictingAddress = address(place.tags) && address(other.tags) && address(place.tags) !== address(other.tags);
      return (mixedGeometry || buildingAndArea) && bothNamed && !conflictingAddress && meters <= 45;
    });
    if (!match) {unique.push(place);continue;}
    for (const source of place.sources) if (!match.sources.includes(source)) match.sources.push(source);
    match.tags = {...place.tags,...match.tags};
    if (place.clinicEvidence === 'operator') match.clinicEvidence = 'operator';
    duplicates.push({removed:place.id,retained:match.id,reason:'same-entity-same-location'});
  }
  return {places:unique,duplicates,excluded};
}

export function placeStatus(place) {
  const base = 'Не проверено. Текущая работа учреждения не подтверждена независимым источником.';
  if (place.category !== 'clinic') return base;
  return (place.clinicEvidence === 'operator' ? 'Публичный оператор указан в OSM. ' : 'Кандидат по названию: государственная принадлежность не подтверждена. ') + base;
}

export function placeAddress(place){const t=place.tags;const text=[t['addr:city'],t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', ');if(!text)return 'Адрес в OSM не указан';return text+(!t['addr:street']||!t['addr:housenumber']?' (неполный адрес OSM)':'');}
