import area from '@turf/area';
import pointToLineDistance from '@turf/point-to-line-distance';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

export function industrialArea(feature) {
  return area(feature);
}

// Distance to the actual boundary, including holes; an inside point is not assigned zero.
export function boundaryDistance(point, feature) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return Math.min(...polygons.flatMap(polygon => polygon.map(ring => pointToLineDistance(point, {type:'LineString',coordinates:ring}, {units:'meters',method:'geodesic'}))));
}

export function nearestIndustrial(point, features, limit = 5) {
  return features.map(feature => ({feature,meters:boundaryDistance(point,feature),inside:booleanPointInPolygon(point,feature)})).sort((a,b)=>a.meters-b.meters).slice(0,limit);
}

export function formatDistance(meters) {
  if (meters < 1) return '< 1 м';
  return meters < 1000 ? `${Math.round(meters)} м` : `${(meters/1000).toLocaleString('ru-RU',{maximumFractionDigits:2})} км`;
}

export function formatArea(meters) {
  return meters >= 1000000 ? `${(meters/1000000).toLocaleString('ru-RU',{maximumFractionDigits:2})} км²` : `${(meters/10000).toLocaleString('ru-RU',{maximumFractionDigits:2})} га`;
}
