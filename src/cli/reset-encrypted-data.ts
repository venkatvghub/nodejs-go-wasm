import 'dotenv/config';
import 'reflect-metadata';
import tablesConfig from '../../config/tables.json' assert { type: 'json' };
import { initDataSource } from '../bootstrap.js';

// Create appropriate default values for each field
const getDefaultValueForField = (tableName: string, fieldName: string) => {
  // Create default values that can be encrypted later
  if (tableName === 'users') {
    if (fieldName === 'first_name') return "'Default'";
    if (fieldName === 'last_name') return "'User'";
    if (fieldName === 'email') return "'default@example.com'";
  }
  if (tableName === 'payments') {
    if (fieldName === 'card_number') return "'0000000000000000'";
    if (fieldName === 'cvv') return "'000'";
  }
  return "''"; // Empty string as fallback
};

(async () => {
  try {
    const { ds } = await initDataSource();
    const tx = ds.createQueryRunner();
    await tx.connect();
    await tx.startTransaction();

    try {
      console.log('Resetting encrypted fields to default plaintext values...');

      for (const tbl of tablesConfig.tables) {
        for (const field of tbl.fields) {
          const defaultValue = getDefaultValueForField(tbl.table_name, field);
          console.log(`Resetting ${tbl.schema}.${tbl.table_name}.${field} to ${defaultValue}`);
          
          // Reset both the field and its key_version
          await tx.query(`
            UPDATE ${tbl.schema}.${tbl.table_name} 
            SET ${field} = ${defaultValue}::bytea, 
                ${field}_key_version = NULL
            WHERE TRUE
          `);
        }
      }

      await tx.commitTransaction();
      console.log('Successfully reset all encrypted fields to plaintext values');
    } catch (error) {
      console.error('Failed to reset encrypted fields:', error);
      await tx.rollbackTransaction();
    } finally {
      await tx.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
  }

  process.exit(0);
})(); 