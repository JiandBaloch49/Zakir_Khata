// Run with Node 22.13+; uses built-in SQLite and the project's existing TypeScript.
// No real app database, Firebase connection, or installed test package is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const latest = Math.max(...[...fs.readFileSync(path.join(root, 'src/services/database/db.ts'), 'utf8').matchAll(/if \(version < (\d+)\)/g)].map(m => +m[1]));
const sqlite = new DatabaseSync(':memory:');
let transactionDepth = 0;
let networkCalls = 0;
let failSql = null;
let session = { isAuthenticated: true, user: { id: 'subA', name: 'UNTRUSTED SCREEN NAME' } };
const adapter = {
  execAsync: async sql => sqlite.exec(sql),
  runAsync: async (sql, params = []) => {
    if (failSql && failSql.test(sql)) throw new Error('injected write failure');
    return sqlite.prepare(sql).run(...params);
  },
  getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params) || null,
  getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
  withTransactionAsync: async work => {
    assert.equal(transactionDepth, 0, 'No nested transaction');
    sqlite.exec('BEGIN'); transactionDepth++;
    try { await work(); sqlite.exec('COMMIT'); }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    finally { transactionDepth--; }
  },
};
const syncState = {
  isOnline: true,
  processSyncQueue: async () => { assert.equal(transactionDepth, 0, 'Network only after commit'); networkCalls++; },
  incrementPendingCount: () => {},
  setPendingCount: () => {},
};
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const req = id => {
    if (id === 'firebase/firestore') return {
      doc: (_db, destination) => destination,
      setDoc: async () => { assert.equal(transactionDepth,0); },
      updateDoc: async () => { assert.equal(transactionDepth,0); },
      writeBatch: () => ({ update() {}, set() {}, commit: async () => { assert.equal(transactionDepth,0); } }),
    };
    if (id.endsWith('/firebaseConfig')) return { getFirestoreDB: () => ({}), IS_FIREBASE_CONFIGURED: true };
    if (id === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
    if (id.endsWith('/authStore')) return { useAuthStore: { getState: () => session } };
    if (id.endsWith('/useSyncStore')) return { useSyncStore: { getState: () => syncState } };
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), id + '.ts')));
    return require(id);
  };
  vm.runInNewContext('(function(require,module,exports){' + source + '\n})', { console: { log() {}, warn() {}, error() {} }, __DEV__: false }, { filename: file })(req, module, module.exports);
  return module.exports;
}
const all = (sql, ...args) => sqlite.prepare(sql).all(...args);
const one = (sql, ...args) => sqlite.prepare(sql).get(...args);
const count = table => one(`SELECT COUNT(*) AS n FROM ${table}`).n;
const login = id => { session = { isAuthenticated: true, user: { id, name: 'UNTRUSTED SCREEN NAME' } }; };
const auditCount = () => count('entry_audit');
let passed = 0;
async function check(name, test) { await test(); passed++; console.info('PASS ' + name); }

(async () => {
  // Start with populated v30 tables. initializeDatabase runs the actual v31 gate.
  sqlite.exec(`PRAGMA user_version = 30;
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, role TEXT, parentId TEXT, is_deleted INTEGER DEFAULT 0);
    CREATE TABLE customers (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, notes TEXT,
      created_at TEXT NOT NULL, updated_at TEXT, synced INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, deleted_at TEXT, firestore_path TEXT);
    INSERT INTO customers (id,user_id,name,created_at) VALUES ('c1','subA','Customer','2026-09-08');
    CREATE TABLE transactions (id TEXT PRIMARY KEY, userId TEXT, partyName TEXT, party_name_ur TEXT,
      amount_paisa INTEGER, type TEXT, notes TEXT, date TEXT, syncStatus TEXT DEFAULT 'pending',
      isDeleted INTEGER DEFAULT 0, deletedAt TEXT, createdAt TEXT, updatedAt TEXT,
      synced INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, firestore_path TEXT,
      is_deleted INTEGER DEFAULT 0, deleted_at TEXT);
    INSERT INTO users VALUES ('owner','Owner','admin',NULL,0),('staffA','Ahmed','staff','owner',0),
      ('staffB','Bilal','staff','owner',0),('subA','Sub A','staff','staffA',0),('subB','Sub B','staff','staffB',0),
      ('otherOwner','Other Owner','admin',NULL,0),('otherStaff','Other Staff','staff','otherOwner',0);
    INSERT INTO transactions (id,userId,partyName,amount_paisa,type,notes,date,createdAt,updatedAt)
      VALUES ('legacy','subA','Customer',50000,'lena','Original','2026-09-08','2026-09-08','2026-09-08');`);
  const before = JSON.stringify(all('SELECT * FROM transactions'));
  const database = load('src/services/database/db.ts');
  await database.getDatabase();
  const audit = load('src/services/database/entryAuditDb.ts');
  const tx = load('src/services/database/transactionDb.ts');
  const writer = load('src/services/database/syncHelpers.ts');
  await check('v30 to latest preserves every legacy row and value', async () => {
    assert.equal(one('PRAGMA user_version').user_version, latest);
    assert.equal(JSON.stringify(all('SELECT * FROM transactions')), before);
    assert.equal(auditCount(), 0);
    // Reopen through actual initialization with a fresh module cache: gate does not rerun.
    cache.delete(path.resolve(root, 'src/services/database/db.ts'));
    await load('src/services/database/db.ts').getDatabase();
    assert.equal(JSON.stringify(all('SELECT * FROM transactions')), before);
    const sql = load('src/services/database/entryAuditMigration.ts').ENTRY_AUDIT_V31_SQL;
    await adapter.withTransactionAsync(() => adapter.execAsync(sql));
    assert.equal(auditCount(), 0);
  });
  await check('sub-staff creation keeps integer paisa', async () => {
    const created = await tx.createTransaction('subA', 'New customer', 123456, 'dena', 'new', '2026-09-08');
    assert.equal((await tx.getTransactionById(created.id)).amount_paisa, 123456);
  });
  await check('parent edit logs two fields, stored actor name, and owner-scoped sync', async () => {
    login('staffA');
    await tx.updateTransaction('legacy', 'otherOwner', { amount_paisa: 30000, notes: 'Parent edit' });
    const h = await audit.getEntryHistory('transactions','legacy');
    assert.equal(h.rows.length,2);
    assert.equal(h.rows[0].change_group_id,h.rows[1].change_group_id);
    assert.equal(h.rows[0].actor_id,'staffA'); assert.equal(h.rows[0].actor_name,'Ahmed');
    const money = h.rows.find(r=>r.field_name==='amount_paisa');
    assert.equal(money.value_kind,'money_paisa'); assert.equal(money.old_value_json,'50000'); assert.equal(money.new_value_json,'30000');
    const queue = all('SELECT * FROM sync_queue WHERE record_id = ?', 'legacy');
    assert.equal(queue.at(-1).firestore_path,'users/subA/transactions/legacy');
    assert.equal(auditCount(),2);
  });
  await check('sub-staff and owner both see parent edits; sibling and other owner cannot', async () => {
    for (const id of ['subA','owner']) { login(id); assert.equal((await audit.getEntryHistory('transactions','legacy')).rows.length,2); assert.equal((await audit.getVisibleEntryAudit()).length,2); }
    for (const id of ['staffB','subB','otherOwner']) { login(id); await assert.rejects(audit.getEntryHistory('transactions','legacy'),/permission/); assert.equal((await audit.getVisibleEntryAudit()).length,0); }
  });
  await check('sideways and upward changes rejected in data layer, including generic writer', async () => {
    for (const actor of ['staffB','subB','otherOwner']) {
      login(actor);
      await assert.rejects(tx.updateTransaction('legacy','subA',{amount_paisa:100}),/permission/);
      await assert.rejects(tx.deleteTransaction('legacy','subA'),/permission/);
      await assert.rejects(writer.writeWithSync({tableName:'transactions',recordId:'legacy',operation:'update',data:{notes:'forged'},userId:'owner',firestorePath:'users/owner/transactions/legacy'}),/permission/);
    }
    sqlite.exec("INSERT INTO transactions (id,userId,partyName,amount_paisa,type,date) VALUES ('parent','staffA','P',100,'lena','2026-09-08'),('root','owner','P',100,'lena','2026-09-08')");
    login('subA'); await assert.rejects(tx.updateTransaction('parent','subA',{notes:'up'}),/permission/);
    await assert.rejects(tx.deleteTransaction('parent','subA'),/permission/);
    login('staffA'); await assert.rejects(tx.updateTransaction('root','staffA',{notes:'up'}),/permission/);
    assert.equal(auditCount(),2);
  });
  await check('second edit retains full chain; unchanged saves add nothing', async () => {
    login('owner'); await tx.updateTransaction('legacy','owner',{amount_paisa:123456});
    login('subA'); const h = await audit.getEntryHistory('transactions','legacy');
    assert.equal(h.rows.length,3); assert.equal(h.rows[2].old_value_json,'30000'); assert.equal(h.rows[2].new_value_json,'123456');
    assert.notEqual(h.rows[2].change_group_id,h.rows[0].change_group_id);
    await tx.updateTransaction('legacy','subA',{amount_paisa:123456}); assert.equal(auditCount(),3);
  });
  await check('reject payload ownership, sync flags, noninteger money and invalid date', async () => {
    for (const data of [{userId:'owner'},{syncStatus:'synced'},{amount_paisa:1.5},{amount_paisa:NaN},{date:'2026-02-30'},{notes:undefined}]) await assert.rejects(tx.updateTransaction('legacy','subA',data));
    assert.equal(auditCount(),3);
  });
  await check('audit or sync queue failure rolls back entry and all logs', async () => {
    const snapshot = JSON.stringify(all('SELECT * FROM transactions'));
    const queue = count('sync_queue');
    for (const pattern of [/INSERT INTO entry_audit/, /INSERT INTO sync_queue/]) {
      failSql=pattern; await assert.rejects(tx.updateTransaction('legacy','subA',{notes:'must rollback'}),/injected/); failSql=null;
      assert.equal(JSON.stringify(all('SELECT * FROM transactions')),snapshot); assert.equal(auditCount(),3); assert.equal(count('sync_queue'),queue);
    }
  });
  await check('simultaneous edits serialize with an unbroken before/after chain', async () => {
    await Promise.all([tx.updateTransaction('legacy','subA',{notes:'first'}), tx.updateTransaction('legacy','subA',{notes:'second'})]);
    const rows=(await audit.getEntryHistory('transactions','legacy')).rows;
    assert.equal(rows.at(-2).old_value_json,'"Parent edit"'); assert.equal(rows.at(-1).old_value_json,'"first"');
  });
  await check('removed owner entries remain accessible; removed actor rejected', async () => {
    sqlite.exec("UPDATE users SET is_deleted=1 WHERE id='subA'");
    await assert.rejects(tx.updateTransaction('legacy','subA',{notes:'removed'}),/no longer/);
    login('staffA'); await tx.updateTransaction('legacy','staffA',{notes:'kept owner'});
    login('owner'); assert.ok((await audit.getEntryHistory('transactions','legacy')).rows.length);
    sqlite.exec("UPDATE users SET is_deleted=0 WHERE id='subA'");
  });
  await check('soft delete preserves row; normal query hides it; ActivityLog history still opens', async () => {
    login('staffA'); await tx.deleteTransaction('legacy','staffA');
    assert.equal(await tx.getTransactionById('legacy'),null);
    const row=one("SELECT * FROM transactions WHERE id='legacy'"); assert.equal(row.isDeleted,1); assert.equal(row.is_deleted,1); assert.equal(row.amount_paisa,123456);
    for (const id of ['subA','staffA','owner']) {
      login(id); const h=await audit.getEntryHistory('transactions','legacy');
      assert.equal(h.rows.at(-1).action,'deleted'); assert.ok((await audit.getVisibleEntryAudit()).some(r=>r.entry_id==='legacy'));
    }
    await assert.rejects(tx.updateTransaction('legacy','owner',{notes:'resurrect'}),/deleted/);
  });
  await check('audit UPDATE, DELETE, REPLACE and shared-writer mutations rejected', async () => {
    assert.throws(()=>sqlite.exec("UPDATE entry_audit SET actor_name='Forged'"),/cannot be changed/);
    assert.throws(()=>sqlite.exec('DELETE FROM entry_audit'),/cannot be deleted/);
    assert.throws(()=>sqlite.exec('INSERT OR REPLACE INTO entry_audit SELECT * FROM entry_audit LIMIT 1'),/cannot be replaced/);
    await assert.rejects(writer.writeWithSync({tableName:'entry_audit',recordId:'x',operation:'update',data:{},userId:'owner',firestorePath:'x'}),/only be appended/);
  });
  await check('remote overwrite cannot bypass audit; identical replay allowed', async () => {
    await assert.rejects(audit.assertAuditedRemoteUnchanged(adapter,'transactions','legacy',{amount_paisa:1}),/sync conflict/);
    await audit.assertAuditedRemoteUnchanged(adapter,'transactions','legacy',{amount_paisa:123456});
  });
  await check('table spelling cannot bypass the shared writer gate', async () => {
    login('staffB');
    for (const tableName of ['Transactions', 'transactions ', '"transactions"', 'ENTRY_AUDIT']) {
      await assert.rejects(writer.writeWithSync({tableName,recordId:'legacy',operation:'update',data:{notes:'bypass'},userId:'owner',firestorePath:'x'}),/Invalid book table/);
    }
  });
  await check('both sync workers drain audit queue without mutating immutable audit rows', async () => {
    const processor = load('src/services/syncProcessor.ts');
    const before = JSON.stringify(all('SELECT * FROM entry_audit'));
    const queued = all('SELECT * FROM sync_queue');
    await processor.processSyncQueue();
    // A single run processes up to 20 records; drain any remaining records.
    for (let i=0; i<10 && count('sync_queue'); i++) await processor.processSyncQueue();
    assert.equal(count('sync_queue'),0);
    assert.equal(JSON.stringify(all('SELECT * FROM entry_audit')),before);
    for (const item of queued) {
      const keys=Object.keys(item);
      sqlite.prepare('INSERT INTO sync_queue ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...Object.values(item));
    }
    await processor.batchProcessSyncQueue();
    assert.equal(count('sync_queue'),0);
    assert.equal(JSON.stringify(all('SELECT * FROM entry_audit')),before);
  });
  await check('all sync attempts occurred after commit', async () => { assert.ok(networkCalls>0); assert.equal(transactionDepth,0); });
  console.info(`${passed} checks passed. No real data changed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
