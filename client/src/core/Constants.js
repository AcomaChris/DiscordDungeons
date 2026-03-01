// --- Physics / Movement ---
// AGENT: MOVE_SPEED is the legacy base walk speed. Player movement now reads
// speed from AbilityManager ('movement' ability). Keep for fallback/reference.
export const MOVE_SPEED = 80; // pixels/sec (~5 tiles/sec at 16px tiles)

// --- Tile ---
export const TILE_SIZE = 16;

// --- Character ---
// Taller than 1 tile for 3/4 perspective (head extends above the tile row)
export const CHAR_WIDTH = 16;
export const CHAR_HEIGHT = 24;
export const CHAR_RADIUS = CHAR_WIDTH / 2;
export const EYE_RADIUS = 4;
export const EYE_OFFSET_X = 7;

// Textures are generated at TEXTURE_SCALE× resolution and the sprites are
// scaled down so they look crisp when the camera zooms in. Without this,
// a 16×24 texture zoomed 3× becomes a 4×4 pixel grid — visibly blocky.
export const TEXTURE_SCALE = 4;

// --- Camera ---
// Design zoom: character appears CHAR_HEIGHT * CAMERA_ZOOM CSS pixels tall.
// At runtime this is multiplied by window.devicePixelRatio so the renderer
// uses all physical pixels on HiDPI screens without changing the visual size.
// Tune CAMERA_ZOOM to change how large the character looks on all devices.
export const CAMERA_ZOOM = 3;

// --- Depth ---
// Layers above the player (wall tops, overlay) use fixed depths above this.
// Player/NPC depth = feet Y position; wall sprite depth = tile bottom Y.
export const DEPTH_ABOVE_PLAYER = 10000;

// --- Network ---
export const NETWORK_SEND_RATE = 10;

// --- Player Colors ---
// 32 visually distinct colors assigned by join order. Shuffled so adjacent
// join slots don't look too similar. Used for both local and remote players.
export const MAX_PLAYERS = 32;
export const PLAYER_COLORS = [
  0xff6600, 0x3399ff, 0x66ff00, 0xff0066, 0xffcc00, 0x9900ff, 0x00ffcc,
  0xff3333, 0x00cc88, 0xff9900, 0x6633cc, 0x33cc33, 0xcc3399, 0x0099cc,
  0xcccc00, 0xff6699, 0x009966, 0xcc6600, 0x6699ff, 0x99cc00, 0xcc0066,
  0x33cccc, 0xff9966, 0x9966cc, 0x66cc66, 0xcc6699, 0x3399cc, 0xcccc66,
  0x9933cc, 0x66cccc, 0xcc9933, 0x6666cc,
];
