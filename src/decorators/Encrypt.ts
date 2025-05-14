import 'reflect-metadata';

/**
 * Encrypt decorator for marking entity fields for encryption/decryption
 * Processing is handled by the EncryptionSubscriber
 * 
 * Example usage:
 * ```
 * @Column({ type: 'varchar', length: 255 })
 * @Encrypt()
 * sensitiveField: string;
 * 
 * @Column({ name: 'sensitiveField_key_version', type: 'varchar', length: 100 })
 * sensitiveField_key_version?: string;
 * ```
 */
export function Encrypt() {
  return function(target: any, propertyKey: string) {
    // Mark this property for encryption with metadata
    Reflect.defineMetadata('encrypt', true, target, propertyKey);
    
    // Also mark it with a namespaced metadata to ensure we can find it
    Reflect.defineMetadata(`encrypt:${propertyKey}`, true, target);
    
    console.log(`Marked field ${propertyKey} for encryption`);
  };
} 