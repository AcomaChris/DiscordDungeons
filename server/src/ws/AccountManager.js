// --- AccountManager ---
// Player account CRUD: creation, lookup, session tokens, guest→Discord linking.

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getPlayers } = require('./db.js');

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function newPlayerDoc(overrides) {
  const now = new Date();
  return {
    accountType: 'guest',
    discordId: null,
    guestToken: null,
    playerName: 'Guest',
    avatarUrl: null,
    sessionToken: generateSessionToken(),
    sessionExpiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    createdAt: now,
    lastLoginAt: now,
    currency: { gold: 0, gems: 0 },
    inventory: { items: [], equipment: {}, maxSlots: 20 },
    stats: {
      level: 1, xp: 0, playtime: 0,
      attributes: { strength: 2, dexterity: 2, constitution: 2, intelligence: 2, wisdom: 2, charisma: 2 },
      statPoints: 3,
    },
    data: {},
    ...overrides,
  };
}

// --- Guest Accounts ---

async function createGuestAccount(playerName) {
  const guestToken = uuidv4();
  const doc = newPlayerDoc({
    accountType: 'guest',
    guestToken,
    playerName: playerName || 'Guest',
  });

  await getPlayers().insertOne(doc);
  console.log(`[account] Created guest account: ${doc._id} (${doc.playerName})`);
  return { guestToken, sessionToken: doc.sessionToken, playerId: doc._id, playerName: doc.playerName };
}

async function loginGuest(guestToken) {
  const now = new Date();
  const sessionToken = generateSessionToken();

  const result = await getPlayers().findOneAndUpdate(
    { guestToken },
    {
      $set: {
        sessionToken,
        sessionExpiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
        lastLoginAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) return null;
  console.log(`[account] Guest login: ${result._id} (${result.playerName})`);
  return { sessionToken, playerId: result._id, playerName: result.playerName };
}

// --- Discord Accounts ---

async function findOrCreateDiscordAccount(discordId, playerName, avatarUrl) {
  const players = getPlayers();
  const now = new Date();
  const sessionToken = generateSessionToken();

  const existing = await players.findOne({ discordId });

  if (existing) {
    await players.updateOne(
      { _id: existing._id },
      {
        $set: {
          playerName,
          avatarUrl,
          sessionToken,
          sessionExpiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
          lastLoginAt: now,
        },
      },
    );
    console.log(`[account] Discord login: ${existing._id} (${playerName})`);
    return { sessionToken, playerId: existing._id, isNew: false };
  }

  const doc = newPlayerDoc({
    accountType: 'discord',
    discordId,
    playerName,
    avatarUrl,
    sessionToken,
  });

  await players.insertOne(doc);
  console.log(`[account] Created Discord account: ${doc._id} (${playerName})`);
  return { sessionToken, playerId: doc._id, isNew: true };
}

// --- Session Lookup ---

async function getPlayerBySession(sessionToken) {
  if (!sessionToken) return null;
  const player = await getPlayers().findOne({ sessionToken });
  if (!player) return null;
  if (player.sessionExpiresAt < new Date()) return null;
  return player;
}

// --- Guest → Discord Linking ---

async function linkGuestToDiscord(guestToken, discordId, playerName, avatarUrl) {
  const players = getPlayers();
  const guestAccount = await players.findOne({ guestToken });
  if (!guestAccount) return { error: 'Guest account not found' };

  const existingDiscord = await players.findOne({ discordId });
  const now = new Date();
  const sessionToken = generateSessionToken();

  if (existingDiscord) {
    // Merge guest data into existing Discord account, then delete guest
    await players.updateOne(
      { _id: existingDiscord._id },
      {
        $set: {
          playerName: playerName || existingDiscord.playerName,
          avatarUrl: avatarUrl || existingDiscord.avatarUrl,
          sessionToken,
          sessionExpiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
          lastLoginAt: now,
        },
        $inc: {
          'currency.gold': guestAccount.currency?.gold || 0,
          'currency.gems': guestAccount.currency?.gems || 0,
          'stats.playtime': guestAccount.stats?.playtime || 0,
        },
      },
    );

    await players.deleteOne({ _id: guestAccount._id });
    console.log(`[account] Merged guest ${guestAccount._id} into Discord ${existingDiscord._id}`);
    return { sessionToken, playerId: existingDiscord._id, merged: true };
  }

  // No existing Discord account — upgrade the guest in place
  await players.updateOne(
    { _id: guestAccount._id },
    {
      $set: {
        accountType: 'discord',
        discordId,
        guestToken: null,
        playerName: playerName || guestAccount.playerName,
        avatarUrl,
        sessionToken,
        sessionExpiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
        lastLoginAt: now,
      },
    },
  );

  console.log(`[account] Upgraded guest ${guestAccount._id} to Discord (${discordId})`);
  return { sessionToken, playerId: guestAccount._id, merged: false };
}

// --- Sanitize player document for API responses ---

function sanitizePlayer(player) {
  if (!player) return null;
  const { sessionToken, sessionExpiresAt, guestToken, ...safe } = player;
  return safe;
}

module.exports = {
  createGuestAccount,
  loginGuest,
  findOrCreateDiscordAccount,
  getPlayerBySession,
  linkGuestToDiscord,
  sanitizePlayer,
};
