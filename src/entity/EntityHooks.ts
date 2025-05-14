import {
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    UpdateEvent
} from 'typeorm';
import { keyCache } from '../keycache.js';
import getTransformer from '../transformer/index.js';

/**
 * Subscriber for handling encryption directly at the ORM level
 * This ensures that all operations properly encrypt fields
 * Decryption is handled manually in the routes for better control
 */
@EventSubscriber()
export class EncryptionSubscriber implements EntitySubscriberInterface {
  /**
   * Called before entity insertion
   * Ensures all fields with @Encrypt are encrypted
   */
  beforeInsert(event: InsertEvent<any>): void {
    this.encryptEntity(event.entity);
  }

  /**
   * Called before entity update
   * Ensures all fields with @Encrypt are encrypted
   */
  beforeUpdate(event: UpdateEvent<any>): void {
    this.encryptEntity(event.entity);
  }

  /**
   * Directly encrypts all fields marked with @Encrypt
   */
  private encryptEntity(entity: any): void {
    if (!entity || !entity.constructor || !process.env.ENCRYPTION_ENABLED) return;

    const metadataKeys = Reflect.getMetadataKeys(entity.constructor.prototype);
    if (!metadataKeys || metadataKeys.length === 0) return;
    
    console.log(`Encrypting entity of type ${entity.constructor.name}`);
    
    // Find all properties with encrypt:fieldName metadata
    const encryptedFields = metadataKeys
      .filter(key => typeof key === 'string' && key.startsWith('encrypt:'))
      .map(key => key.split(':')[1]);
    
    if (encryptedFields.length === 0) {
      // Try using metadata without prefix
      const encryptMetadata = metadataKeys.find(key => key === 'encrypt');
      if (encryptMetadata) {
        // Get all entity properties
        for (const key of Object.getOwnPropertyNames(entity)) {
          if (key.startsWith('_') || key.includes('_key_version')) continue;
          
          // Check if this property has the encrypt metadata
          const isEncrypted = Reflect.getMetadata('encrypt', entity.constructor.prototype, key);
          if (isEncrypted) {
            this.encryptField(entity, key);
          }
        }
      }
    } else {
      // Process fields with encrypt:fieldName metadata
      encryptedFields.forEach(field => {
        this.encryptField(entity, field);
      });
    }
  }

  /**
   * Encrypts a single field
   */
  private encryptField(entity: any, field: string): void {
    const value = entity[field];
    if (value === undefined || value === null) return;
    
    // Skip if already encrypted (has key version)
    const keyVersionField = `${field}_key_version`;
    if (entity[keyVersionField]) return;
    
    console.log(`Encrypting field: ${field}`);
    
    try {
      // Get active key for encryption
      const { keyId } = keyCache.active;
      
      // Directly encrypt the value using the transformer
      const encrypted = getTransformer().to(value, field, entity);
      
      // Store the encrypted value and key version
      entity[field] = encrypted;
      entity[keyVersionField] = keyId;
      
      console.log(`Field ${field} encrypted successfully with key ${keyId}`);
    } catch (error) {
      console.error(`Error encrypting ${field}:`, error);
    }
  }
} 