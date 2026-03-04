// --- Brand Configuration ---
// Detects which domain the player entered through and provides
// brand-specific display values.

const BRANDS = {
  'raveroyale.com': { title: 'Rave Royale', name: 'raveroyale' },
  'www.raveroyale.com': { title: 'Rave Royale', name: 'raveroyale' },
  'discorddungeons.com': { title: 'DiscordDungeons', name: 'discorddungeons' },
  'www.discorddungeons.com': { title: 'DiscordDungeons', name: 'discorddungeons' },
};

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const brand = BRANDS[hostname] || { title: 'DiscordDungeons', name: 'discorddungeons' };

export const BRAND_TITLE = brand.title;
export const ENTRY_DOMAIN = hostname || 'localhost';
export const BRAND_NAME = brand.name;
