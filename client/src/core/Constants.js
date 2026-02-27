// --- Physics / Movement ---
export const MOVE_SPEED = 300;
export const JUMP_VELOCITY = -500;

// --- Character ---
export const CHAR_WIDTH = 30;
export const CHAR_HEIGHT = 50;
export const CHAR_RADIUS = CHAR_WIDTH / 2;
export const EYE_RADIUS = 4;
export const EYE_OFFSET_X = 7;

// --- World ---
// World is much larger than any single viewport; the camera scrolls to follow
// the player rather than scaling the world to fit.
export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 800;

// --- Camera ---
// Fixed zoom applied on all screen sizes. Character always appears
// CHAR_HEIGHT * CAMERA_ZOOM pixels tall on screen — tune this to adjust
// how large the character looks without affecting any other measurements.
export const CAMERA_ZOOM = 2;

// --- Floor ---
export const FLOOR_HEIGHT = 32;

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
