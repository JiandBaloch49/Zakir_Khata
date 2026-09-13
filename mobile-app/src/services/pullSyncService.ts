import { getDatabase } from './database/db';
import { isAuditedBook, assertAuditedRemoteUnchanged } from './database/entryAuditDb';
import { withWriteTransaction } from './database/writeTransaction';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db as firestore } from './firebase/firebaseConfig';

export async function pullRemoteChanges(userId: string): Promise<void> {
  const db = await getDatabase();
  const collections = [
    { path: 'transactions', table: 'transactions' },
    { path: 'stock_items', table: 'stock_items' },
    { path: 'stock_movements', table: 'stock_movements' },
    { path: 'bills', table: 'bills' },
    { path: 'staff_records', table: 'staff_records' },
    { path: 'staff_transactions', table: 'staff_transactions' },
    { path: 'expenses', table: 'expenses' }
  ];
  
  for (const coll of collections) {
    const meta = await db.getFirstAsync<{ last_pulled_at: string }>(
      `SELECT last_pulled_at FROM sync_metadata WHERE table_name = ?`,
      [coll.table]
    );
    const lastPulled = meta?.last_pulled_at || '1970-01-01T00:00:00.000Z';
    
    const q = query(
      collection(firestore, `users/${userId}/${coll.path}`),
      where('updated_at', '>', lastPulled)
    );

    const snapshot = await getDocs(q);

    await withWriteTransaction(async db => {
      for (const document of snapshot.docs) {
        const remoteData = document.data();
        if (isAuditedBook(coll.table)) {
          await assertAuditedRemoteUnchanged(db, coll.table, remoteData.id || document.id, remoteData);
        }
        
        // Dynamic upsert
        const keys = Object.keys(remoteData);
        // Force synced=1 because it just came from remote
        if (!keys.includes('synced')) { keys.push('synced'); remoteData.synced = 1; }
        else { remoteData.synced = 1; }

        const values = Object.values(remoteData);
        
        const placeholders = keys.map(() => '?').join(', ');
        const updateClause = keys.map(k => `${k} = excluded.${k}`).join(', ');

        await db.runAsync(
          `INSERT INTO ${coll.table} (${keys.join(', ')}) 
           VALUES (${placeholders})
           ON CONFLICT(id) DO UPDATE SET ${updateClause}`,
          values
        );
      }

      await db.runAsync(
        `INSERT INTO sync_metadata (table_name, last_pulled_at) VALUES (?, ?)
         ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
        [coll.table, new Date().toISOString()]
      );
    });
  }
}
