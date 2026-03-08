// --- MongoDB Connection ---
// Connects to MongoDB on startup, exports helpers for collection access.

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/discorddungeons';

let client = null;
let db = null;

async function connect() {
  client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  db = client.db();

  // --- Indexes ---
  const players = db.collection('players');
  await players.createIndex({ discordId: 1 }, { unique: true, sparse: true });
  await players.createIndex({ guestToken: 1 }, { unique: true, sparse: true });
  await players.createIndex({ sessionToken: 1 }, { unique: true, sparse: true });

  console.log('[db] Connected to MongoDB');
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected');
  return db;
}

function getPlayers() {
  return getDb().collection('players');
}

module.exports = { connect, getDb, getPlayers };
