import {
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    UpdateEvent
} from 'typeorm';

/**
 * This subscriber ensures that encryption is properly applied to all entities
 * before they are inserted or updated in the database
 */
@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  /**
   * Called before entity insertion
   */
  beforeInsert(event: InsertEvent<any>): void {
    this.processEncryptedFields(event.entity, event.metadata.name);
  }

  /**
   * Called before entity update
   */
  beforeUpdate(event: UpdateEvent<any>): void {
    this.processEncryptedFields(event.entity, event.metadata.name);
  }

  /**
   * Process all encrypted fields on an entity
   * Forces TypeORM to use the getter/setter methods for fields with @Encrypt decorator
   */
  private processEncryptedFields(entity: any, entityName: string): void {
    if (!entity) return;

    console.log(`Processing encrypted fields for ${entityName}`);
    
    // Get all property keys of the entity
    Object.keys(entity).forEach(key => {
      // Skip internal properties
      if (key.startsWith('_') || key.includes('_key_version')) return;
      
      // Check if this property has an @Encrypt decorator (using its metadata)
      const isEncrypted = Reflect.getMetadata('encrypt', entity.constructor.prototype, key);
      
      if (isEncrypted) {
        console.log(`Processing encrypted field: ${key}`);
        
        // Get current value
        const value = entity[key];
        
        // Force use of setter by reassigning the value
        // This triggers the @Encrypt decorator's setter method
        if (value !== undefined) {
          // Use a temporary variable to prevent infinite recursion
          const temp = value;
          entity[key] = temp;
        }
      }
    });
  }
} 