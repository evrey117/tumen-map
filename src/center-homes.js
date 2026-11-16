// Curated central locations, not the administrative Central district.
// Stable IDs preserve classification when a card is edited or renamed.
export const centerHomeIds = Object.freeze(['4', 'masharov', 'schaste-v-tyumeni', 'daudel']);
export const isCenterHome = home => centerHomeIds.includes(String(home.id));
export const housingLayer = home => isCenterHome(home) ? 'center' : 'home';
