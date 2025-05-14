import { keyCache } from '../keycache.js';

/**
 * Handles the encryption and decryption of PII data using WebAssembly
 * Works with the key_version column pattern for tracking encryption keys
 * Stores encrypted data as base64-encoded strings (not binary)
 */
export class PiiTransformer {
  constructor(private wasm: any) {}

  /**
   * Reads data from WebAssembly memory into a Buffer
   */
  private read(ptr: number, len: number): Buffer {
    if (!ptr) return Buffer.alloc(0);
    const mem = new Uint8Array(this.wasm.memory.buffer, ptr, len);
    return Buffer.from(mem);
  }

  /**
   * Gets the key for encryption/decryption
   * @param keyId The key ID to look up
   * @returns The encryption key as a Buffer
   */
  private getKey(keyId?: string): Buffer {
    // If keyId is provided, get that specific key, otherwise use active key
    const rec = keyId ? keyCache.byKeyId.get(keyId) : keyCache.active;
    
    if (!rec) {
      throw new Error(`Key not found: ${keyId || 'active'}`);
    }
    
    // Convert key to Buffer if it's a string
    if (typeof rec.key === 'string') {
      return Buffer.from(rec.key, 'base64');
    }
    
    return rec.key;
  }

  /**
   * Encodes binary data to base64 with URL-safe characters
   */
  private encodeBase64(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Decodes base64 string to binary data
   */
  private decodeBase64(str: string): Buffer {
    // Add back any missing padding
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64');
  }

  /**
   * Encrypts a value using the active encryption key
   * @param value The value to encrypt
   * @param fieldName The name of the field being encrypted (used for key_version field name)
   * @param entity The entity object that will receive key_version info
   * @returns The encrypted value as a base64-encoded string
   */
  to(value: any, fieldName?: string, entity?: any): string | any {
    // Return original value if encryption disabled or value is null/undefined
    if (!process.env.ENCRYPTION_ENABLED || value == null) return value;
    
    try {
      // Get the active key
      const { keyId, version } = keyCache.active;
      const key = this.getKey(keyId);
      
      // Log key information (debug only)
      console.log(`Encrypting with key: keyId=${keyId}, version=${version}, key length=${key?.length} bytes`);
      
      // Convert value to a non-empty string
      const strValue = String(value);
      if (!strValue) return value;
      
      // Validate key
      if (!key || key.length === 0) {
        console.error('Invalid key: empty or null');
        return value;
      }
      
      if (key.length !== 32) {
        console.error(`Invalid key length: ${key.length} bytes, expected 32 bytes for AES-256`);
        return value;
      }
      
      // Allocate memory for the plaintext
      const pBuf = Buffer.from(strValue);
      const pPtr = this.wasm.wasm_malloc(pBuf.length);
      new Uint8Array(this.wasm.memory.buffer, pPtr, pBuf.length).set(pBuf);
      
      // Allocate memory for the key
      const keyPtr = this.wasm.wasm_malloc(key.length);
      new Uint8Array(this.wasm.memory.buffer, keyPtr, key.length).set(key);
      
      // Call the WASM encrypt function
      console.log(`Calling WASM Encrypt with version=${version || 1}, keyPtr=${keyPtr}, keyLen=${key.length}, pPtr=${pPtr}, pLen=${pBuf.length}`);
      const encPtr = this.wasm.Encrypt(version || 1, keyPtr, key.length, pPtr, pBuf.length);
      
      if (!encPtr) {
        console.error('Encryption failed: WASM returned null pointer');
        return value;
      }
      
      // Read the encrypted result
      const len = this.wasm.last_len();
      const out = this.read(encPtr, len);
      
      // Store key_version information in entity if provided
      if (entity && fieldName) {
        entity[`${fieldName}_key_version`] = keyId;
      }
      
      // Convert binary data to base64-encoded string for storage
      const base64Value = this.encodeBase64(out);
      
      console.log(`Encryption successful: result length=${out.length} bytes, encoded as ${base64Value.length} character string`);
      return base64Value;
    } catch (error) {
      console.error('Encryption error:', error);
      return value; // Return original value on error
    }
  }

  /**
   * Decrypts a value using the key identified by keyVersion
   * @param encryptedValue The encrypted value as a base64-encoded string
   * @param keyVersion The key version/id used for encryption
   * @returns The decrypted value as a string
   */
  from(encryptedValue: any, keyVersion?: string): string | any {
    // Return original value if encryption disabled or value is null/undefined
    if (!process.env.ENCRYPTION_ENABLED || !encryptedValue) return encryptedValue;
    
    try {
      // If the value is not a string or is too short, it's not encrypted
      if (typeof encryptedValue !== 'string' || encryptedValue.length < 10) {
        return encryptedValue;
      }
      
      // Get the key from the cache based on keyVersion
      if (!keyVersion) {
        console.error('Missing key_version for decryption');
        return encryptedValue; // Return as-is
      }
      
      // Get the key for decryption
      const key = this.getKey(keyVersion);
      
      console.log(`Decrypting with key: keyId=${keyVersion}, key length=${key.length} bytes`);
      
      if (key.length !== 32) {
        console.error(`Invalid key length for decryption: ${key.length} bytes, expected 32 bytes for AES-256`);
        return encryptedValue; // Return as-is
      }
      
      // Decode the base64 string to binary
      const binaryData = this.decodeBase64(encryptedValue);
      
      // Allocate memory for the encrypted data
      const encPtr = this.wasm.wasm_malloc(binaryData.length);
      new Uint8Array(this.wasm.memory.buffer, encPtr, binaryData.length).set(binaryData);
      
      // Allocate memory for the key
      const keyPtr = this.wasm.wasm_malloc(key.length);
      new Uint8Array(this.wasm.memory.buffer, keyPtr, key.length).set(key);
      
      // Call the WASM decrypt function
      console.log(`Calling WASM Decrypt with keyPtr=${keyPtr}, keyLen=${key.length}, encPtr=${encPtr}, encLen=${binaryData.length}`);
      const decPtr = this.wasm.Decrypt(keyPtr, key.length, encPtr, binaryData.length);
      
      if (!decPtr) {
        console.error('Decryption failed: WASM returned null pointer');
        return encryptedValue; // Return as-is on error
      }
      
      // Read the decrypted result
      const len = this.wasm.last_len();
      const plain = this.read(decPtr, len);
      
      console.log(`Decryption successful: result length=${plain.length} bytes`);
      
      // Convert binary to proper string, trimming any null bytes or padding that might be present
      // First, find the actual string length (up to first null byte if present)
      let actualLength = plain.length;
      for (let i = 0; i < plain.length; i++) {
        if (plain[i] === 0) {
          actualLength = i;
          break;
        }
      }
      
      // Create a new buffer with just the actual string data
      const stringData = Buffer.from(plain.slice(0, actualLength));
      const result = stringData.toString('utf8');
      
      console.log(`Decoded string: "${result}" (${result.length} characters)`);
      return result;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedValue; // Return as-is on error
    }
  }
}