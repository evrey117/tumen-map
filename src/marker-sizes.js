export const markerSizes = Object.freeze({
 compact: {home:32,social:20},
 standard: {home:33,social:21},
 large: {home:34,social:22},
});
export const defaultMarkerSize = 'standard';
export function markerDimensions(preset=defaultMarkerSize,selected=false){
 const sizes=markerSizes[preset]||markerSizes[defaultMarkerSize];
 return {...sizes,home:selected?sizes.home*1.2:sizes.home};
}
