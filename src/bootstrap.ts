import * as path from 'path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { EncryptionSubscriber } from './entity/EntityHooks.js';
import { keyCache } from './keycache.js';
import getWasm from './wasm.js';

// Export DataSource for use in routes
export let AppDataSource: DataSource;

// Convert a base64 string to a Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove any non-base64 characters (like padding)
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  // Add padding if needed
  const paddedBase64 = cleanBase64 + '='.repeat((4 - cleanBase64.length % 4) % 4);
  
  // Decode base64 to binary string
  const binaryStr = Buffer.from(paddedBase64, 'base64').toString('binary');
  // Convert to Uint8Array
  return Uint8Array.from([...binaryStr].map(c => c.charCodeAt(0)));
}

export async function initDataSource() {
  // Get the active encryption key from keyCache
  const activeKey = keyCache.active;
  if (!activeKey) {
    throw new Error("No active encryption key found in environment");
  }
  
  console.log(`Using encryption key: ${activeKey.keyId}, version: ${activeKey.version}`);
  
  // Initialize WASM module
  getWasm();

  // Initialize DataSource
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.resolve('src/entity/*.ts')],
    subscribers: [EncryptionSubscriber],
    synchronize: false,
    logging: ['error', 'warn', 'query'] // Enable query logging for debugging
  });
  
  await ds.initialize();
  
  // Set the AppDataSource for use in other files
  AppDataSource = ds;

  return { ds };
}
