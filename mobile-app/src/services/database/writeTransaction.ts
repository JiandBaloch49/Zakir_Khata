import { getDatabase } from './db';
import type { SQLiteDatabase } from 'expo-sqlite';

// Serialize shared-writer transactions, including audited edits, on Expo's connection.
let pending: Promise<unknown> = Promise.resolve();
export function withWriteTransaction<T>(work: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = pending.then(async () => {
    const db = await getDatabase();
    let value!: T;
    await db.withTransactionAsync(async () => { value = await work(db); });
    return value;
  });
  pending = result.catch(() => undefined);
  return result;
}
