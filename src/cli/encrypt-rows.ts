import 'dotenv/config';
import 'reflect-metadata';
import tablesConfig from '../../config/tables.json' assert { type: 'json' };
import { initDataSource } from '../bootstrap.js';
import getTransformer from '../transformer/index.js';

// Enable encryption for this script
process.env.ENCRYPTION_ENABLED = 'true';

// Check if re-encryption of existing data is requested
const reencryptExisting = process.argv.includes('--reencrypt');

(async () => {
  try {
    console.log('Starting encryption backfill');
    if (reencryptExisting) {
      console.log('Re-encryption of existing encrypted data is enabled');
    }
    
    const { ds } = await initDataSource();
    const transformer = getTransformer();
    const tx = ds.createQueryRunner();
    await tx.connect();
    await tx.startTransaction();

    try {
      // Process each table defined in config
      for (const table of tablesConfig.tables) {
        for (const field of table.fields) {
          // Process unencrypted fields
          console.log(`Processing field ${field} in ${table.schema}.${table.table_name}`);
          
          // Find rows where the field is not encrypted yet (key_version is null)
          const unencryptedRows = await tx.query(`
            SELECT id, ${field} 
            FROM ${table.schema}.${table.table_name}
            WHERE ${field}_key_version IS NULL AND ${field} IS NOT NULL
          `);

          console.log(`Found ${unencryptedRows.length} rows to encrypt for ${field}`);
          
          // Encrypt each row
          for (const row of unencryptedRows) {
            console.log(`Encrypting: ${JSON.stringify({
              id: row.id,
              field: field
            })}`);

            try {
              // Get the field value
              const value = row[field];
              
              // Create an object to store the encrypted value and key_version
              const entity: any = {};
              
              // Encrypt the value - this will also set key_version in the entity
              const encryptedValue = transformer.to(value, field, entity);
              
              // Update the row with the encrypted value and key_version
              await tx.query(`
                UPDATE ${table.schema}.${table.table_name}
                SET ${field} = $1, ${field}_key_version = $2
                WHERE id = $3
              `, [encryptedValue, entity[`${field}_key_version`], row.id]);
              
              console.log(`Encrypted ${field} for id=${row.id}`);
            } catch (err) {
              console.error(`Failed to encrypt ${field} for id=${row.id}:`, err);
            }
          }
          
          // If re-encryption flag is enabled, process already encrypted rows
          if (reencryptExisting) {
            console.log(`Re-encrypting existing encrypted data for ${field}`);
            
            // Find rows where the field is already encrypted (key_version is not null)
            const encryptedRows = await tx.query(`
              SELECT id, ${field}, ${field}_key_version 
              FROM ${table.schema}.${table.table_name}
              WHERE ${field}_key_version IS NOT NULL AND ${field} IS NOT NULL
            `);
            
            console.log(`Found ${encryptedRows.length} rows to re-encrypt for ${field}`);
            
            // Re-encrypt each row
            for (const row of encryptedRows) {
              console.log(`Re-encrypting: ${JSON.stringify({
                id: row.id,
                field: field
              })}`);
              
              try {
                // Decrypt the value first
                const decryptedValue = transformer.from(row[field], row[`${field}_key_version`]);
                
                // Create an object to store the encrypted value and key_version
                const entity: any = {};
                
                // Re-encrypt the value with the current encryption method
                const encryptedValue = transformer.to(decryptedValue, field, entity);
                
                // Update the row with the re-encrypted value and key_version
                await tx.query(`
                  UPDATE ${table.schema}.${table.table_name}
                  SET ${field} = $1, ${field}_key_version = $2
                  WHERE id = $3
                `, [encryptedValue, entity[`${field}_key_version`], row.id]);
                
                console.log(`Re-encrypted ${field} for id=${row.id}`);
              } catch (err) {
                console.error(`Failed to re-encrypt ${field} for id=${row.id}:`, err);
              }
            }
          }
        }
      }

      await tx.commitTransaction();
      console.log('Backfill completed successfully');
    } catch (error) {
      console.error('Encryption backfill failed:', error);
      await tx.rollbackTransaction();
    } finally {
      await tx.release();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
})();
