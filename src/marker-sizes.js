export const markerSizes = Object.freeze({
 compact: {home:42,social:14,cluster:24},
 standard: {home:46,social:16,cluster:26},
 large: {home:48,social:18,cluster:28},
});
export const defaultMarkerSize = 'standard';
export function markerDimensions(preset=defaultMarkerSize,selected=false){
 const sizes=markerSizes[preset]||markerSizes[defaultMarkerSize];
 return {...sizes,home:selected?sizes.home*1.2:sizes.home};
}
