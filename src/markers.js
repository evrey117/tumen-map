import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import {markerDimensions} from './marker-sizes.js';
import {categories} from './data.js';
const house='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h14V9M10 20v-7h4v7"/></svg>';
export function markerIcon(category,preset,selected=false){
 const sizes=markerDimensions(preset,selected),home=category==='home',size=home?sizes.home:sizes.social;
 return L.divIcon({
  className:`custom-marker ${home?'housing-marker':'social-marker'}${selected?' is-selected':''}`,
  html:home?`<div class="housing-symbol">${house}</div>`:`<div class="social-symbol" style="--social-color:${categories[category].color}"><span>${{school:'Ш',kindergarten:'Д',clinic:'+'}[category]}</span></div>`,
  iconSize:[size,size],iconAnchor:[size/2,size/2],popupAnchor:[0,-size/2-3],tooltipAnchor:[0,size/2+4],
 });
}
export function socialClusterGroup(category,getPreset){
 return L.markerClusterGroup({
  clusterPane:'socialPane',disableClusteringAtZoom:16,maxClusterRadius:zoom=>zoom<=12?64:42,
  showCoverageOnHover:false,spiderfyOnMaxZoom:true,zoomToBoundsOnClick:true,
  animate:false,animateAddingMarkers:false,removeOutsideVisibleBounds:false,
  iconCreateFunction:cluster=>{
   const size=markerDimensions(getPreset()).cluster,count=cluster.getChildCount();
   return L.divIcon({className:'social-cluster',iconSize:[size,size],iconAnchor:[size/2,size/2],html:`<span class="social-cluster-symbol" style="--social-color:${categories[category].color}" aria-label="${categories[category].label}: ${count}">${count}</span>`});
  },
 });
}
