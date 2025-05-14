import 'dotenv/config';

// Define the record type for encryption keys
export type Rec = {
  keyId: string;
  version: number;
  key: Buffer | string;
  status: string;
};

// Parse the ENCRYPTION_KEYS from environment
const KEYS = JSON.parse(process.env.ENCRYPTION_KEYS || '[]') as Rec[];

// Make sure exactly one key is active
const activeKeys = KEYS.filter(key => key.status === 'active');
if (activeKeys.length !== 1) {
  throw new Error(`Expected exactly one active key, found ${activeKeys.length}`);
}

// Create a map of keys by keyId
const byKeyId = new Map<string, Rec>();
for (const key of KEYS) {
  // Convert string key to buffer if needed
  if (typeof key.key === 'string') {
    key.key = Buffer.from(key.key, 'base64');
  }
  
  byKeyId.set(key.keyId, key);
}

// Export the key cache
export const keyCache = {
  byKeyId,
  get active() {
    return activeKeys[0];
  }
};
