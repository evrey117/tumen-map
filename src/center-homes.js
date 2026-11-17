// Curated central locations, not the administrative Central district.
// Stable IDs preserve classification when a card is edited or renamed.
export const centerHomeIds = Object.freeze(['4', 'masharov', 'schaste-v-tyumeni', 'daudel', 'pervomayskaya-1a', 'white-house', 'templin', 'rechnoy-port']);
export const isCenterHome = home => centerHomeIds.includes(String(home.id));
export const housingLayer = home => isCenterHome(home) ? 'center' : 'home';
