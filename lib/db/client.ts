import { MongoClient, Db } from 'mongodb';

const rawUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mathengine';

if (!process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
  throw new Error('MONGODB_URI environment variable is required in production.');
}

/**
 * Robustly parses MongoDB URI and extracts database name and connection string.
 */
function parseMongoUri(raw: string): { uri: string; dbName: string } {
  try {
    const parsed = new URL(raw.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://'));
    const pathname = parsed.pathname.replace(/^\//, '').split('/')[0]?.trim();
    const dbName = pathname && !pathname.includes('?') ? pathname : 'mathengine';
    return { uri: raw, dbName };
  } catch {
    return { uri: raw, dbName: 'mathengine' };
  }
}

const { uri: connectionUri, dbName: targetDbName } = parseMongoUri(rawUri);

interface MongoCache {
  client: MongoClient;
  db: Db;
}

declare global {
  var _mongoCache: MongoCache | undefined;
}

function getDatabaseInstance(): MongoCache {
  if (global._mongoCache) {
    return global._mongoCache;
  }

  const client = new MongoClient(connectionUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  // Use the parsed database name from the connection string or fallback to 'mathengine'
  const db = client.db(targetDbName);
  const instance = { client, db };

  global._mongoCache = instance;

  // Asynchronously ensure indexes for problems collection (userId, createdAt, text search)
  void (async () => {
    try {
      const problems = db.collection('problems');
      await problems.createIndex({ userId: 1, createdAt: -1 });
      await problems.createIndex({ finalExpression: 'text' });
    } catch {
      // Indexes may already exist or DB is offline during local test runs
    }
  })();

  return instance;
}

export const { client: mongoClient, db: mongoDb } = getDatabaseInstance();
export default mongoDb;

