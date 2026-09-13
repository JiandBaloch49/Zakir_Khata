// Plain Node regression checks. Requires Node 22.13+ (built-in node:sqlite).
// Application modules/SQL are real; native printing captures HTML instead of making a PDF.
// Every database is a disposable temp file, removed in finally. No application edits.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {root,read,sourceFiles,location,latest,harness,ts,assert}=require('./regression-harness.cjs');
const dbPath='src/services/database/db.ts';
// Independent contract from Round 1: do NOT derive expectations from migration's array.
const MONEY={
 expenses:['amount'], bills:['subtotal','discount_amount','tax_amount','total','paid','due'],
 bill_items:['unit_price','line_total'], stock_items:['purchase_price','sale_price'],
 stock_movements:['cost_per_unit','sale_price_unit'],staff_records:['monthly_salary'],
 staff_salary_transactions:['amount'],activities:['amount'],purchase_orders:['total','received_total'],
 purchase_order_items:['unit_cost','line_total'],purchase_invoices:['subtotal','discount_amount','tax_amount','total','amount_paid','balance_due'],
 purchase_invoice_items:['unit_cost','line_total'],purchase_returns:['total_refund'],
 purchase_return_items:['unit_cost','line_total'],supplier_payments:['amount'],
};
const testCases=[];
const check=(id,name,where,fn)=>testCases.push({id,name,where,fn});
const at=(p,s)=>location(p,s);
async function isolated(fn,version=Infinity){const h=harness();try{await h.boot(version);return await fn(h);}finally{h.dispose();}}
const calc=h=>h.load('src/utils/calculations.ts');
const cash=h=>h.load('src/services/database/cashbookDb.ts');
const khata=h=>h.load('src/services/database/transactionDb.ts');
const users=h=>h.load('src/services/database/userDb.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const sorted=x=>[...x].sort();
const ids=rows=>sorted(rows.map(r=>r.id));
const date='2026-09-08';
function seedPeople(h){
 // account_level mirrors what the v32 backfill derives from parentId depth; every
 // real row has one after v32, so fixtures must too.
 for(const [id,role,parentId,account_level] of [['owner','admin',null,'admin'],['staffA','staff','owner','staff'],['staffB','staff','owner','staff'],['subA','staff','staffA','substaff'],['subB','staff','staffB','substaff'],['otherOwner','admin',null,'admin'],['otherStaff','staff','otherOwner','staff']])
  h.insert('users',{id,name:id,role,parentId,account_level,phone:'0300'+String(1000000+Object.keys(h.people||{}).length),businessName:'Fixture Business',passwordHash:'not-a-real-password'}),h.people={...h.people,[id]:true};
 h.login('owner');
}
async function seedEntry(h){seedPeople(h);h.login('subA');return khata(h).createTransaction('subA','Fixture customer',50000,'lena','Original',date);}
function seedLegacy(h){
 const result={};
 for(const table of Object.keys(MONEY)){
  const values={id:table+'_old'};
  for(const [i,col] of MONEY[table].entries())values[col]=12.34+i;
  h.insert(table,values);
  // Second row tests zero and nullable values, without violating NOT NULL/CHECK > 0.
  const nullable={id:table+'_nullable'};
  for(const col of MONEY[table]){
   const info=h.all('PRAGMA table_info('+table+')').find(c=>c.name===col);
   nullable[col]=info.notnull?1.25:null;
  }
  h.insert(table,nullable);
  result[table]=plain(h.all('SELECT * FROM '+table+' ORDER BY id'));
 }
 for(const table of ['transactions','cashbook']){
  h.insert(table,{id:table+'_already',amount_paisa:123456});
  result[table]=plain(h.all('SELECT * FROM '+table+' ORDER BY id'));
 }
 return result;
}
// Columns a migration is expected to POPULATE rather than preserve. Their values are
// asserted by their own dedicated test, not by the row-preservation sweep.
const BACKFILLED={users:['account_level']};
function expectMoney(h,before){
 for(const [table,rows] of Object.entries(before))for(const row of rows){
  const key=h.all('PRAGMA table_info('+table+')').find(c=>c.pk)?.name || 'id';
  const actual=h.one('SELECT * FROM '+table+' WHERE '+key+'=?',row[key]);assert.ok(actual,table+' row lost');
  for(const [col,old] of Object.entries(row)){
   if(BACKFILLED[table]?.includes(col))continue;
   const converted=MONEY[table]?.includes(col);
   const expected=converted&&old!==null?Math.round(old*100):old;
   assert.equal(actual[col],expected,table+'.'+col+' '+row.id);
   if(converted&&old!==null)assert.ok(Number.isSafeInteger(actual[col]),table+'.'+col+' must hold whole paisa');
  }
 }
}
async function report(h,type,userId='owner',startDate='2026-09-01',endDate='2026-09-30'){
 const old=h.html.length;
 await h.load('src/components/Download/pdfGenerator.ts').generateReportFile({reportType:type,userId,startDate,endDate,format:'pdf'});
 assert.equal(h.html.length,old+1,'Print API not called');return h.html.at(-1);
}
function seedReports(h){
 seedPeople(h);
 for(const who of ['owner','staffA','subA','staffB','subB','otherStaff']){
  const tag='ROW_'+who;
  h.insert('cashbook',{id:'cash_'+who,userId:who,description:tag,amount_paisa:123456,direction:who==='subA'?'out':'in',date});
  h.insert('expenses',{id:'expense_'+who,user_id:who,description:tag,amount:123456,expense_date:date});
  h.insert('bills',{id:'bill_'+who,user_id:who,party_name:tag,bill_no:101,total:123456,paid:23456,due:100000,bill_date:date});
  h.insert('stock_items',{id:'stock_'+who,user_id:who,name_en:tag,purchase_price:123456,sale_price:123456,quantity:1});
  h.insert('stock_movements',{id:'move_'+who,user_id:who,item_id:'stock_'+who,change:1,cost_per_unit:123456,sale_price_unit:123456,date});
  h.insert('staff_records',{id:'staff_'+who,user_id:who,name_en:tag,monthly_salary:123456,joining_date:date});
 }
}
check(1,'v29 converts every contracted money column; already-paisa columns unchanged',at(dbPath,'const toPaisa'),()=>isolated(async h=>{const before=seedLegacy(h);await h.boot(29);expectMoney(h,before);assert.equal(h.one('PRAGMA user_version').user_version,29);},28));
check(2,'v29 migration is exactly once across actual reopen',at(dbPath,'if (version < 29)'),()=>isolated(async h=>{seedLegacy(h);await h.boot();const before=Object.fromEntries(Object.keys(MONEY).map(t=>[t,plain(h.all('SELECT * FROM '+t+' ORDER BY id'))]));await h.boot();for(const [t,rows]of Object.entries(before))assert.deepEqual(plain(h.all('SELECT * FROM '+t+' ORDER BY id')),rows,t);},28));
check(3,'discount percentage and every quantity field survive v29 unchanged',at(dbPath,'const toPaisa'),()=>isolated(async h=>{
 const expected=[];
 for(const {name:table}of h.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")){
  const cols=h.all('PRAGMA table_info('+table+')').filter(c=>/quantity|qty|threshold|^change$|^discount_pct$/.test(c.name));
  if(!cols.length)continue;const row={id:'quantity_'+table};for(const col of cols)row[col.name]=3;
  h.insert(table,row);expected.push([table,row]);
 }
 assert.ok(expected.some(([t])=>t==='bills'));await h.boot();
 for(const [table,row]of expected){const actual=h.one('SELECT * FROM '+table+' WHERE id=?',row.id);for(const [col,value]of Object.entries(row))assert.equal(actual[col],value,table+'.'+col);}
},28));
check(4,'rupee input -> integer SQLite paisa -> Rs. 1,234.56',at('src/utils/calculations.ts','export const rupeesToPaisa'),()=>isolated(async h=>{
 seedPeople(h);const paisa=calc(h).rupeesToPaisa('1234.56');assert.equal(paisa,123456);
 const entry=await khata(h).createTransaction('owner','Roundtrip',paisa,'lena','',date);
 assert.equal(calc(h).formatCurrency((await khata(h).getTransactionById(entry.id)).amount_paisa),'Rs. 1,234.56');
}));
check(5,'paisa formatting is applied once; no nested formatCurrency calls',at('src/utils/calculations.ts','export const formatCurrency'),()=>isolated(async h=>{
 h.insert('expenses',{id:'once',amount:123456});const amount=h.one("SELECT amount FROM expenses WHERE id='once'").amount;
 assert.equal(calc(h).formatCurrency(amount),'Rs. 1,234.56');assert.notEqual(calc(h).formatCurrency(amount),'Rs. 12.35');
 const bad=[];for(const file of sourceFiles()){
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='formatCurrency'&&n.arguments.some(a=>ts.isCallExpression(a)&&a.expression.getText(sf)==='formatCurrency'))bad.push(file+':'+(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1));ts.forEachChild(n,visit);}visit(sf);
 }assert.equal(bad.length,0,bad.join('\n'));
}));
check(6,'global search returns Khata paisa without division',at('src/services/database/searchDb.ts','amount: t.amount_paisa'),()=>isolated(async h=>{
 const e=await seedEntry(h);await khata(h).updateTransaction(e.id,'subA',{amount_paisa:123456});
 const rows=await h.load('src/services/database/searchDb.ts').executeGlobalSearch('Fixture customer','owner');
 const found=rows.find(r=>r.id===e.id&&r.type==='khata');assert.ok(found);assert.equal(found.amount,123456);assert.equal(calc(h).formatCurrency(found.amount),'Rs. 1,234.56');
}));
check(7,'Khata three-argument update persists every editable field',at('src/services/database/transactionDb.ts','export const updateTransaction'),()=>isolated(async h=>{
 const e=await seedEntry(h);const changes={partyName:'Changed',amount_paisa:123456,type:'dena',notes:'New note',date:'2026-08-21'};
 await khata(h).updateTransaction(e.id,'subA',changes);const saved=await khata(h).getTransactionById(e.id);
 for(const [key,value]of Object.entries(changes))assert.equal(saved[key],value,key);
}));
check(8,'Khata clearing note binds a clean value',at('src/screens/staff/EditTransactionScreen.tsx','notes: notes.trim()'),()=>isolated(async h=>{
 const e=await seedEntry(h);await khata(h).updateTransaction(e.id,'subA',{notes:''});assert.equal((await khata(h).getTransactionById(e.id)).notes,'');
}));
check(9,'Khata edit does not change untouched date',at('src/services/database/transactionDb.ts','export const updateTransaction'),()=>isolated(async h=>{
 const e=await seedEntry(h);await khata(h).updateTransaction(e.id,'subA',{notes:'Date stays'});assert.equal((await khata(h).getTransactionById(e.id)).date,date);
}));
check(10,'Khata amount edits store integer paisa',at('src/services/database/entryAuditDb.ts','function validateField'),()=>isolated(async h=>{
 const e=await seedEntry(h);await khata(h).updateTransaction(e.id,'subA',{amount_paisa:123456});
 const row=h.one('SELECT amount_paisa,typeof(amount_paisa) AS storage FROM transactions WHERE id=?',e.id);assert.equal(row.amount_paisa,123456);assert.equal(row.storage,'integer');
 await assert.rejects(khata(h).updateTransaction(e.id,'subA',{amount_paisa:1234.56}));
}));
check(11,'v30 adds category/note without rewriting old descriptions',at(dbPath,'if (version < 30)'),()=>isolated(async h=>{
 // Current bootstrap already declares these columns; remove them ONLY in the test
 // fixture to reproduce the actual pre-v30 cashbook layout on an existing phone.
 h.sqlite.exec('ALTER TABLE cashbook DROP COLUMN category; ALTER TABLE cashbook DROP COLUMN note');
 h.insert('cashbook',{id:'oldcash',description:'old — text',amount_paisa:123456});
 await h.boot(30);const row=h.one("SELECT * FROM cashbook WHERE id='oldcash'");assert.equal(row.category,null);assert.equal(row.note,null);assert.equal(row.description,'old — text');
 assert.equal(h.one('PRAGMA user_version').user_version,30);
},29));
check(12,'cash description, category and note round-trip independently',at('src/services/database/cashbookDb.ts','export const createCashEntry'),()=>isolated(async h=>{
 seedPeople(h);const e=await cash(h).createCashEntry('owner','desc — literal',123456,'in',date,null,'Sales','note — text');
 for(const expected of [{description:'desc — literal',category:'Sales',note:'note — text'},{description:'edited — literal',category:'Other',note:'updated — note'}]){
  if(expected.category==='Other')await cash(h).updateCashEntry(e.id,'owner',expected);
  const row=await cash(h).getCashEntryById(e.id);for(const [k,v]of Object.entries(expected))assert.equal(row[k],v,k);
 }assert.equal((await cash(h).getCashEntryById(e.id)).amount_paisa,123456);
}));
check(13,'cash attachment can be set then cleared to NULL',at('src/services/database/cashbookDb.ts','export const updateCashEntry'),()=>isolated(async h=>{
 seedPeople(h);const e=await cash(h).createCashEntry('owner','receipt',123456,'in',date,'file://receipt.jpg');
 assert.equal((await cash(h).getCashEntryById(e.id)).attachment_url,'file://receipt.jpg');
 await cash(h).updateCashEntry(e.id,'owner',{attachment_url:null});assert.equal((await cash(h).getCashEntryById(e.id)).attachment_url,null);
}));
check(14,'cash create accepts 4–8 args; update rejects fields outside its accepted type',at('src/services/database/cashbookDb.ts','export const updateCashEntry'),()=>isolated(async h=>{
 seedPeople(h);const e=await cash(h).createCashEntry('owner','four args',100,'in');assert.ok(await cash(h).getCashEntryById(e.id));
 const full=await cash(h).createCashEntry('owner','eight args',123456,'out',date,null,'Sales','Note');assert.equal((await cash(h).getCashEntryById(full.id)).note,'Note');
 await assert.rejects(cash(h).updateCashEntry(e.id,'owner',{not_a_column:1}));
 // An existing DB column outside Partial<Pick<...>> must also be rejected, not just
 // a made-up column that SQLite happens to reject. This exercises the real runtime.
 await assert.rejects(cash(h).updateCashEntry(e.id,'owner',{userId:'staffB'}),'updateCashEntry accepted userId, outside its public updates type');
 // Exercise all affected APIs against actual SQLite. Invalid payloads must neither
 // alter a row nor enqueue a write, even when mixed with a valid field.
 const billId=h.insert('bills',{user_id:'owner'});
 const itemId=h.insert('bill_items',{bill_id:billId});
 const supplierId=h.insert('suppliers',{user_id:'owner'});
 const customerId=h.insert('customers',{user_id:'owner'});
 const tx=await khata(h).createTransaction('owner','Owner entry',100,'lena','',date);
 const billApi=h.load('src/services/database/billDb.ts');
 const cases=[
  ['cashbook',e.id,p=>cash(h).updateCashEntry(e.id,'owner',p),{description:'Allowed'}],
  ['bills',billId,p=>billApi.updateBill(billId,'owner',p),{party_name:'Allowed'}],
  ['bill_items',itemId,p=>billApi.updateBillItem(itemId,billId,'owner',p),{item_name:'Allowed'}],
  ['suppliers',supplierId,p=>h.load('src/services/database/supplierDb.ts').updateSupplier(supplierId,'owner',p),{name:'Allowed'}],
  ['customers',customerId,p=>h.load('src/services/database/customerDb.ts').updateCustomer(customerId,'owner',p),{name:'Allowed'}],
  ['transactions',tx.id,p=>khata(h).updateTransaction(tx.id,'owner',p),{notes:'Allowed'}],
 ];
 for(const [table,id,update,valid]of cases){
  const before=plain(h.one('SELECT * FROM '+table+' WHERE id=?',id));
  const pending=h.one('SELECT COUNT(*) AS n FROM sync_queue').n;
  for(const field of ['id','userId','user_id','bill_id','synced','syncStatus','isDeleted','is_deleted','deletedAt','deleted_at','firestore_path','skip_sync','unexpected']){
   await assert.rejects(update({...valid,[field]:'forbidden'}),/cannot be changed/,table+'.'+field);
  }
  assert.deepEqual(plain(h.one('SELECT * FROM '+table+' WHERE id=?',id)),before,table+' was modified');
  assert.equal(h.one('SELECT COUNT(*) AS n FROM sync_queue').n,pending,table+' enqueued rejected update');
  await update(valid);
  const saved=h.one('SELECT * FROM '+table+' WHERE id=?',id);for(const [field,value]of Object.entries(valid))assert.equal(saved[field],value,table+'.'+field);
 }

}));
const pdf='src/components/Download/pdfGenerator.ts';
check(15,'PDF header query uses real user/business fields',at(pdf,'SELECT name, businessName'),()=>isolated(async h=>{seedReports(h);const html=await report(h,'bill');assert.ok(html.includes('Fixture Business'));assert.ok(!/{{\w+}}/.test(html));}));
check(16,'cash report direction produces IN/OUT and correct totals',at(pdf,"if (options.reportType === 'cash')"),()=>isolated(async h=>{
 seedReports(h);const html=await report(h,'cash','staffA');assert.ok(html.includes('>IN<'));assert.ok(html.includes('>OUT<'));assert.ok(html.includes('Rs. 1,234.56'));assert.ok(html.includes('Rs. 0'));
}));
check(17,'all five report branches produce HTML rows from stored data',at(pdf,'export const generateReportFile'),()=>isolated(async h=>{
 seedReports(h);for(const type of ['cash','expense','stock','bill','staff']){
  const html=await report(h,type,'staffA');assert.match(html,/<html[\s>]/i,type);assert.ok(html.includes('ROW_staffA'),type);assert.ok(html.includes('ROW_subA'),type);assert.match(html,/<tr>/i);
 }
}));
check(18,'every PDF branch formats paisa once without doubled currency prefix',at(pdf,'export const generateReportFile'),()=>isolated(async h=>{
 seedReports(h);for(const type of ['cash','expense','stock','bill','staff']){
  const html=await report(h,type);assert.ok(html.includes('Rs. 1,234.56'),type+' missing formatted money');assert.ok(!html.includes('123456'),type+' raw paisa');assert.ok(!/Rs\.?\s+Rs\./.test(html),type+' doubled prefix');
  assert.ok(!html.includes('Rs. 12.35'),type+' divided twice');
 }
}));
check(19,'empty reports contain the appropriate no-records document',at(pdf,'No staff records'),()=>isolated(async h=>{
 seedPeople(h);const failures=[];for(const type of ['cash','expense','stock','bill','staff']){
  const html=await report(h,type);const expected=type==='staff'?'No staff records':'No records for this period';
  if(!/<html[\s>]/i.test(html)||!html.includes(expected))failures.push(type+': missing '+expected);
 }assert.equal(failures.length,0,failures.join('; '));
}));
check(20,'PDF row sets match real book queries for each hierarchy branch',at(pdf,"hierarchyFilter('si.user_id')"),()=>isolated(async h=>{
 seedReports(h);
 // A parent-owned item moved by their sub-staff is a legitimate hierarchy case.
 h.insert('stock_items',{id:'cross',user_id:'staffA',name_en:'ROW_cross',purchase_price:123456,sale_price:123456,quantity:1});
 h.insert('stock_movements',{id:'crossmove',item_id:'cross',user_id:'subA',change:1,cost_per_unit:123456,date});
 h.insert('stock_items',{id:'removedstock',user_id:'staffA',name_en:'ROW_removed',purchase_price:123456,sale_price:123456,quantity:1,is_deleted:1});
 h.insert('stock_movements',{id:'removedmove',item_id:'removedstock',user_id:'staffA',change:1,cost_per_unit:123456,date});
 const failures=[];
 for(const who of ['owner','staffA','subA','staffB','otherOwner'])for(const type of ['cash','expense','stock','bill','staff']){
  let rows,field;
  if(type==='cash'){rows=await cash(h).getCashEntriesByUserId(who,1000);field='description';}
  if(type==='expense'){rows=await h.load('src/services/database/expenseDb.ts').getExpensesByUserId(who,1000);field='description';}
  if(type==='bill'){rows=await h.load('src/services/database/billDb.ts').getBillsByUserId(who,'2026-09-01','2026-09-30');field='party_name';}
  if(type==='staff'){rows=await h.load('src/services/database/staffDb.ts').getStaffRecords(who);field='name_en';}
  if(type==='stock'){const api=h.load('src/services/database/stockDb.ts');rows=[...await api.getStockInReport(who,'2026-09-01','2026-09-30'),...await api.getStockOutReport(who,'2026-09-01','2026-09-30')];field='item_name_en';}
  const expected=sorted(new Set(rows.map(r=>r[field])));const html=await report(h,type,who);const actual=sorted(new Set(html.match(/ROW_[A-Za-z]+/g)||[]));
  if(JSON.stringify(expected)!==JSON.stringify(actual))failures.push(type+'/'+who+': expected '+expected.join(',')+'; got '+actual.join(','));
 }assert.equal(failures.length,0,failures.join('\n'));
}));
check(21,'calculator full valid-expression table',at('src/utils/safeCalc.ts','export function evaluateExpression'),()=>isolated(async h=>{
 const evaluate=h.load('src/utils/safeCalc.ts').evaluateExpression;
 for(const [input,expected]of [['12+5',17],['2+3*4',14],['100/3',33.3333333333],['0.1+0.2',0.3],['-5',-5],['5×-3',-15],['.5+.5',1],['1+2+3+4',10],['12++5',17]]){
  const result=evaluate(input);assert.equal(result.ok,true,input);assert.equal(result.value,expected,input);
 }
}));
check(22,'invalid calculator expressions return failures, never numbers',at('src/utils/safeCalc.ts','export function evaluateExpression'),()=>isolated(async h=>{
 const evaluate=h.load('src/utils/safeCalc.ts').evaluateExpression;
 for(const input of ['12+','5/0','','5M+3','5//2']){const result=evaluate(input);assert.equal(result.ok,false,input);assert.equal(typeof result.error,'string');assert.equal('value'in result,false,input);}
}));
check(23,'no executable eval or Function constructor in project source','source scan (comments/documentation ignored)',async()=>{
 const hits=[];
 for(const file of sourceFiles()){
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(n){
   if(ts.isCallExpression(n)||ts.isNewExpression(n)){
    const target=n.expression.getText(sf);
    if(/\b(eval|Function)\b/.test(target))hits.push(path.relative(root,file)+':'+(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1)+' '+target);
   }ts.forEachChild(n,visit);
  }visit(sf);
 }assert.equal(hits.length,0,hits.join('\n'));
});
check(24,'deleteUser removed; deactivateUser retains the user with soft-delete markers',at('src/services/database/userDb.ts','export const deactivateUser'),()=>isolated(async h=>{
 seedPeople(h);assert.equal(users(h).deleteUser,undefined);await users(h).deactivateUser('subA');const row=h.one("SELECT * FROM users WHERE id='subA'");assert.ok(row);assert.equal(row.is_deleted,1);assert.ok(row.deleted_at);
}));
check(25,'removing sub-staff preserves parent/owner entries AND totals',at('src/services/database/userDb.ts','export const deactivateUser'),()=>isolated(async h=>{
 seedPeople(h);await khata(h).createTransaction('subA','History',50000,'lena','',date);await cash(h).createCashEntry('subA','History',30000,'in',date);
 const before={};for(const id of ['staffA','owner'])before[id]={tx:ids(await khata(h).getTransactionsByUserId(id)),cash:ids(await cash(h).getCashEntriesByUserId(id)),txTotal:plain(await khata(h).getBalanceSummary(id)),cashTotal:plain(await cash(h).getCashBalanceSummary(id))};
 await users(h).deactivateUser('subA');
 for(const id of ['staffA','owner']){
  assert.deepEqual(ids(await khata(h).getTransactionsByUserId(id)),before[id].tx);assert.deepEqual(ids(await cash(h).getCashEntriesByUserId(id)),before[id].cash);
  assert.deepEqual(plain(await khata(h).getBalanceSummary(id)),before[id].txTotal);assert.deepEqual(plain(await cash(h).getCashBalanceSummary(id)),before[id].cashTotal);
 }
}));
check(26,'correct password works before removal and fails after removal',at('src/services/database/userDb.ts','export const verifyUserLogin'),()=>isolated(async h=>{
 seedPeople(h);const api=users(h);const hash=await api.hashPassword('FixturePass1');h.sqlite.prepare("UPDATE users SET passwordHash=?,phone=? WHERE id='subA'").run(hash,'03101111111');
 assert.equal((await api.verifyUserLogin('03101111111','FixturePass1')).id,'subA');await api.deactivateUser('subA');assert.equal(await api.verifyUserLogin('03101111111','FixturePass1'),null);
}));
check(27,'people lists stay within their owner/staff branch',at('src/services/database/userDb.ts','export const getUsersInScope'),()=>isolated(async h=>{
 seedPeople(h);assert.deepEqual(ids(await users(h).getUsersInScope('staffA')),['subA']);assert.deepEqual(ids(await users(h).getUsersInScope('staffB')),['subB']);
 assert.deepEqual(ids(await users(h).getUsersInScope('owner')),sorted(['staffA','staffB','subA','subB']));assert.deepEqual(ids(await users(h).getUsersInScope('otherOwner')),['otherStaff']);
}));
check(28,'hierarchy parent subqueries never filter out removed users','src/services/database/queryHelpers.ts and inline source SQL',async()=>{
 const hits=[];let examined=0;
 for(const file of sourceFiles()){
  const text=fs.readFileSync(file,'utf8');
  // Balanced parentheses isolate the inner SELECT (not the outer entry filter,
  // where is_deleted=0 is correct). Comments have no SQL effect.
  const re=/SELECT\s+(?:\w+\.)?id\s+FROM\s+users\s+WHERE\s+parentId\b/gi;let m;
  while((m=re.exec(text))){examined++;let depth=0,end=m.index;
   for(;end<text.length;end++){if(text[end]==='(')depth++;if(text[end]===')'){if(depth===0)break;depth--;}}
   if(/\bis_deleted\b/.test(text.slice(m.index,end)))hits.push(path.relative(root,file)+':'+text.slice(0,m.index).split('\n').length);
  }
 }assert.ok(examined>=40,'Expected to examine all hierarchy copies; found '+examined);assert.equal(hits.length,0,hits.join('\n'));
});
check(29,'empty -> latest and populated v28 -> latest migration chains preserve rows',at(dbPath,'let version ='),async()=>{
 await isolated(async h=>{assert.equal(h.one('PRAGMA user_version').user_version,latest);assert.deepEqual(h.versions,Array.from({length:latest},(_,i)=>i+1));});
 await isolated(async h=>{
  const before=seedLegacy(h);const tables=h.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map(r=>r.name);
  // Seed non-money business tables too. Queue/metadata are operational, not entries.
  for(const table of tables)if(!before[table]&&!['sync_queue','sync_metadata'].includes(table)){h.insert(table);before[table]=plain(h.all('SELECT * FROM '+table+' ORDER BY '+(h.all('PRAGMA table_info('+table+')').some(c=>c.name==='id')?'id':'rowid')));}
  for(const v of [29,30,latest]){await h.boot(v);expectMoney(h,before);assert.equal(h.one('PRAGMA user_version').user_version,v);}
  const counts=Object.fromEntries(tables.map(t=>[t,h.one('SELECT COUNT(*) AS n FROM '+t).n]));await h.boot();for(const [t,n]of Object.entries(counts))assert.equal(h.one('SELECT COUNT(*) AS n FROM '+t).n,n,t);
 },28);
});
check(30,'no imports of deleted expense module or removed user APIs','project-wide import scan',async()=>{
 const hits=[];for(const file of sourceFiles()){
  const text=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  function visit(n){
   if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n)){
    const spec=n.moduleSpecifier?.text;
    const resolved=spec?.startsWith('.')?path.resolve(path.dirname(file),spec).replace(/\\/g,'/'):spec;
    const removed=resolved&&/(?:^|\/)src\/db\/expenseDb(?:\.ts)?$/.test(resolved);
    const imported=n.importClause?.namedBindings||n.exportClause;
    if(removed||(imported&&/\b(deleteUser|getAllUsers)\b/.test(imported.getText(sf))))hits.push(path.relative(root,file)+':'+(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1));
   }
   if(ts.isCallExpression(n)&&n.arguments.length&&ts.isStringLiteral(n.arguments[0])&&/^(require|import)$/.test(n.expression.getText(sf))){
    const spec=n.arguments[0].text;const resolved=path.resolve(path.dirname(file),spec).replace(/\\/g,'/');
    if(/\/src\/db\/expenseDb(?:\.ts)?$/.test(resolved)||/\b(deleteUser|getAllUsers)\b/.test(n.parent.getText(sf)))hits.push(path.relative(root,file)+':'+(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1));
   }ts.forEachChild(n,visit);
  }visit(sf);
 }assert.equal(hits.length,0,hits.join('\n'));
});

check(31,'managed creation enforces owner/staff/sub-staff depth and strength','src/services/database/managedAccountDb.ts',()=>isolated(async h=>{
 seedPeople(h);const api=h.load('src/services/database/managedAccountDb.ts');
 const make=(accountType,phone,parentStaffId)=>api.createManagedAccount({name:'Managed '+phone,phone,password:'FixturePass1',accountType,parentStaffId});
 h.login('owner');const staff=await make('staff','03101112222');assert.equal(staff.role,'staff');assert.equal(staff.parentId,'owner');
 const child=await make('substaff','03101112223',staff.id);assert.equal(child.role,'staff');assert.equal(child.parentId,staff.id);
 assert.ok((await api.getManagedAccounts()).parents.some(p=>p.id===staff.id));
 assert.ok((await api.getManagedAccounts()).active.some(p=>p.id===child.id));
 assert.equal((await users(h).verifyUserLogin('03101112222','FixturePass1')).id,staff.id);
 h.login(staff.id);assert.deepEqual(ids((await api.getManagedAccounts()).active),[child.id]);
 const ownChild=await make('substaff','03101112224');assert.equal(ownChild.role,'staff');assert.equal(ownChild.parentId,staff.id);
 const count=()=>h.one('SELECT COUNT(*) AS n FROM users').n;const before=count();
 await assert.rejects(make('staff','03101112225'),/only create their own/);
 await assert.rejects(make('substaff','03101112225','staffB'),/another branch/);
 h.login(child.id);assert.equal((await api.getManagedAccounts()).canCreate,false);
 await assert.rejects(make('substaff','03101112225'),/Sub-staff cannot/);
 h.login('owner');await assert.rejects(make('substaff','03101112225','otherStaff'),/own team/);
 await assert.rejects(make('substaff','03101112225','subA'),/own team/);
 await assert.rejects(make('substaff','03101112225'),/Choose an active/);
 for(const password of ['Abc1','abcdefgh','Abcdefgh'])await assert.rejects(api.createManagedAccount({name:'Weak',phone:'03101112225',password,accountType:'staff'}),/Password must/);
 await users(h).deactivateUser(staff.id);await assert.rejects(make('substaff','03101112225',staff.id),/active staff/);
 h.login(staff.id);await assert.rejects(make('substaff','03101112225'),/no longer/);
 h.login('missing');await assert.rejects(make('staff','03101112225'),/no longer/);
 assert.equal(count(),before,'Rejected account was inserted');
 h.login('staffA');const branch=await api.getManagedAccounts();assert.deepEqual(ids(branch.active),['subA']);assert.equal(branch.isAdmin,false);
}));
check(32,'public registration screen, route, store action and imports are absent','public signup removal',async()=>{
 assert.equal(fs.existsSync(path.join(root,'src/screens/auth/RegisterScreen.tsx')),false);
 assert.ok(!/\bregister\s*:/.test(read('src/store/authStore.ts')));
 assert.ok(!/Register|registerBtn|registerHint/.test(read('src/screens/auth/LoginScreen.tsx')));
 assert.ok(!/Register/.test(read('src/navigation/AuthNavigator.tsx')));
 for(const file of sourceFiles())assert.ok(!/RegisterScreen/.test(fs.readFileSync(file,'utf8')),file+' references removed screen');
 const callers=sourceFiles().filter(file=>/\bcreateUser\s*\(/.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(root,file).replace(/\\/g,'/'));
 assert.deepEqual(sorted(callers),sorted(['src/services/database/seedData.ts','src/services/database/managedAccountDb.ts']));
});

// ── v32: explicit account_level ───────────────────────────────────────────────
// Visibility must be identical before and after v32. account_level is for role
// checks only; scoping still flows through parentId via userScope().
const SCOPED={transactions:'userId',cashbook:'userId',expenses:'user_id',bills:'user_id',stock_items:'user_id'};
const scopeSql=col=>'('+col+' = ? OR '+col+' IN (SELECT id FROM users WHERE parentId = ?) OR '+col+' IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))';
function scopeSnapshot(h){
 const out={};
 for(const viewer of ['owner','staffA','staffB','subA','subB','otherOwner','otherStaff'])
  for(const [table,col] of Object.entries(SCOPED))
   out[viewer+'/'+table]=ids(h.all('SELECT id FROM '+table+' WHERE '+scopeSql(col),viewer,viewer,viewer));
 return out;
}
function seedScopedEntries(h){
 for(const who of ['owner','staffA','staffB','subA','subB','otherOwner','otherStaff']){
  h.insert('transactions',{id:'t_'+who,userId:who,partyName:'P',amount_paisa:1000,type:'lena',date});
  h.insert('cashbook',{id:'c_'+who,userId:who,description:'D',amount_paisa:1000,direction:'in',date});
  h.insert('expenses',{id:'e_'+who,user_id:who,description:'D',amount:1000,expense_date:date});
  h.insert('bills',{id:'b_'+who,user_id:who,party_name:'P',bill_date:date,subtotal:1000,total:1000,due:0,status:'paid'});
  h.insert('stock_items',{id:'s_'+who,user_id:who,name_en:'Item',category:'C',unit:'pc',purchase_price:1000,sale_price:1500,low_stock_threshold:1});
 }
}
const levelOf=(h,id)=>h.one('SELECT account_level FROM users WHERE id=?',id)?.account_level;

check(33,'v32 backfill classifies every level and never promotes an edge case',at(dbPath,'v32 account_level backfill'),()=>isolated(async h=>{
 // Raw rows with NO account_level: the migration must derive all of them.
 const people=[['owner','admin',null],['staffA','staff','owner'],['subA','staff','staffA'],
  ['rootStaff','staff',null],            // edge 1: legacy self-registration
  ['orphan','staff','ghost-user'],       // edge 3: parent row removed by the old hard delete
  ['deep1','staff','subA'],              // edge 4: chain deeper than the 3-level model
  ['cycA','staff','cycB'],['cycB','staff','cycA']]; // edge 5: cycle
 for(const [id,role,parentId] of people)
  h.insert('users',{id,name:id,role,parentId,phone:'0311'+id,businessName:'B',passwordHash:'x'});
 for(const [id] of people)assert.equal(levelOf(h,id),null,id+' fixture must start unclassified');

 await h.boot();
 assert.equal(h.one('PRAGMA user_version').user_version,latest);
 assert.deepEqual(Object.fromEntries(people.map(([id])=>[id,levelOf(h,id)])),{
  owner:'admin',staffA:'staff',subA:'substaff',
  rootStaff:'staff',      // NULL parent stays top-level — matches today's permissions
  orphan:'substaff',      // dangling parent is NEVER promoted
  deep1:'substaff',cycA:'substaff',cycB:'substaff',
 });
 assert.equal(h.one("SELECT COUNT(*) AS n FROM users WHERE account_level IS NULL").n,0);
},31));

check(34,'v32 leaves every scoped result byte-identical for owner, staff and sub-staff',at('src/services/database/queryHelpers.ts','userScope'),()=>isolated(async h=>{
 seedPeople(h);seedScopedEntries(h);
 assert.equal(h.one('PRAGMA user_version').user_version,31);
 const before=scopeSnapshot(h);
 assert.ok(Object.values(before).some(v=>v.length),'snapshot must contain rows');
 await h.boot();
 assert.equal(h.one('PRAGMA user_version').user_version,latest);
 assert.deepEqual(scopeSnapshot(h),before,'v32 changed what somebody can see');
 // The scoping helper itself must be untouched by this migration.
 assert.ok(read('src/services/database/queryHelpers.ts').includes("(${col} = ? OR ${col} IN (SELECT id FROM users WHERE parentId = ?) OR ${col} IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))"));
 // The parentId-walking SUBQUERY is the scoping chain; it must stay purely structural.
 // Selecting account_level as a display column elsewhere in the same statement is fine —
 // what must never happen is account_level entering the predicate that decides visibility.
 for(const file of sourceFiles())for(const subquery of fs.readFileSync(file,'utf8').match(/SELECT id FROM users WHERE parentId[^)]*/g)||[])
  assert.ok(!/account_level/.test(subquery),'account_level must never appear in a scoping chain: '+file+' -> '+subquery.replace(/\s+/g,' ').slice(0,120));
},31));

check(35,'each creation path stores the right level and inconsistent combinations are rejected','src/services/database/managedAccountDb.ts',()=>isolated(async h=>{
 seedPeople(h);const api=h.load('src/services/database/managedAccountDb.ts');
 h.login('owner');
 const staff=await api.createManagedAccount({name:'S',phone:'03201110001',password:'FixturePass1',accountType:'staff'});
 assert.equal(levelOf(h,staff.id),'staff');assert.equal(staff.parentId,'owner');
 const ownerSub=await api.createManagedAccount({name:'OS',phone:'03201110002',password:'FixturePass1',accountType:'substaff',parentStaffId:staff.id});
 assert.equal(levelOf(h,ownerSub.id),'substaff');assert.equal(ownerSub.parentId,staff.id);
 h.login(staff.id);
 const staffSub=await api.createManagedAccount({name:'SS',phone:'03201110003',password:'FixturePass1',accountType:'substaff'});
 assert.equal(levelOf(h,staffSub.id),'substaff');assert.equal(staffSub.parentId,staff.id);
 // Inconsistent role/level/parent combinations throw rather than being corrected.
 const mk=h.load('src/services/database/userDb.ts').createUser;
 const before=h.one('SELECT COUNT(*) AS n FROM users').n;
 await assert.rejects(mk('X','03201110004','FixturePass1','admin','admin','B','owner'),/cannot have a parent/);
 await assert.rejects(mk('X','03201110004','FixturePass1','staff','admin','B'),/requires role "admin"/);
 await assert.rejects(mk('X','03201110004','FixturePass1','admin','staff','B','owner'),/requires role "staff"/);
 await assert.rejects(mk('X','03201110004','FixturePass1','staff','staff','B',staff.id),/directly under an admin/);
 await assert.rejects(mk('X','03201110004','FixturePass1','staff','substaff','B','owner'),/directly under a staff/);
 await assert.rejects(mk('X','03201110004','FixturePass1','staff','substaff','B'),/must have a parent/);
 await assert.rejects(mk('X','03201110004','FixturePass1','staff','staff','B','ghost'),/Parent account not found/);
 assert.equal(h.one('SELECT COUNT(*) AS n FROM users').n,before,'a rejected account was still inserted');
}));

check(36,'owner dashboard distinguishes sub-staff from staff instead of listing them as peers','src/screens/admin/AdminDashboard.tsx',()=>isolated(async h=>{
 seedPeople(h);
 const scoped=await users(h).getUsersInScope('owner');
 const by=Object.fromEntries(scoped.map(u=>[u.id,u]));
 assert.deepEqual(ids(scoped),['staffA','staffB','subA','subB'],'owner sees their whole tree, and nobody else');
 assert.equal(by.staffA.account_level,'staff');assert.equal(by.staffA.parentName,'owner');
 assert.equal(by.subA.account_level,'substaff');assert.equal(by.subA.parentName,'staffA');
 assert.equal(by.subB.account_level,'substaff');assert.equal(by.subB.parentName,'staffB');
 // A staff still sees only their own branch.
 assert.deepEqual(ids(await users(h).getUsersInScope('staffA')),['subA']);
 const screen=read('src/screens/admin/AdminDashboard.tsx');
 assert.ok(/account_level === 'substaff'/.test(screen),'dashboard must branch on the explicit level');
 assert.ok(/Sub-staff of \{item\.parentName\}/.test(screen),'dashboard must label the parent staff');
}));

// ── Dates: local calendar day, and no hand-typed date entry ───────────────────
// The PKT assertions must run under a real UTC+5 timezone, so they execute in a
// child process with TZ=Asia/Karachi rather than mutating this process's clock.
const inKarachi=script=>require('node:child_process').execFileSync(
 process.execPath,['-e',script],
 {env:{...process.env,TZ:'Asia/Karachi'},encoding:'utf8',cwd:root}
).trim();

check(37,'today is the LOCAL calendar day, not the UTC one',at('src/utils/dates.ts','localDate'),()=>{
 const out=inKarachi(`
  const assert=require('node:assert/strict');
  const ts=require('typescript');
  const fs=require('node:fs');
  const src=ts.transpileModule(fs.readFileSync('src/utils/dates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const m={exports:{}};new Function('exports','module','require',src)(m.exports,m,require);
  assert.equal(new Date().getTimezoneOffset(),-300,'child must run at UTC+5');
  // 00:30 local on 10 Sep is 19:30 UTC on 9 Sep — the exact window that was wrong.
  const justAfterMidnight=new Date(2026,8,10,0,30,0);
  assert.equal(m.exports.localDate(justAfterMidnight),'2026-09-10');
  assert.equal(justAfterMidnight.toISOString().split('T')[0],'2026-09-09','fixture must reproduce the UTC skew');
  assert.equal(m.exports.localDate(new Date(2026,8,10,23,59,0)),'2026-09-10');
  // Round-trip and tolerance
  assert.equal(m.exports.toDateValue('2026-09-10T18:00:00.000Z'),'2026-09-10','legacy timestamp keeps its local day');
  assert.equal(m.exports.toDateValue('2026-99-99'),null);
  assert.equal(m.exports.isValidDateValue('2026-02-30'),false,'rolled-over dates must be rejected');
  assert.equal(m.exports.isValidDateValue('2026-02-28'),true);
  console.log('OK');`);
 assert.equal(out,'OK');
});

check(38,'an entry saved just after local midnight is in TODAY\'s Day Book',at('src/services/database/cashbookDb.ts','getTodayCashEntries'),()=>{
 const out=inKarachi(`
  const assert=require('node:assert/strict');
  const {harness}=require('./tests/regression-harness.cjs');
  (async()=>{
   assert.equal(new Date().getTimezoneOffset(),-300,'child must run at UTC+5');
   const h=harness();
   try{
    await h.boot();
    h.insert('users',{id:'owner',name:'owner',role:'admin',parentId:null,account_level:'admin',phone:'03001',businessName:'B',passwordHash:'x'});
    h.login('owner');
    const cash=h.load('src/services/database/cashbookDb.ts');
    const dates=h.load('src/utils/dates.ts');
    // Save with the screen default — i.e. whatever the app calls "today".
    await cash.createCashEntry('owner','Midnight sale',50000,'in',dates.todayDate());
    const today=await cash.getDayBook('owner',dates.todayDate());
    assert.equal(today.entries.length,1,'entry saved today must appear in today Day Book');
    assert.equal(today.entries[0].date,dates.todayDate());
    assert.equal(today.dayTotals.cashIn,50000);
    // …and must NOT leak into the previous day.
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const prev=await cash.getDayBook('owner',dates.localDate(yesterday));
    assert.equal(prev.entries.length,0,'new day entry must not appear in the previous day');
    assert.equal(prev.dayTotals.cashIn,0);
    // Cash in Hand and the Day Book must agree about the same entry.
    const summary=await cash.getCashBalanceSummary('owner');
    assert.equal(summary.cashIn,50000);
   } finally { h.dispose(); }
   console.log('OK');
  })().catch(e=>{console.error(e.message);process.exit(1);});`);
 assert.equal(out,'OK');
});

check(39,'reads tolerate legacy malformed and timestamp dates without crashing',at('src/utils/calculations.ts','formatDate'),()=>isolated(async h=>{
 const {formatDate}=calc(h);
 assert.equal(formatDate('2026-99-99'),'2026-99-99','malformed value shown as-is, never "Invalid Date"');
 assert.equal(formatDate(''),'—');
 assert.ok(/2026/.test(formatDate('2026-09-10')));
 assert.ok(/2026/.test(formatDate('2026-09-10T18:00:00.000Z')),'legacy timestamp still renders');
 // A legacy row with a broken date must not break the book that lists it.
 seedPeople(h);
 h.insert('transactions',{id:'legacy_bad',userId:'owner',partyName:'P',amount_paisa:1000,type:'lena',date:'2026-99-99'});
 h.insert('transactions',{id:'legacy_ts',userId:'owner',partyName:'P',amount_paisa:1000,type:'lena',date:'2026-09-10T18:00:00.000Z'});
 const rows=await khata(h).getTransactionsByUserId('owner',50,0);
 assert.ok(rows.length>=2);
 for(const r of rows)assert.equal(typeof formatDate(r.date),'string');
}));

check(40,'no hand-typed date entry remains, and every date column is written YYYY-MM-DD','date picker rollout',()=>{
 const live=sourceFiles().filter(p=>!/CashInModal|CashOutModal/.test(p));
 for(const file of live){
  const text=fs.readFileSync(file,'utf8');
  assert.ok(!/placeholder="YYYY-MM-DD"/.test(text),'hand-typed date input still present: '+file);
  assert.ok(!/\b(date|due_date|bill_date|expense_date|payment_date|joining_date|order_date|invoice_date|return_date|expected_date)\s*:\s*[^,\n]*toISOString\(\)\s*[,\n]/.test(text),
   'a date column is still written as a full timestamp: '+file);
 }
 // Every date surface goes through the ONE shared component. Asserted as a named set
 // rather than a count, so adding a date field is a deliberate, visible change here.
 const users=sorted(live.filter(p=>/<DateField/.test(fs.readFileSync(p,'utf8')))
  .map(p=>path.relative(root,p).replace(/\\/g,'/')));
 assert.deepEqual(users,sorted([
  'src/components/ui/DateRangeFilter.tsx',          // the shared from–to control
  'src/screens/BillBook/CreateNewBillModal.tsx',
  'src/screens/CashBook/CashBookScreen.tsx',        // day navigator (Prompt 13)
  'src/screens/CashBook/CashEntryModal.tsx',
  'src/screens/ExpenseBook/AddExpenseModal.tsx',
  'src/screens/PurchaseBook/CreatePurchaseInvoiceModal.tsx',
  'src/screens/PurchaseBook/CreatePurchaseOrderModal.tsx',
  'src/screens/PurchaseBook/PurchaseReturnModal.tsx',
  'src/screens/StaffBook/AddStaffModal.tsx',
  'src/screens/StaffBook/StaffSalaryDetailScreen.tsx',
  'src/screens/StockBook/AddSupplierPaymentModal.tsx',
  'src/screens/StockBook/StockItemDetailScreen.tsx',
  'src/screens/reminders/AddReminderScreen.tsx',
  'src/screens/staff/AddTransactionScreen.tsx',
  'src/screens/staff/EditTransactionScreen.tsx',
 ]));
 assert.ok(/react-native-community\/datetimepicker/.test(read('src/components/ui/DateField.tsx')));
 // todayDate must be local everywhere; no UTC derivation outside the dead files.
 for(const file of live)assert.ok(!/toISOString\(\)\.split\('T'\)\[0\]/.test(fs.readFileSync(file,'utf8').replace(/^\s*\*.*$/gm,'')),
  'UTC date derivation still present: '+file);
});

function seedKhataRange(h) {
 seedPeople(h);
 const rows=[];
 for(const who of ['owner','staffA','subA','staffB','subB','otherOwner','otherStaff']) {
  for(let i=0;i<65;i++) {
   const row={id:`range_${who}_${i}`,userId:who,partyName:i%2?'Other':'Needle customer',
    notes:i%2?'needle note':null,amount_paisa:10001+i,type:i%3?'lena':'dena',
    date:i===0?'2026-08-31':i===64?'2026-10-01':i===1?'2026-09-01':'2026-09-30',isDeleted:i===2?1:0};
   h.insert('transactions',row);rows.push(row);
  }
 }
 return rows;
}
const expectedKhata=(rows,scope,f)=>rows.filter(r=>scope.includes(r.userId)&&!r.isDeleted&&
 (!f.startDate||r.date>=f.startDate)&&(!f.endDate||r.date<=f.endDate)&&
 (!f.type||f.type==='all'||r.type===f.type)&&
 (!f.search||(r.partyName+' '+(r.notes||'')).toLowerCase().includes(f.search.toLowerCase())));
function assertKhataSummary(actual,rows) {
 const lena=rows.filter(r=>r.type==='lena').reduce((s,r)=>s+r.amount_paisa,0);
 const dena=rows.filter(r=>r.type==='dena').reduce((s,r)=>s+r.amount_paisa,0);
 assert.deepEqual(plain(actual),{totalLena:lena,totalDena:dena,netBalance:lena-dena});
}
check(41,'Khata SQL range/type/search rows and totals preserve every hierarchy combination',at('src/services/database/transactionDb.ts','getFilteredKhata'),()=>isolated(async h=>{
 const rows=seedKhataRange(h);
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']],['subA',['subA']]]) {
  for(const range of [{},{startDate:'2026-09-01',endDate:'2026-09-30'},{startDate:'2026-09-30',endDate:'2026-09-30'},{startDate:'2026-10-01'},{endDate:'2026-08-31'}]) {
   for(const type of ['all','lena','dena']) for(const search of ['', 'NEEDLE','needle note','absent']) {
    const filter={...range,type,search},expected=expectedKhata(rows,scope,filter);
    const result=await khata(h).getFilteredKhata(viewer,filter);
    assert.deepEqual(ids(result.transactions),ids(expected));assertKhataSummary(result.balanceSummary,expected);
   }
  }
 }
}));
check(42,'Khata aggregate includes matches beyond 50 rows; uncapped screen query returns all',at('src/services/database/transactionDb.ts','getFilteredKhata'),()=>isolated(async h=>{
 const rows=seedKhataRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',search:'needle',type:'all'};
 const expected=expectedKhata(rows,['staffA','subA'],filter);assert.ok(expected.length>100);
 const first=await khata(h).getFilteredKhata('staffA',filter,50,0);
 const second=await khata(h).getFilteredKhata('staffA',filter,50,50);
 assert.equal(first.transactions.length,50);assert.equal(second.transactions.length,50);
 assert.equal(new Set([...first.transactions,...second.transactions].map(r=>r.id)).size,100);
 assertKhataSummary(first.balanceSummary,expected);assertKhataSummary(second.balanceSummary,expected);
 const all=await khata(h).getFilteredKhata('staffA',filter);assert.deepEqual(ids(all.transactions),ids(expected));
 assert.ok(!read('src/screens/staff/KhataScreen.tsx').includes('transactions.filter('));
}));
check(43,'Khata rejects invalid ranges and treats search punctuation literally',at('src/services/database/transactionDb.ts','getFilteredKhata'),()=>isolated(async h=>{
 seedPeople(h);h.insert('transactions',{id:'literal',userId:'subA',partyName:"100%_O'Brien",amount_paisa:123456,date:'2026-09-10',type:'lena'});
 for(const search of ['%', '_', "O'Brien"]) {
  const result=await khata(h).getFilteredKhata('owner',{search});assert.deepEqual(ids(result.transactions),['literal']);
 }
 const empty=await khata(h).getFilteredKhata('owner',{search:"' OR 1=1 --"});assert.deepEqual(ids(empty.transactions),[]);assertKhataSummary(empty.balanceSummary,[]);
 for(const range of [{startDate:'2026-02-30'},{startDate:'bad'},{startDate:'2026-09-30',endDate:'2026-09-01'}])
  await assert.rejects(()=>khata(h).getFilteredKhata('owner',range),/date/i);
}));
check(44,'Khata range keeps removed users history visible but excludes deleted entries',at('src/services/database/transactionDb.ts','getFilteredKhata'),()=>isolated(async h=>{
 const rows=seedKhataRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',type:'lena',search:'needle'};
 h.sqlite.exec("UPDATE users SET is_deleted=1,deleted_at='2026-09-10' WHERE id='subA'");
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']]]) {
  const result=await khata(h).getFilteredKhata(viewer,filter),expected=expectedKhata(rows,scope,filter);
  assert.deepEqual(ids(result.transactions),ids(expected));assertKhataSummary(result.balanceSummary,expected);
  assert.ok(result.transactions.some(r=>r.userId==='subA'));
 }
}));

function seedCashRange(h) {
 seedPeople(h);
 const rows=[];
 for(const who of ['owner','staffA','subA','staffB','subB','otherOwner','otherStaff']) {
  for(let i=0;i<605;i++) {
   const row={id:`range_${who}_${i}`,userId:who,description:i%20?'Needle cash':'Other',
    note:'note-only-token',category:'category-only-token',amount_paisa:10001+i,direction:i%3?'in':'out',
    date:i===0?'2026-08-31':i===604?'2026-10-01':i===1?'2026-09-01':'2026-09-30',isDeleted:i===2?1:0};
   h.insert('cashbook',row);rows.push(row);
  }
 }
 return rows;
}
const expectedCash=(rows,scope,f)=>rows.filter(r=>scope.includes(r.userId)&&!r.isDeleted&&
 (!f.startDate||r.date>=f.startDate)&&(!f.endDate||r.date<=f.endDate)&&
 (!f.direction||f.direction==='all'||r.direction===f.direction)&&
 (!f.search||r.description.toLowerCase().includes(f.search.trim().toLowerCase())));
function assertCashSummary(actual,rows) {
 const lena=rows.filter(r=>r.direction==='in').reduce((s,r)=>s+r.amount_paisa,0);
 const dena=rows.filter(r=>r.direction==='out').reduce((s,r)=>s+r.amount_paisa,0);
 assert.deepEqual(plain(actual),{cashIn:lena,cashOut:dena,cashBalance:lena-dena});
}
check(45,'Cash History SQL range/direction/search rows and totals preserve every hierarchy combination',at('src/services/database/cashbookDb.ts','getFilteredCashHistory'),()=>isolated(async h=>{
 const rows=seedCashRange(h);
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']],['subA',['subA']]]) {
  for(const range of [{},{startDate:'2026-09-01',endDate:'2026-09-30'},{startDate:'2026-09-30',endDate:'2026-09-30'},{startDate:'2026-10-01'},{endDate:'2026-08-31'}]) {
   for(const direction of ['all','in','out']) for(const search of ['', 'NEEDLE','needle note','absent']) {
    const filter={...range,direction,search},expected=expectedCash(rows,scope,filter);
    const result=await cash(h).getFilteredCashHistory(viewer,filter);
    assert.deepEqual(ids(result.entries),ids(expected));assertCashSummary(result.cashSummary,expected);
   }
  }
 }
}));
check(46,'Cash History aggregate includes matches beyond 500 rows; uncapped screen query returns all',at('src/services/database/cashbookDb.ts','getFilteredCashHistory'),()=>isolated(async h=>{
 const rows=seedCashRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',search:'needle',direction:'all'};
 const expected=expectedCash(rows,['staffA','subA'],filter);assert.ok(expected.length>500);
 const first=await cash(h).getFilteredCashHistory('staffA',filter,500,0);
 const second=await cash(h).getFilteredCashHistory('staffA',filter,500,500);
 assert.equal(first.entries.length,500);assert.equal(second.entries.length,500);
 assert.equal(new Set([...first.entries,...second.entries].map(r=>r.id)).size,1000);
 assertCashSummary(first.cashSummary,expected);assertCashSummary(second.cashSummary,expected);
 const all=await cash(h).getFilteredCashHistory('staffA',filter);assert.deepEqual(ids(all.entries),ids(expected));
 assert.ok(!/\.filter\(|\.reduce\(/.test(read('src/screens/CashBook/CashHistory.tsx')));
}));
check(47,'Cash History rejects invalid ranges and treats search punctuation literally',at('src/services/database/cashbookDb.ts','getFilteredCashHistory'),()=>isolated(async h=>{
 seedPeople(h);h.insert('cashbook',{id:'literal',userId:'subA',description:"100%_O'Brien",note:'note-only-token',category:'category-only-token',amount_paisa:123456,date:'2026-09-10',direction:'in'});
 for(const search of ['%', '_', "O'Brien"]) {
  const result=await cash(h).getFilteredCashHistory('owner',{search});assert.deepEqual(ids(result.entries),['literal']);
 }
 for(const search of ['note-only-token','category-only-token']) {
  const absent=await cash(h).getFilteredCashHistory('owner',{search});assert.equal(absent.entries.length,0);
 }
 const empty=await cash(h).getFilteredCashHistory('owner',{search:"' OR 1=1 --"});assert.deepEqual(ids(empty.entries),[]);assertCashSummary(empty.cashSummary,[]);
 for(const range of [{startDate:'2026-02-30'},{startDate:'bad'},{startDate:'2026-09-30',endDate:'2026-09-01'}])
  await assert.rejects(()=>cash(h).getFilteredCashHistory('owner',range),/date/i);
}));
check(48,'Cash History range keeps removed users history visible but excludes deleted entries',at('src/services/database/cashbookDb.ts','getFilteredCashHistory'),()=>isolated(async h=>{
 const rows=seedCashRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',direction:'in',search:'needle'};
 h.sqlite.exec("UPDATE users SET is_deleted=1,deleted_at='2026-09-10' WHERE id='subA'");
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']]]) {
  const result=await cash(h).getFilteredCashHistory(viewer,filter),expected=expectedCash(rows,scope,filter);
  assert.deepEqual(ids(result.entries),ids(expected));assertCashSummary(result.cashSummary,expected);
  assert.ok(result.entries.some(r=>r.userId==='subA'));
 }
}));

// ── Expense range filtering ───────────────────────────────────────────────────
const expenseDb=h=>h.load('src/services/database/expenseDb.ts');
function seedExpenseRange(h) {
 seedPeople(h);
 const rows=[];
 for(const who of ['owner','staffA','subA','staffB','subB','otherOwner','otherStaff']) {
  for(let i=0;i<120;i++) {
   const row={id:`exp_${who}_${i}`,user_id:who,description:i%20?'Needle expense':'Other',
    note:'note-only-token',category:i%4?'Rent':'Fuel',amount:10001+i,
    expense_date:i===0?'2026-08-31':i===119?'2026-10-01':i===1?'2026-09-01':'2026-09-30',is_deleted:i===2?1:0};
   h.insert('expenses',row);rows.push(row);
  }
 }
 return rows;
}
const expectedExpense=(rows,scope,f)=>rows.filter(r=>scope.includes(r.user_id)&&!r.is_deleted&&
 (!f.startDate||r.expense_date>=f.startDate)&&(!f.endDate||r.expense_date<=f.endDate)&&
 (!f.category||!f.category.trim()||r.category===f.category.trim())&&
 (!f.search||!f.search.trim()||[r.description,r.note,r.category].some(v=>(v||'').toLowerCase().includes(f.search.trim().toLowerCase()))));
const assertExpenseSummary=(actual,rows)=>assert.deepEqual(plain(actual),
 {totalExpense:rows.reduce((s,r)=>s+r.amount,0)});

check(49,'Expense SQL range/category/search rows and totals preserve every hierarchy combination',at('src/services/database/expenseDb.ts','getFilteredExpenses'),()=>isolated(async h=>{
 const rows=seedExpenseRange(h);
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']],['subA',['subA']]]) {
  for(const range of [{},{startDate:'2026-09-01',endDate:'2026-09-30'},{startDate:'2026-09-30',endDate:'2026-09-30'},{startDate:'2026-10-01'},{endDate:'2026-08-31'}]) {
   for(const category of ['','Rent','Fuel']) for(const search of ['','Needle','note-only-token','absent']) {
    const filter={...range,category,search},expected=expectedExpense(rows,scope,filter);
    const result=await expenseDb(h).getFilteredExpenses(viewer,filter);
    assert.deepEqual(ids(result.expenses),ids(expected));assertExpenseSummary(result.expenseSummary,expected);
   }
  }
 }
}));

check(50,'Expense total sums the whole filtered set, not the loaded page',at('src/services/database/expenseDb.ts','getFilteredExpenses'),()=>isolated(async h=>{
 const rows=seedExpenseRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',search:'Needle'};
 const expected=expectedExpense(rows,['staffA','subA'],filter);assert.ok(expected.length>100,'fixture must exceed any page size');
 const first=await expenseDb(h).getFilteredExpenses('staffA',filter,50,0);
 const second=await expenseDb(h).getFilteredExpenses('staffA',filter,50,50);
 assert.equal(first.expenses.length,50);assert.equal(second.expenses.length,50);
 assert.equal(new Set([...first.expenses,...second.expenses].map(r=>r.id)).size,100);
 // Both pages report the SAME whole-set total — the paginated-array bug, asserted directly.
 assertExpenseSummary(first.expenseSummary,expected);assertExpenseSummary(second.expenseSummary,expected);
 const all=await expenseDb(h).getFilteredExpenses('staffA',filter);assert.deepEqual(ids(all.expenses),ids(expected));
 // Paisa: the total must be the integer sum, and render without double conversion.
 const paisa=expected.reduce((s,r)=>s+r.amount,0);
 assert.ok(Number.isSafeInteger(paisa));
 assert.equal(calc(h).formatCurrency(paisa),calc(h).formatCurrency(all.expenseSummary.totalExpense));
 // No in-memory narrowing left on the screen or in the store.
 assert.ok(!read('src/screens/ExpenseBook/ExpenseBookScreen.tsx').includes('expenses.filter('));
 assert.ok(!/expenses\.reduce\(/.test(read('src/store/useExpenseStore.ts')),'store must not sum a page in memory');
}));

check(51,'Expense rejects invalid ranges, both boundaries inclusive, search literal',at('src/services/database/expenseDb.ts','getFilteredExpenses'),()=>isolated(async h=>{
 seedPeople(h);
 h.insert('expenses',{id:'lo',user_id:'subA',description:'edge low',amount:100,expense_date:'2026-09-01'});
 h.insert('expenses',{id:'hi',user_id:'subA',description:'edge high',amount:200,expense_date:'2026-09-30'});
 h.insert('expenses',{id:'literal',user_id:'subA',description:"100%_O'Brien",amount:300,expense_date:'2026-09-15'});
 // Both boundary days are INSIDE the range.
 const inRange=await expenseDb(h).getFilteredExpenses('owner',{startDate:'2026-09-01',endDate:'2026-09-30'});
 assert.deepEqual(ids(inRange.expenses),ids([{id:'lo'},{id:'hi'},{id:'literal'}]));
 assert.equal(inRange.expenseSummary.totalExpense,600);
 for(const search of ['%','_',"O'Brien"]) {
  const r=await expenseDb(h).getFilteredExpenses('owner',{search});assert.deepEqual(ids(r.expenses),['literal']);
 }
 const none=await expenseDb(h).getFilteredExpenses('owner',{search:"' OR 1=1 --"});
 assert.deepEqual(ids(none.expenses),[]);assertExpenseSummary(none.expenseSummary,[]);
 for(const range of [{startDate:'2026-02-30'},{startDate:'bad'},{startDate:'2026-09-30',endDate:'2026-09-01'}])
  await assert.rejects(expenseDb(h).getFilteredExpenses('owner',range));
}));

check(52,'previous months are reachable and the month cursor is gone',at('src/store/useExpenseStore.ts','filter'),()=>isolated(async h=>{
 seedPeople(h);
 h.insert('expenses',{id:'july',user_id:'subA',description:'July rent',amount:5000,expense_date:'2026-07-15'});
 h.insert('expenses',{id:'sept',user_id:'subA',description:'Sept rent',amount:7000,expense_date:'2026-09-15'});
 // The month-lock regression: an older month must be selectable and total correctly.
 const july=await expenseDb(h).getFilteredExpenses('owner',{startDate:'2026-07-01',endDate:'2026-07-31'});
 assert.deepEqual(ids(july.expenses),['july']);assert.equal(july.expenseSummary.totalExpense,5000);
 const sept=await expenseDb(h).getFilteredExpenses('owner',{startDate:'2026-09-01',endDate:'2026-09-30'});
 assert.deepEqual(ids(sept.expenses),['sept']);assert.equal(sept.expenseSummary.totalExpense,7000);
 const both=await expenseDb(h).getFilteredExpenses('owner',{});
 assert.deepEqual(ids(both.expenses),['july','sept']);assert.equal(both.expenseSummary.totalExpense,12000);
 // The never-called month cursor is removed, and the screen mounts the shared control.
 const store=read('src/store/useExpenseStore.ts');
 assert.ok(!/setMonth/.test(store.replace(/^\s*\/\/.*$/gm,'')),'setMonth must be gone');
 assert.ok(!/currentDate/.test(store.replace(/^\s*\/\/.*$/gm,'')),'currentDate cursor must be gone');
 assert.ok(read('src/screens/ExpenseBook/ExpenseBookScreen.tsx').includes('<DateRangeFilter'));
 // Month helpers that the dashboard still uses must derive the LOCAL month.
 assert.ok(!/toISOString\(\)\.substring\(0, 7\)/.test(read('src/services/database/expenseDb.ts')));
}));

check(53,'Expense range keeps removed users history visible but excludes deleted rows',at('src/services/database/expenseDb.ts','getFilteredExpenses'),()=>isolated(async h=>{
 const rows=seedExpenseRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',search:'Needle'};
 h.sqlite.exec("UPDATE users SET is_deleted=1,deleted_at='2026-09-10' WHERE id='subA'");
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']]]) {
  const result=await expenseDb(h).getFilteredExpenses(viewer,filter),expected=expectedExpense(rows,scope,filter);
  assert.deepEqual(ids(result.expenses),ids(expected));assertExpenseSummary(result.expenseSummary,expected);
  assert.ok(result.expenses.some(r=>r.user_id==='subA'),'removed staff history stays visible');
 }
}));

// ── Bill Book range filtering ─────────────────────────────────────────────────
const billDb=h=>h.load('src/services/database/billDb.ts');
function seedBillRange(h) {
 seedPeople(h);
 const rows=[];
 for(const who of ['owner','staffA','subA','staffB','subB','otherOwner','otherStaff']) {
  for(let i=0;i<120;i++) {
   const row={id:`bill_${who}_${i}`,user_id:who,party_name:i%20?'Needle Traders':'Other Co',
    party_phone:'03001234567',bill_no:1000+i,customer_id:'walk_in',status:'unpaid',
    total:10001+i,paid:1,due:10000+i,
    bill_date:i===0?'2026-08-31':i===119?'2026-10-01':i===1?'2026-09-01':'2026-09-30',
    is_draft:i===3?1:0,is_hold:i===4?1:0,is_deleted:i===2?1:0};
   h.insert('bills',row);rows.push(row);
  }
 }
 return rows;
}
const expectedBills=(rows,scope,f)=>rows.filter(r=>scope.includes(r.user_id)&&!r.is_deleted&&
 (!f.startDate||r.bill_date>=f.startDate)&&(!f.endDate||r.bill_date<=f.endDate)&&
 (!f.status||f.status==='all'
   ||(f.status==='drafts'&&r.is_draft===1)
   ||(f.status==='holds'&&r.is_hold===1)
   ||(f.status==='posted'&&r.is_draft!==1&&r.is_hold!==1))&&
 (!f.search||!f.search.trim()||[r.party_name,r.party_phone,String(r.bill_no)]
   .some(v=>(v||'').toLowerCase().includes(f.search.trim().toLowerCase()))));
function assertBillSummary(actual,rows) {
 assert.deepEqual(plain(actual),{
  billCount:rows.length,
  totalBilled:rows.reduce((s,r)=>s+r.total,0),
  totalPaid:rows.reduce((s,r)=>s+r.paid,0),
  totalDue:rows.reduce((s,r)=>s+r.due,0),
 });
}

check(54,'Bill SQL range/status/search rows and totals preserve every hierarchy combination',at('src/services/database/billDb.ts','getFilteredBills'),()=>isolated(async h=>{
 const rows=seedBillRange(h);
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']],['subA',['subA']]]) {
  for(const range of [{},{startDate:'2026-09-01',endDate:'2026-09-30'},{startDate:'2026-09-30',endDate:'2026-09-30'},{startDate:'2026-10-01'},{endDate:'2026-08-31'}]) {
   for(const status of ['all','posted','drafts','holds']) for(const search of ['','Needle','03001234567','absent']) {
    const filter={...range,status,search},expected=expectedBills(rows,scope,filter);
    const result=await billDb(h).getFilteredBills(viewer,filter);
    assert.deepEqual(ids(result.bills),ids(expected));assertBillSummary(result.billSummary,expected);
   }
  }
 }
}));

check(55,'LAST MONTH bills are reachable and both boundaries are inclusive',at('src/services/database/billDb.ts','getFilteredBills'),()=>isolated(async h=>{
 seedPeople(h);
 const mk=(id,date,total)=>h.insert('bills',{id,user_id:'subA',party_name:'P',bill_no:1,customer_id:'c',
  status:'unpaid',total,paid:0,due:total,bill_date:date,is_draft:0,is_hold:0});
 mk('aug01','2026-08-01',10000);mk('aug31','2026-08-31',20000);mk('sep15','2026-09-15',30000);
 // The core regression: a PREVIOUS month must be selectable, with its own total.
 const august=await billDb(h).getFilteredBills('owner',{startDate:'2026-08-01',endDate:'2026-08-31',status:'posted'});
 assert.deepEqual(ids(august.bills),['aug01','aug31'],'last month must be reachable');
 assert.equal(august.billSummary.totalBilled,30000);assert.equal(august.billSummary.billCount,2);
 // Both boundary days are INSIDE the range (aug01 and aug31 above prove it).
 const sept=await billDb(h).getFilteredBills('owner',{startDate:'2026-09-01',endDate:'2026-09-30',status:'posted'});
 assert.deepEqual(ids(sept.bills),['sep15']);assert.equal(sept.billSummary.totalBilled,30000);
 const all=await billDb(h).getFilteredBills('owner',{status:'posted'});
 assert.deepEqual(ids(all.bills),['aug01','aug31','sep15']);assert.equal(all.billSummary.totalBilled,60000);
 // The fake hardcoded date boxes are gone and the real control is mounted.
 const screen=read('src/screens/BillBook/BillBookScreen.tsx');
 assert.ok(!/1 Jun, 2026|30 Jun, 2026/.test(screen),'hardcoded fake dates must be gone');
 assert.ok(screen.includes('<DateRangeFilter'));
 assert.ok(!/bills\.filter\(/.test(screen),'status must be filtered in SQL, not in memory');
 const store=read('src/store/useBillStore.ts');
 assert.ok(!/setDateRange|selectedDateRange/.test(store),'the never-called range setter must be gone');
}));

check(56,'Bill headline sums the whole filtered set, not the loaded page',at('src/services/database/billDb.ts','getFilteredBills'),()=>isolated(async h=>{
 const rows=seedBillRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',status:'posted',search:'Needle'};
 const expected=expectedBills(rows,['staffA','subA'],filter);assert.ok(expected.length>100,'fixture must exceed any page size');
 const first=await billDb(h).getFilteredBills('staffA',filter,50,0);
 const second=await billDb(h).getFilteredBills('staffA',filter,50,50);
 assert.equal(first.bills.length,50);assert.equal(second.bills.length,50);
 assert.equal(new Set([...first.bills,...second.bills].map(r=>r.id)).size,100);
 // Both pages report the SAME whole-set totals.
 assertBillSummary(first.billSummary,expected);assertBillSummary(second.billSummary,expected);
 const all=await billDb(h).getFilteredBills('staffA',filter);assert.deepEqual(ids(all.bills),ids(expected));
 // Paisa: integer totals that render identically to an independent sum.
 const paisa=expected.reduce((s,r)=>s+r.total,0);
 assert.ok(Number.isSafeInteger(paisa));
 assert.equal(calc(h).formatCurrency(paisa),calc(h).formatCurrency(all.billSummary.totalBilled));
}));

check(57,'a backdated bill is reported, never optimistically shown in a range it is not in',at('src/store/useBillStore.ts','addBill'),()=>isolated(async h=>{
 seedPeople(h);
 const { billMatchesFilter }=billDb(h);
 const sept={bill_date:'2026-09-15',is_draft:0,is_hold:0},aug={bill_date:'2026-08-15',is_draft:0,is_hold:0};
 const septFilter={startDate:'2026-09-01',endDate:'2026-09-30',status:'posted'};
 assert.equal(billMatchesFilter(sept,septFilter),true);
 assert.equal(billMatchesFilter(aug,septFilter),false,'a backdated bill must be reported as out of range');
 assert.equal(billMatchesFilter({bill_date:'2026-09-15',is_draft:1,is_hold:0},septFilter),false);
 assert.equal(billMatchesFilter(aug,{}),true,'with no range everything is in view');
 assert.equal(billMatchesFilter({bill_date:'not-a-date',is_draft:0,is_hold:0},{}),false);
 // The store re-reads instead of prepending, so list and totals always agree.
 const store=read('src/store/useBillStore.ts');
 assert.ok(!/bills:\s*\[newBill/.test(store),'optimistic prepend must be gone');
 assert.ok(/inActiveFilter/.test(store)&&/await get\(\)\.fetchBills/.test(store));
 assert.ok(read('src/screens/BillBook/CreateNewBillModal.tsx').includes('inActiveFilter'),'the save screen must tell the user');
}));

check(58,'Bill range keeps removed users history visible but excludes deleted bills',at('src/services/database/billDb.ts','getFilteredBills'),()=>isolated(async h=>{
 const rows=seedBillRange(h),filter={startDate:'2026-09-01',endDate:'2026-09-30',status:'posted',search:'Needle'};
 h.sqlite.exec("UPDATE users SET is_deleted=1,deleted_at='2026-09-10' WHERE id='subA'");
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']]]) {
  const result=await billDb(h).getFilteredBills(viewer,filter),expected=expectedBills(rows,scope,filter);
  assert.deepEqual(ids(result.bills),ids(expected));assertBillSummary(result.billSummary,expected);
  assert.ok(result.bills.some(r=>r.user_id==='subA'),'removed staff history stays visible');
 }
 // A soft-deleted bill is excluded from both rows and totals.
 assert.ok(rows.some(r=>r.is_deleted));
 const all=await billDb(h).getFilteredBills('owner',{});
 assert.ok(!all.bills.some(r=>r.id.endsWith('_2')),'deleted bills excluded');
}));

// ── Day Book (Part A: the day view) ───────────────────────────────────────────
function seedDays(h) {
 seedPeople(h);
 const rows=[];
 // Three days across the whole tree, so per-day totals and scoping are both testable.
 for(const who of ['owner','staffA','subA','staffB','subB','otherOwner','otherStaff']) {
  for(const [i,day] of ['2026-09-10','2026-09-11','2026-09-12'].entries()) {
   const inRow={id:`d_${who}_${day}_in`,userId:who,description:'In '+day,amount_paisa:10000+i,direction:'in',date:day,isDeleted:0};
   const outRow={id:`d_${who}_${day}_out`,userId:who,description:'Out '+day,amount_paisa:2000+i,direction:'out',date:day,isDeleted:0};
   h.insert('cashbook',inRow);h.insert('cashbook',outRow);rows.push(inRow,outRow);
  }
  // A deleted row must never appear in a day or its totals.
  const gone={id:`d_${who}_deleted`,userId:who,description:'Deleted',amount_paisa:999999,direction:'in',date:'2026-09-11',isDeleted:1};
  h.insert('cashbook',gone);rows.push(gone);
 }
 return rows;
}
const expectedDay=(rows,scope,day)=>rows.filter(r=>scope.includes(r.userId)&&!r.isDeleted&&r.date===day);
function assertDayTotals(actual,rows) {
 const cashIn=rows.filter(r=>r.direction==='in').reduce((s,r)=>s+r.amount_paisa,0);
 const cashOut=rows.filter(r=>r.direction==='out').reduce((s,r)=>s+r.amount_paisa,0);
 assert.deepEqual(plain(actual),{cashIn,cashOut,net:cashIn-cashOut,entryCount:rows.length});
}

check(59,'any past day returns exactly that day under hierarchy scoping, with SQL totals',at('src/services/database/cashbookDb.ts','getDayBook'),()=>isolated(async h=>{
 const rows=seedDays(h);
 for(const [viewer,scope] of [['owner',['owner','staffA','subA','staffB','subB']],['staffA',['staffA','subA']],['subA',['subA']],['otherOwner',['otherOwner','otherStaff']]]) {
  for(const day of ['2026-09-10','2026-09-11','2026-09-12','2026-09-13']) {
   const expected=expectedDay(rows,scope,day);
   const result=await cash(h).getDayBook(viewer,day);
   assert.deepEqual(ids(result.entries),ids(expected),viewer+' on '+day);
   assertDayTotals(result.dayTotals,expected);
   // Past days must never be empty just because they are past.
   if(day!=='2026-09-13')assert.ok(expected.length>0&&result.entries.length>0);
  }
 }
 // An owner's day total now INCLUDES staff — previously it was userId-only.
 const ownerDay=await cash(h).getDayBook('owner','2026-09-11');
 const soloDay=await cash(h).getDayBook('subA','2026-09-11');
 assert.ok(ownerDay.dayTotals.cashIn>soloDay.dayTotals.cashIn,'owner day must aggregate the tree');
}));

check(60,'Cash in Hand stays all-time while day totals are per-day; rollover hides nothing',at('src/services/database/cashbookDb.ts','getDayBook'),()=>isolated(async h=>{
 const rows=seedDays(h);
 const allTime=await cash(h).getCashBalanceSummary('owner');
 const scope=['owner','staffA','subA','staffB','subB'];
 const everyDay=rows.filter(r=>scope.includes(r.userId)&&!r.isDeleted);
 const expectIn=everyDay.filter(r=>r.direction==='in').reduce((s,r)=>s+r.amount_paisa,0);
 assert.equal(allTime.cashIn,expectIn,'Cash in Hand must remain the all-time running figure');
 // Each day is a strict subset, and the days sum back to the all-time figure.
 let summed=0;
 for(const day of ['2026-09-10','2026-09-11','2026-09-12']) {
  const d=await cash(h).getDayBook('owner',day);
  assert.ok(d.dayTotals.cashIn<allTime.cashIn,'a single day must be less than all time');
  summed+=d.dayTotals.cashIn;
 }
 assert.equal(summed,allTime.cashIn,'days must account for the whole all-time total — nothing lost to rollover');
 // Every seeded row is still physically present: a day view filters, it never removes.
 assert.equal(h.one('SELECT COUNT(*) AS n FROM cashbook').n,rows.length);
}));

check(61,'day predicate matches legacy timestamp rows and rejects invalid dates',at('src/services/database/cashbookDb.ts','getDayBook'),()=>isolated(async h=>{
 seedPeople(h);
 // Pre-unification rows could hold a full timestamp; exact string equality missed them.
 h.insert('cashbook',{id:'legacy_ts',userId:'subA',description:'Legacy',amount_paisa:7000,direction:'in',date:'2026-09-11T18:30:00.000Z',isDeleted:0});
 h.insert('cashbook',{id:'plain',userId:'subA',description:'Plain',amount_paisa:3000,direction:'in',date:'2026-09-11',isDeleted:0});
 const day=await cash(h).getDayBook('owner','2026-09-11');
 assert.deepEqual(ids(day.entries),['legacy_ts','plain'],'a legacy timestamp row must still match its calendar day');
 assert.equal(day.dayTotals.cashIn,10000);
 for(const bad of ['2026-99-99','2026-02-30','not-a-date','2026-9-1',''])
  await assert.rejects(cash(h).getDayBook('owner',bad),/Invalid date/);
 // The removed helper is gone and the screen no longer sums in JS.
 assert.ok(!/getTodayBalance|getTodayCashEntries/.test(read('src/services/database/cashbookDb.ts')));
 const screen=read('src/screens/CashBook/CashBookScreen.tsx');
 assert.ok(!/todayEntries\.filter\([^)]*\)\.reduce/.test(screen),'day totals must come from SQL, not a JS reduce');
 assert.ok(screen.includes('getDayBook')&&screen.includes('<DateField'),'screen must use the day navigator');
}));

check(62,'the day view defaults to today, cannot browse the future, and keeps CashHistory',at('src/screens/CashBook/CashBookScreen.tsx','stepDay'),()=>{
 const screen=read('src/screens/CashBook/CashBookScreen.tsx');
 assert.ok(/useState\(todayDate\(\)\)/.test(screen),'must default to today');
 assert.ok(/if\s*\(next > today\)\s*return;/.test(screen),'must refuse future days');
 assert.ok(/maximumDate=\{new Date\(\)\}/.test(screen),'the jump picker must cap at today');
 assert.ok(/disabled=\{isToday\}/.test(screen),'next must be disabled on today');
 assert.ok(/setViewDate\(today\)/.test(screen),'a Today chip must return to today');
 // CashHistory remains the range view and is still reachable from here.
 assert.ok(screen.includes("navigation.navigate('CashHistory')"));
 const history=read('src/screens/CashBook/CashHistory.tsx');
 assert.ok(history.includes('getFilteredCashHistory')&&history.includes('DateRangeFilter'),'CashHistory stays the range view');
});

// ── Day Book (Part B: Close Day snapshots) ────────────────────────────────────
const closingDb=h=>h.load('src/services/database/dayClosingDb.ts');
const DAY='2026-09-11';
function seedClosableDay(h) {
 seedPeople(h);
 h.insert('cashbook',{id:'c1',userId:'staffA',description:'Sale',amount_paisa:50000,direction:'in',date:DAY,isDeleted:0});
 h.insert('cashbook',{id:'c2',userId:'subA',description:'Rent',amount_paisa:20000,direction:'out',date:DAY,isDeleted:0});
 h.insert('cashbook',{id:'c3',userId:'staffB',description:'Other branch',amount_paisa:99999,direction:'in',date:DAY,isDeleted:0});
}

check(63,'closing records exactly the day totals at that moment, scoped to the closer',at('src/services/database/dayClosingDb.ts','closeDay'),()=>isolated(async h=>{
 seedClosableDay(h);h.login('staffA');
 const before=await cash(h).getDayBook('staffA',DAY);
 assert.deepEqual(plain(before.dayTotals),{cashIn:50000,cashOut:20000,net:30000,entryCount:2});
 const closed=await closingDb(h).closeDay(DAY);
 assert.equal(closed.cash_in_paisa,50000);assert.equal(closed.cash_out_paisa,20000);
 assert.equal(closed.closing_balance_paisa,30000);assert.equal(closed.entry_count,2);
 assert.equal(closed.business_date,DAY);
 assert.equal(closed.closed_by,'staffA');assert.equal(closed.closed_by_name,'staffA');
 // The snapshot never includes another branch.
 assert.notEqual(closed.cash_in_paisa,149999);
 // Closing touched no entry.
 assert.equal(h.one('SELECT COUNT(*) AS n FROM cashbook').n,3);
 assert.deepEqual(ids((await cash(h).getDayBook('staffA',DAY)).entries),['c1','c2']);
}));

check(64,'a later entry leaves the snapshot untouched and surfaces the drift',at('src/services/database/dayClosingDb.ts','getDayStatus'),()=>isolated(async h=>{
 seedClosableDay(h);h.login('staffA');
 const closed=await closingDb(h).closeDay(DAY);
 let status=await closingDb(h).getDayStatus('staffA',DAY);
 assert.equal(status.drifted,false,'a freshly closed day has not drifted');
 assert.equal(status.latest.closing_balance_paisa,30000);
 // The forgotten entry a staff member records afterwards — allowed, never blocked.
 await cash(h).createCashEntry('staffA','Forgotten sale',5000,'in',DAY);
 status=await closingDb(h).getDayStatus('staffA',DAY);
 assert.equal(status.drifted,true,'adding after close must surface as drift');
 // Snapshot frozen…
 assert.equal(status.latest.closing_balance_paisa,30000);
 assert.equal(status.latest.cash_in_paisa,50000);
 assert.equal(status.latest.entry_count,2);
 // …while the live figure moved. BOTH are available; neither is silently corrected.
 assert.equal(status.current.net,35000);
 assert.equal(status.current.cashIn,55000);
 assert.equal(status.current.entryCount,3);
 // The stored row itself is byte-identical to what was written.
 const stored=h.one('SELECT * FROM day_closings WHERE id=?',closed.id);
 assert.equal(stored.closing_balance_paisa,30000);assert.equal(stored.entry_count,2);
}));

check(65,'re-closing appends a second record and closings can never be altered',at('src/services/database/dayClosingMigration.ts','day_closings_no_update'),()=>isolated(async h=>{
 seedClosableDay(h);h.login('staffA');
 const first=await closingDb(h).closeDay(DAY);
 await cash(h).createCashEntry('staffA','Late entry',5000,'in',DAY);
 const second=await closingDb(h).closeDay(DAY);
 assert.notEqual(first.id,second.id);
 const status=await closingDb(h).getDayStatus('staffA',DAY);
 assert.equal(status.closings.length,2,'re-closing must append, never overwrite');
 assert.equal(status.latest.id,second.id,'newest closing leads');
 assert.equal(status.latest.closing_balance_paisa,35000);
 assert.equal(status.closings[1].closing_balance_paisa,30000,'the earlier closing is kept');
 assert.equal(status.drifted,false,'re-closing reconciles the drift by recording it');
 // Append-only in the database itself, like entry_audit.
 assert.throws(()=>h.sqlite.exec("UPDATE day_closings SET closing_balance_paisa = 1"),/cannot be changed/);
 assert.throws(()=>h.sqlite.exec("DELETE FROM day_closings"),/cannot be deleted/);
 assert.equal(h.one('SELECT COUNT(*) AS n FROM day_closings').n,2);
}));

check(66,'an unclosed day behaves exactly as before the feature existed',at('src/services/database/dayClosingDb.ts','getDayStatus'),()=>isolated(async h=>{
 seedClosableDay(h);h.login('staffA');
 const status=await closingDb(h).getDayStatus('staffA',DAY);
 assert.equal(status.latest,null,'never closed means no snapshot');
 assert.deepEqual(status.closings,[]);
 assert.equal(status.drifted,false,'an unclosed day can never be drifted');
 assert.deepEqual(plain(status.current),{cashIn:50000,cashOut:20000,net:30000,entryCount:2});
 // Entries still add, read and total identically with nothing ever closed.
 await cash(h).createCashEntry('staffA','Normal entry',1000,'in',DAY);
 const after=await cash(h).getDayBook('staffA',DAY);
 assert.equal(after.dayTotals.cashIn,51000);assert.equal(after.entries.length,3);
 assert.equal(h.one('SELECT COUNT(*) AS n FROM day_closings').n,0,'nothing is written unless someone closes');
 // A future day cannot be closed.
 await assert.rejects(closingDb(h).closeDay('2099-01-01'),/future day/);
 for(const bad of ['2026-99-99','nope',''])await assert.rejects(closingDb(h).closeDay(bad),/Invalid date/);
}));

check(67,'owner and staff may close; sub-staff may not; closings follow branch scoping',at('src/services/database/dayClosingDb.ts','mayCloseDay'),()=>isolated(async h=>{
 seedClosableDay(h);
 const { mayCloseDay }=closingDb(h);
 assert.equal(mayCloseDay({role:'admin',account_level:'admin'}),true);
 assert.equal(mayCloseDay({role:'staff',account_level:'staff'}),true);
 assert.equal(mayCloseDay({role:'staff',account_level:'substaff'}),false,'a sub-staff does not sign the day off');

 h.login('subA');
 await assert.rejects(closingDb(h).closeDay(DAY),/Only the owner or a staff member/);
 assert.equal((await closingDb(h).getDayStatus('subA',DAY)).canClose,false);

 h.login('staffA');await closingDb(h).closeDay(DAY);
 h.login('staffB');await closingDb(h).closeDay(DAY);

 // Each closing belongs to the branch that made it; the owner sees both.
 assert.deepEqual(sorted((await closingDb(h).getDayClosings('staffA',DAY)).map(c=>c.user_id)),['staffA']);
 assert.deepEqual(sorted((await closingDb(h).getDayClosings('staffB',DAY)).map(c=>c.user_id)),['staffB']);
 assert.deepEqual(sorted((await closingDb(h).getDayClosings('owner',DAY)).map(c=>c.user_id)),['staffA','staffB']);
 assert.deepEqual(await closingDb(h).getDayClosings('otherOwner',DAY),[],'another business sees nothing');
 // A sub-staff still SEES their branch's closing even though they cannot create one.
 assert.deepEqual(sorted((await closingDb(h).getDayClosings('subA',DAY)).map(c=>c.user_id)),[]);
}));

// ── Export period selector (Prompt 14) ───────────────────────────────────────
const periodApi=h=>h.load('src/components/Download/reportPeriod.ts');
const shown=(h,d)=>h.load('src/utils/dates.ts').formatDisplayDate(d);
// "now" is fixed so the presets are deterministic regardless of the clock or TZ.
const NOW=new Date(2026,8,11,12);
// tag → calendar day. d0 today; d1 inside 7 days; d2 just outside 7 days; d3/d4 the
// month's first and last day; d5/d6 just outside the month on either side.
const DAYS={d0:'2026-09-11',d1:'2026-09-05',d2:'2026-09-04',d3:'2026-09-01',d4:'2026-09-30',d5:'2026-08-31',d6:'2026-10-01'};
const IN_PRESET={today:['d0'],week:['d0','d1'],month:['d0','d1','d2','d3','d4']};
function seedPeriods(h){
 seedPeople(h);let n=0;
 for(const who of ['owner','staffA','subA','staffB','subB','otherStaff'])for(const [tag,day] of Object.entries(DAYS)){
  const label='ROW_'+who+'_'+tag;n++;
  h.insert('cashbook',{id:'cash_'+label,userId:who,description:label,amount_paisa:100000+n,direction:n%2?'in':'out',date:day,isDeleted:0});
  h.insert('expenses',{id:'exp_'+label,user_id:who,description:label,amount:200000+n,expense_date:day});
  h.insert('bills',{id:'bill_'+label,user_id:who,party_name:label,bill_no:n,total:300000+n,paid:1000,due:299000+n,bill_date:day});
  // A draft and a hold on every day: not sales, so they must never reach a bill export.
  h.insert('bills',{id:'draft_'+label,user_id:who,party_name:'DRAFT_'+who+'_'+tag,bill_no:1000+n,total:7000000,paid:0,due:7000000,bill_date:day,is_draft:1,is_hold:0});
  h.insert('bills',{id:'hold_'+label,user_id:who,party_name:'HOLD_'+who+'_'+tag,bill_no:2000+n,total:9000000,paid:0,due:9000000,bill_date:day,is_draft:0,is_hold:1});
  h.insert('stock_items',{id:'item_'+label,user_id:who,name_en:label,purchase_price:1,sale_price:1,quantity:5});
  h.insert('stock_movements',{id:'mv_'+label,user_id:who,item_id:'item_'+label,change:n%2?2:-1,cost_per_unit:40000+n,sale_price_unit:50000+n,date:day});
 }
}
const tagsIn=text=>sorted(new Set(text.match(/ROW_[A-Za-z]+_d\d/g)||[]));
const expectTags=(whos,tags)=>sorted(whos.flatMap(w=>tags.map(t=>'ROW_'+w+'_'+t)));
const OWNER_TREE=['owner','staffA','subA','staffB','subB'];
async function exportFile(h,type,userId,period,format='pdf'){
 const before=format==='pdf'?h.html.length:h.csv.length;
 await h.load(pdf).generateReportFile({reportType:type,userId,format,...period});
 const out=format==='pdf'?h.html:h.csv;assert.equal(out.length,before+1,'no '+format+' produced');return out.at(-1);
}
async function bookFigures(h,type,who,period){
 if(type==='cash'){const r=await cash(h).getFilteredCashHistory(who,period);return {tags:tagsIn(r.entries.map(e=>e.description).join(' ')),money:[r.cashSummary.cashIn,r.cashSummary.cashOut,r.cashSummary.cashBalance]};}
 if(type==='expense'){const r=await h.load('src/services/database/expenseDb.ts').getFilteredExpenses(who,period);return {tags:tagsIn(r.expenses.map(e=>e.description).join(' ')),money:[r.expenseSummary.totalExpense]};}
 if(type==='bill'){const r=await h.load('src/services/database/billDb.ts').getFilteredBills(who,{...period,status:'posted'});return {tags:tagsIn(r.bills.map(b=>b.party_name).join(' ')),money:[r.billSummary.totalBilled,r.billSummary.totalPaid,r.billSummary.totalDue],count:r.billSummary.billCount};}
 // Stock has no getFiltered*: the on-screen figures are the Stock IN / OUT report screens.
 const api=h.load('src/services/database/stockDb.ts');
 const ins=await api.getStockInReport(who,period.startDate,period.endDate), outs=await api.getStockOutReport(who,period.startDate,period.endDate);
 const valueIn=ins.reduce((a,m)=>a+m.change*(m.cost_per_unit??0),0), valueOut=outs.reduce((a,m)=>a+(-m.change)*(m.sale_price_unit??m.cost_per_unit??0),0);
 return {tags:tagsIn([...ins,...outs].map(m=>m.item_name_en).join(' ')),money:[valueIn,valueOut]};
}
const BOOKS=['cash','expense','bill','stock'];

check(68,'each export preset produces exactly the rows in that period, in PDF and CSV',at('src/components/Download/reportPeriod.ts','presetPeriod'),()=>isolated(async h=>{
 seedPeriods(h);const {presetPeriod}=periodApi(h);const failures=[];
 for(const [preset,tags] of Object.entries(IN_PRESET)){
  const period=presetPeriod(preset,NOW);const expected=expectTags(OWNER_TREE,tags);
  for(const type of BOOKS){
   const html=await exportFile(h,type,'owner',period);
   if(JSON.stringify(tagsIn(html))!==JSON.stringify(expected))failures.push(preset+'/'+type+'/pdf: '+tagsIn(html).join(',')+' vs '+expected.join(','));
   const csv=await exportFile(h,type,'owner',period,'csv');
   if(JSON.stringify(tagsIn(csv))!==JSON.stringify(expected))failures.push(preset+'/'+type+'/csv');
   assert.ok(html.includes('Period: '),'PDF states its period');
   if(/DRAFT_|HOLD_/.test(html+csv))failures.push(preset+'/'+type+': draft or hold row exported');
  }
 }
 assert.equal(failures.length,0,failures.join('\n'));
 // The preset bounds themselves, including month-end and a week that crosses a month.
 assert.deepEqual(plain(presetPeriod('today',NOW)),{startDate:'2026-09-11',endDate:'2026-09-11'});
 assert.deepEqual(plain(presetPeriod('week',NOW)),{startDate:'2026-09-05',endDate:'2026-09-11'});
 assert.deepEqual(plain(presetPeriod('month',NOW)),{startDate:'2026-09-01',endDate:'2026-09-30'});
 assert.deepEqual(plain(presetPeriod('week',new Date(2026,9,3,12))),{startDate:'2026-09-27',endDate:'2026-10-03'});
 assert.deepEqual(plain(presetPeriod('month',new Date(2028,1,10,12))),{startDate:'2028-02-01',endDate:'2028-02-29'});
 assert.deepEqual(plain(presetPeriod('custom',NOW)),{});
}));

check(69,'custom range boundaries are inclusive; open ends export everything; bad ranges are refused',at('src/components/Download/reportPeriod.ts','resolvePeriod'),()=>isolated(async h=>{
 seedPeriods(h);
 for(const type of BOOKS){
  const both=await exportFile(h,type,'owner',{startDate:'2026-09-04',endDate:'2026-09-05'});
  assert.deepEqual(tagsIn(both),expectTags(OWNER_TREE,['d1','d2']),type+' inclusive boundaries');
  assert.ok(both.includes('Period: '+shown(h,'2026-09-04')+' to '+shown(h,'2026-09-05')),type+' header names both bounds');
  const all=await exportFile(h,type,'owner',{});
  assert.deepEqual(tagsIn(all),expectTags(OWNER_TREE,Object.keys(DAYS)),type+' open range = every row');
  assert.ok(all.includes('Period: all dates'),type+' open range labelled');
  const from=await exportFile(h,type,'owner',{startDate:'2026-09-30'});
  assert.deepEqual(tagsIn(from),expectTags(OWNER_TREE,['d4','d6']),type+' from-only');
  assert.ok(from.includes('Period: from '+shown(h,'2026-09-30')));
  const upTo=await exportFile(h,type,'owner',{endDate:'2026-08-31'});
  assert.deepEqual(tagsIn(upTo),expectTags(OWNER_TREE,['d5']),type+' to-only');
 }
 // A legacy ISO timestamp still resolves to its LOCAL day (old callers passed toISOString()).
 const {resolvePeriod}=periodApi(h);
 assert.deepEqual(plain(resolvePeriod({startDate:'2026-09-04',endDate:'2026-09-05'})),{startDate:'2026-09-04',endDate:'2026-09-05'});
 const iso='2026-09-04T19:30:00.000Z';assert.equal(resolvePeriod({startDate:iso}).startDate,h.load('src/utils/dates.ts').localDate(new Date(iso)),'legacy ISO → local day');
 assert.throws(()=>resolvePeriod({startDate:'2026-99-99'}),/Invalid date range/);
 assert.throws(()=>resolvePeriod({startDate:'garbage'}),/Invalid date range/);
 assert.throws(()=>resolvePeriod({startDate:'2026-09-05',endDate:'2026-09-04'}),/From date must not be after To date/);
 await assert.rejects(exportFile(h,'cash','owner',{startDate:'2026-09-05',endDate:'2026-09-04'}),/From date must not be after To date/);
 await assert.rejects(exportFile(h,'bill','owner',{startDate:'nope'}),/Invalid date range/);
}));

check(70,'report totals are the book\'s own SQL aggregates for the same range',at(pdf,'getFilteredCashHistory(options.userId, period)'),()=>isolated(async h=>{
 seedPeriods(h);const {presetPeriod}=periodApi(h);const fmt=calc(h).formatCurrency;const failures=[];
 const periods=[...Object.keys(IN_PRESET).map(k=>presetPeriod(k,NOW)),{startDate:'2026-09-04',endDate:'2026-09-05'},{}];
 for(const period of periods)for(const type of BOOKS){
  const html=await exportFile(h,type,'owner',period);const book=await bookFigures(h,type,'owner',period);
  if(JSON.stringify(tagsIn(html))!==JSON.stringify(book.tags))failures.push(type+' rows differ for '+JSON.stringify(period));
  for(const paisa of book.money)if(!html.includes('<strong>'+fmt(paisa)+'</strong>'))failures.push(type+' total '+fmt(paisa)+' absent for '+JSON.stringify(period));
  if(book.count!==undefined&&!html.includes('<strong>'+book.count+'</strong>'))failures.push('bill count '+book.count+' absent');
 }
 assert.equal(failures.length,0,failures.join('\n'));
 // Bill export = the Bill Book's default POSTED tab. Drafts and holds are in range and
 // would inflate Total Billed by millions if counted; prove they are not.
 {
  const period=presetPeriod('month',NOW);const html=await exportFile(h,'bill','owner',period);
  const billDbApi=h.load('src/services/database/billDb.ts');
  const posted=(await billDbApi.getFilteredBills('owner',{...period,status:'posted'})).billSummary;
  const every=(await billDbApi.getFilteredBills('owner',{...period,status:'all'})).billSummary;
  assert.ok(every.totalBilled>posted.totalBilled&&every.billCount>posted.billCount,'fixture must contain drafts/holds in range');
  assert.ok(html.includes('<strong>'+fmt(posted.totalBilled)+'</strong>'),'Total Billed is the posted figure');
  assert.ok(html.includes('<strong>'+posted.billCount+'</strong>'),'bill count is the posted count');
  assert.ok(!html.includes(fmt(every.totalBilled)),'all-statuses total must not appear');
  assert.ok(!/DRAFT_|HOLD_/.test(html),'no draft/hold rows printed');
  assert.ok(/Status/.test(html),'Status column is kept to document the rows');
 }
 // The cash figure must be a whole-set aggregate, not a sum of the printed page:
 // the book pages at 500, the export is uncapped, so seed past that and compare.
 for(let i=0;i<520;i++)h.insert('cashbook',{id:'bulk'+i,userId:'subB',description:'bulk',amount_paisa:100,direction:'in',date:'2026-09-11',isDeleted:0});
 const html=await exportFile(h,'cash','owner',presetPeriod('today',NOW));const book=await bookFigures(h,'cash','owner',presetPeriod('today',NOW));
 assert.ok(html.includes('<strong>'+fmt(book.money[0])+'</strong>'),'uncapped cash total');
 assert.equal((html.match(/>bulk</g)||[]).length,520,'every row printed');
}));

check(71,'an empty range still produces a valid no-records document with zero totals',at(pdf,'emptyRow'),()=>isolated(async h=>{
 seedPeriods(h);const fmt=calc(h).formatCurrency;
 for(const type of BOOKS){
  const html=await exportFile(h,type,'owner',{startDate:'2025-01-01',endDate:'2025-01-31'});
  assert.match(html,/<html[\s>]/i);assert.ok(html.includes('No records for this period'),type);
  assert.ok(!/{{\w+}}/.test(html),type+' unfilled placeholder');assert.deepEqual(tagsIn(html),[]);
  assert.ok(html.includes('<strong>'+fmt(0)+'</strong>'),type+' zero total');
  assert.ok(html.includes('Period: '+shown(h,'2025-01-01')+' to '+shown(h,'2025-01-31')));
  const csv=await exportFile(h,type,'owner',{startDate:'2025-01-01',endDate:'2025-01-31'},'csv');
  assert.equal(csv.split('\n').filter(Boolean).length,1,type+' CSV is header only');
 }
 // Staff ignores the period entirely: the same roster whatever range is passed.
 const a=await exportFile(h,'staff','owner',{startDate:'2025-01-01',endDate:'2025-01-31'});const b=await exportFile(h,'staff','owner',{});
 assert.equal(a,b,'staff roster must not depend on the period');assert.ok(a.includes('As of '));assert.ok(!a.includes('Period:'));
}));

check(72,'hierarchy scoping holds inside every range, for every level and the other business',at(pdf,'hierarchyFilter'),()=>isolated(async h=>{
 seedPeriods(h);const {presetPeriod}=periodApi(h);const failures=[];
 const scope={owner:OWNER_TREE,staffA:['staffA','subA'],subA:['subA'],staffB:['staffB','subB'],otherOwner:['otherStaff'],otherStaff:['otherStaff']};
 for(const [who,tree] of Object.entries(scope))for(const [preset,tags] of Object.entries(IN_PRESET))for(const type of BOOKS){
  const period=presetPeriod(preset,NOW);const html=await exportFile(h,type,who,period);
  const expected=expectTags(tree,tags);
  if(JSON.stringify(tagsIn(html))!==JSON.stringify(expected))failures.push(who+'/'+preset+'/'+type+': '+tagsIn(html).join(',')+' vs '+expected.join(','));
  const book=await bookFigures(h,type,who,period);
  if(JSON.stringify(tagsIn(html))!==JSON.stringify(book.tags))failures.push(who+'/'+preset+'/'+type+' differs from the book screen');
 }
 assert.equal(failures.length,0,failures.join('\n'));
}));

check(73,'the modal drives the query with a real selector; staff hides it; money is paisa-once',at('src/components/Download/DownloadOptionsModal.tsx','DateRangeFilter'),()=>isolated(async h=>{
 const modal=read('src/components/Download/DownloadOptionsModal.tsx');
 assert.ok(!/useState\(new Date\(new Date\(\)\.setDate\(1\)\)/.test(modal),'locked month-to-date state must be gone');
 assert.ok(!modal.includes('this month to date'),'stale label must be gone');
 assert.ok(modal.includes('<DateRangeFilter value={range} onChange={editRange}'),'reuses the shared range control');
 assert.ok(modal.includes('REPORT_PRESETS.map('),'presets are rendered from the shared list');
 assert.ok(/startDate:\s*period\.startDate,\s*endDate:\s*period\.endDate/.test(modal),'the chosen range is what the generator receives');
 assert.ok(/const isRoster = reportType === 'staff'/.test(modal)&&/isRoster \? \(/.test(modal),'staff hides the range control');
 assert.ok(!/console\.log/.test(modal));
 assert.ok(!/\/\s*100\b/.test(read(pdf)),'generator never hand-divides paisa');
 assert.ok(!/\/\s*100\b/.test(read('src/components/Download/reportPeriod.ts')));
 // Money is still formatted once for a chosen range, never raw or divided twice.
 seedPeriods(h);const {presetPeriod}=periodApi(h);
 for(const type of BOOKS){
  const html=await exportFile(h,type,'owner',presetPeriod('today',NOW));
  assert.ok(/Rs\. \d{1,3}(,\d{3})*\.\d{2}/.test(html),type+' formatted money');
  assert.ok(!/Rs\.?\s+Rs\./.test(html),type+' doubled prefix');
  assert.ok(!/>\d{6,}</.test(html),type+' raw paisa cell');
 }
 const csv=await exportFile(h,'cash','owner',presetPeriod('today',NOW),'csv');
 assert.ok(/,1000\.\d\d$/m.test(csv),'CSV rupees with two decimals');assert.ok(!/,100\d{3}$/m.test(csv),'CSV raw paisa');
}));

// ── Prompt 15: customer fields ────────────────────────────────────────────────
const customerDb=h=>h.load('src/services/database/customerDb.ts');
const CNIC='34101-2345678-9', CNIC_DIGITS='3410123456789';
function seedCustomers(h){
 seedPeople(h);
 for(const who of ['owner','staffA','subA','staffB','subB','otherOwner','otherStaff'])
  h.insert('customers',{id:'cust_'+who,user_id:who,name:'CUST_'+who,phone:'0300 000000'+who.length,notes:'legacy note '+who});
}
check(74,'v34 adds the six nullable customer columns and preserves every row across reopen',at(dbPath,'if (version < 34)'),()=>isolated(async h=>{
 seedCustomers(h);
 const cols=h.all('PRAGMA table_info(customers)').map(c=>c.name);
 for(const c of ['photo_local_path','photo_remote_url','email','cnic','address','city'])assert.ok(!cols.includes(c),'v33 must not yet have '+c);
 const before=plain(h.all('SELECT * FROM customers ORDER BY id'));
 await h.boot();
 assert.equal(h.one('PRAGMA user_version').user_version,34);
 const after=h.all('PRAGMA table_info(customers)');
 for(const c of ['photo_local_path','photo_remote_url','email','cnic','address','city']){const col=after.find(x=>x.name===c);assert.ok(col,'missing '+c);assert.equal(col.notnull,0,c+' must be nullable');}
 const rows=h.all('SELECT * FROM customers ORDER BY id');assert.equal(rows.length,before.length);
 rows.forEach((r,i)=>{for(const [k,v]of Object.entries(before[i]))assert.equal(r[k],v,'customers.'+k);for(const c of ['photo_local_path','photo_remote_url','email','cnic','address','city'])assert.equal(r[c],null,c+' must be null for legacy rows');});
 await h.boot();assert.deepEqual(plain(h.all('SELECT * FROM customers ORDER BY id')),plain(rows),'reopen must be a no-op');
},33));
check(75,'every new field saves, round-trips and normalises; only name is required',at('src/services/database/customerDb.ts','normalizeCustomerInput'),()=>isolated(async h=>{
 seedPeople(h);const api=customerDb(h);
 const c=await api.addCustomer({user_id:'staffA',name:'  Ali Khan ',phone:' 0300 1234567 ',email:'Ali@Example.COM',cnic:CNIC_DIGITS,address:' Shop 4, Anarkali ',city:'Lahore',notes:''});
 const row=h.one('SELECT * FROM customers WHERE id=?',c.id);
 assert.equal(row.name,'Ali Khan');assert.equal(row.phone,'0300 1234567');assert.equal(row.email,'ali@example.com');
 assert.equal(row.cnic,CNIC,'bare 13 digits are stored in printed form');assert.equal(row.address,'Shop 4, Anarkali');assert.equal(row.city,'Lahore');assert.equal(row.notes,null,'blank optional becomes null');
 assert.equal(row.photo_local_path,null);assert.equal(row.photo_remote_url,null);
 // Edit path: each field independently updatable and clearable.
 await api.updateCustomer(c.id,'staffA',{city:'Karachi',email:'',cnic:CNIC,address:null});
 const edited=h.one('SELECT * FROM customers WHERE id=?',c.id);
 assert.equal(edited.city,'Karachi');assert.equal(edited.email,null,'cleared');assert.equal(edited.cnic,CNIC);assert.equal(edited.address,null);assert.equal(edited.name,'Ali Khan','untouched field unchanged');
 assert.deepEqual(plain(await api.getCustomerById('staffA',c.id)),plain(edited));
 // Name is the only required field; a bare name is a valid customer.
 const bare=await api.addCustomer({user_id:'staffA',name:'Walk-in Bilal'});const bareRow=h.one('SELECT * FROM customers WHERE id=?',bare.id);
 for(const f of ['phone','email','cnic','address','city','notes'])assert.equal(bareRow[f],null,f);
 await assert.rejects(()=>api.addCustomer({user_id:'staffA',name:'   ',phone:'0300 1234567'}),/customer name/i);
 await assert.rejects(()=>api.updateCustomer(c.id,'staffA',{name:''}),/customer name/i);
 await assert.rejects(()=>api.updateCustomer(c.id,'staffA',{current_balance:0}),/current_balance|not allowed|unexpected/i,'unknown columns are rejected, not silently inserted');
}));
check(76,'CNIC, email and phone accept valid values and reject malformed ones',at('src/utils/contactValidation.ts','normalizeCnic'),()=>isolated(async h=>{
 const v=h.load('src/utils/contactValidation.ts');
 for(const ok of ['34101-2345678-9','3410123456789',' 34101-2345678-9 '])assert.equal(v.normalizeCnic(ok),CNIC,ok);
 assert.equal(v.normalizeCnic(''),null);assert.equal(v.normalizeCnic('   '),null);assert.equal(v.normalizeCnic(null),null);
 for(const bad of ['34101-234567-9','341012345678','34101234567890','34101-2345678-','34101 2345678 9','3410l-2345678-9','12345-1234567-12','abc'])assert.throws(()=>v.normalizeCnic(bad),/13 digits/,bad);
 assert.equal(v.isValidCnic(CNIC),true);assert.equal(v.isValidCnic('123'),false);
 assert.equal(v.normalizeEmail(' Ali.Khan@Example.com '),'ali.khan@example.com');assert.equal(v.normalizeEmail(''),null);
 for(const bad of ['ali','ali@','@example.com','ali@example','ali khan@example.com','ali@@example.com'])assert.throws(()=>v.normalizeEmail(bad),/valid email/,bad);
 for(const ok of ['0300 1234567','03001234567','+92 300 1234567','+923001234567','(042) 1234567'])assert.doesNotThrow(()=>v.normalizePhone(ok),ok);
 for(const bad of ['abc','123','0300-12345678901234','03OO1234567'])assert.throws(()=>v.normalizePhone(bad),/valid phone/,bad);
 // And the data layer enforces the same rules on both add and edit.
 seedPeople(h);const api=customerDb(h);
 await assert.rejects(()=>api.addCustomer({user_id:'owner',name:'X',cnic:'34101-234567-9'}),/13 digits/);
 await assert.rejects(()=>api.addCustomer({user_id:'owner',name:'X',email:'nope'}),/valid email/);
 await assert.rejects(()=>api.addCustomer({user_id:'owner',name:'X',phone:'abc'}),/valid phone/);
 const c=await api.addCustomer({user_id:'owner',name:'X'});
 await assert.rejects(()=>api.updateCustomer(c.id,'owner',{cnic:'1'}),/13 digits/);
 assert.equal(h.one('SELECT COUNT(*) AS n FROM customers').n,1,'rejected saves write nothing');
}));
check(77,'customer photos are copied under documentDirectory and render remote → local → initial',at('src/utils/customerPhoto.ts','persistCustomerPhoto'),()=>isolated(async h=>{
 const photo=h.load('src/utils/customerPhoto.ts');const api=customerDb(h);
 const picked='file:///data/user/0/com.app/cache/ImagePicker/abc.jpg';
 const durable=await photo.persistCustomerPhoto(picked,'cust_1');
 assert.ok(durable.startsWith('test://customer_photos/'),'stored path is under documentDirectory: '+durable);
 assert.ok(!durable.includes('/cache/'),'never the picker cache');
 assert.deepEqual(h.files.map(f=>f.op),['mkdir','copy']);assert.equal(h.files[1].from,picked);assert.equal(h.files[1].to,durable);
 assert.equal(await photo.persistCustomerPhoto(durable,'cust_1'),durable,'already-durable path is reused');assert.equal(h.files.length,2,'no second copy');
 assert.equal(photo.isPersistedCustomerPhoto(picked),false);assert.equal(photo.isPersistedCustomerPhoto(durable),true);
 // Compression options match the receipt pickers.
 const src=read('src/utils/customerPhoto.ts');assert.ok(/quality:\s*0\.5/.test(src));assert.ok(/allowsEditing:\s*true/.test(src));
 // Render chain.
 assert.equal(api.customerPhotoUri({photo_remote_url:'https://x/1.jpg',photo_local_path:durable}),'https://x/1.jpg');
 assert.equal(api.customerPhotoUri({photo_remote_url:null,photo_local_path:durable}),durable);
 assert.equal(api.customerPhotoUri({photo_remote_url:'',photo_local_path:''}),null,'blank falls through to the initial');
 assert.equal(api.customerPhotoUri(null),null);
 const avatar=read('src/components/ui/CustomerAvatar.tsx');
 assert.ok(/onError=\{\(\) => setFailed/.test(avatar),'a missing file drops to the initial');assert.ok(/charAt\(0\)/.test(avatar));
 // Every screen stores ONLY the durable copy in photo_local_path, never a raw picker URI.
 for(const f of ['src/screens/staff/AddCustomerModal.tsx','src/screens/CustomerBook/CustomerBookScreen.tsx']){
  const s=read(f);const assigns=s.match(/photo_local_path:\s*\w+/g)||[];assert.ok(assigns.length>=1,f+' saves a photo');
  for(const a of assigns)assert.ok(/photo_local_path:\s*durable/.test(a),f+' must store the persisted path, got '+a);
  assert.ok(s.includes('persistCustomerPhoto('),f);assert.ok(s.includes('<CustomerAvatar'),f+' renders through the fallback chain');
 }
 assert.ok(read('src/screens/staff/CustomerDetailScreen.tsx').includes('<CustomerAvatar'));
}));
check(78,'CNIC never reaches a log, a sync payload, an export, a PDF or search',at('src/services/database/syncHelpers.ts','LOCAL_ONLY_FIELDS'),()=>isolated(async h=>{
 seedPeople(h);const api=customerDb(h);
 const c=await api.addCustomer({user_id:'owner',name:'Secret Sam',phone:'0300 7654321',cnic:CNIC_DIGITS,email:'sam@example.com'});
 await api.updateCustomer(c.id,'owner',{cnic:CNIC,city:'Multan'});
 assert.equal(h.one('SELECT cnic FROM customers WHERE id=?',c.id).cnic,CNIC,'stored locally');
 const queue=h.all('SELECT * FROM sync_queue WHERE table_name=? ORDER BY created_at','customers');assert.equal(queue.length,2,'create + update queued');
 for(const q of queue){const p=JSON.parse(q.payload);assert.ok(!('cnic' in p),'payload must not carry the cnic key');assert.ok(!q.payload.includes(CNIC)&&!q.payload.includes(CNIC_DIGITS),'payload must not carry the value');assert.equal(p.city??p.name,q.operation==='update'?'Multan':'Secret Sam','other fields still sync');}
 const sync=h.load('src/services/database/syncHelpers.ts');assert.deepEqual(plain(sync.LOCAL_ONLY_FIELDS.customers),['cnic']);
 assert.deepEqual(plain(sync.syncPayloadFor('customers',{a:1,cnic:'x'})),{a:1});assert.deepEqual(plain(sync.syncPayloadFor('bills',{a:1,cnic:'x'})),{a:1,cnic:'x'},'only the declared table is filtered');
 // Logs: everything console.* emitted while writing the customer (with __DEV__ on) is captured.
 assert.ok(h.logs.length>0,'sync helper does log, so the capture works');
 for(const line of h.logs)assert.ok(!line.includes(CNIC)&&!line.includes(CNIC_DIGITS),'CNIC value in a log line: '+line);
 // Search: the customer type queries users, and nothing matches the CNIC.
 const hits=await h.load('src/services/database/searchDb.ts').executeGlobalSearch(CNIC_DIGITS,'owner');
 assert.equal(hits.length,0);assert.ok(!JSON.stringify(await h.load('src/services/database/searchDb.ts').executeGlobalSearch('Secret','owner')).includes(CNIC));
 // Exports and PDFs: no report reads customers at all, and no export module mentions cnic.
 for(const f of sourceFiles().filter(p=>/components[\\/]Download|utils[\\/]pdfGenerator|searchDb|reports[\\/]/.test(p))){
  const s=fs.readFileSync(f,'utf8');assert.ok(!/cnic/i.test(s),f+' mentions cnic');assert.ok(!/FROM customers/i.test(s),f+' reads customers');
 }
 for(const type of BOOKS){const html=await exportFile(h,type,'owner',{startDate:'2000-01-01',endDate:'2099-12-31'});assert.ok(!html.includes(CNIC)&&!html.includes(CNIC_DIGITS),type);}
 // Source: no console call anywhere names the cnic field, __DEV__ or not.
 for(const f of sourceFiles()){const s=fs.readFileSync(f,'utf8');if(!/cnic/i.test(s))continue;for(const line of s.split('\n'))if(/console\.(log|warn|error|info|debug)/.test(line))assert.ok(!/cnic/i.test(line),f+': '+line.trim());}
 // Pull sync never touches customers, so nothing remote can overwrite the local value.
 assert.ok(!/customers/.test(read('src/services/pullSyncService.ts')));
}));
check(79,'customer scoping is unchanged: each level sees exactly its branch, by list and by id',at('src/services/database/customerDb.ts','getCustomerById'),()=>isolated(async h=>{
 seedCustomers(h);const api=customerDb(h);
 const expect={owner:['cust_owner','cust_staffA','cust_staffB','cust_subA','cust_subB'],staffA:['cust_staffA','cust_subA'],subA:['cust_subA'],staffB:['cust_staffB','cust_subB'],otherOwner:['cust_otherOwner','cust_otherStaff'],otherStaff:['cust_otherStaff']};
 for(const [who,ids]of Object.entries(expect)){
  assert.deepEqual((await api.getCustomers(who)).map(c=>c.id).sort(),ids,who);
  for(const id of ['cust_owner','cust_staffA','cust_subA','cust_staffB','cust_subB','cust_otherOwner','cust_otherStaff'])
   assert.equal((await api.getCustomerById(who,id))?.id??null,ids.includes(id)?id:null,who+' → '+id);
 }
 // Removed customers stay hidden; removed users' customers stay visible to the tree.
 h.sqlite.prepare("UPDATE customers SET is_deleted=1 WHERE id='cust_subA'").run();h.sqlite.prepare("UPDATE users SET is_deleted=1 WHERE id='subB'").run();
 assert.deepEqual((await api.getCustomers('owner')).map(c=>c.id).sort(),['cust_owner','cust_staffA','cust_staffB','cust_subB']);
 // The SQL scope text is the byte-identical userScope shape.
 const src=read('src/services/database/customerDb.ts');const shape=/user_id = \? OR user_id IN \(SELECT id FROM users WHERE parentId = \?\) OR user_id IN \(SELECT id FROM users WHERE parentId IN \(SELECT id FROM users WHERE parentId = \?\)\)/g;
 assert.equal((src.match(shape)||[]).length,4,'every customer query uses the shared 3-level scope');assert.ok(!/is_deleted = 0[^)]*parentId/.test(src));
}));
check(80,'both customer forms carry the new fields, the Customer Book can edit, and the bill quick-add no longer crashes','customer screens',()=>{
 const add=read('src/screens/staff/AddCustomerModal.tsx'),book=read('src/screens/CustomerBook/CustomerBookScreen.tsx'),bill=read('src/screens/BillBook/CreateNewBillModal.tsx');
 for(const [f,s]of [['AddCustomerModal',add],['CustomerBookScreen',book]]){
  for(const field of ['email','cnic','address','city','photoUri'])assert.ok(new RegExp('value=\\{'+field+'\\}|uri=\\{'+field+'\\}').test(s),f+' renders '+field);
  assert.ok(/Customer Name \*/.test(s),f+' keeps name required');assert.ok(!/console\.log/.test(s),f);
  assert.ok(/keyboardType="email-address"/.test(s)&&/maxLength=\{15\}/.test(s),f+' field affordances');
 }
 // Edit path exists: tapping a card opens the same sheet in edit mode and saves via updateCustomer.
 assert.ok(/<TouchableOpacity style=\{styles\.customerCard\} onPress=\{\(\) => openEdit\(item\)\}/.test(book),'card is tappable');
 assert.ok(/await updateCustomer\(editingId, user\.id, \{ \.\.\.fields, photo_local_path: durable \}\)/.test(book),'edit saves through updateCustomer');
 assert.ok(/editingId \? 'Edit Customer' : 'Add New Customer'/.test(book));
 assert.ok(!/Address \/ Details/.test(book),'the old notes field is no longer mislabelled as address');
 // Quick add in Create Bill: lean by design, and no longer passes a non-existent column.
 assert.ok(!/current_balances*:/.test(bill),'current_balance removed from the insert');assert.ok(/name: newPartyName,\s*phone: newPartyPhone,/.test(bill));
 // Every add path funnels through the one validator.
 assert.ok(read('src/services/database/customerDb.ts').includes('normalizeCustomerInput(fields, { requireName: true })'));
});

check(81,'a sub-staff cannot obtain, set or wipe a CNIC; owner and branch staff read it in full',at('src/services/database/customerDb.ts','canViewCnic'),()=>isolated(async h=>{
 seedPeople(h);const api=customerDb(h);
 // The customer belongs to sub-staff subA (so subA's own scope contains it); the CNIC is
 // recorded by their branch staff, who can see and edit that row.
 const c=await api.addCustomer({user_id:'subA',name:'Sam Cnic',phone:'0300 1112223'});await api.updateCustomer(c.id,'staffA',{cnic:CNIC});
 assert.equal(await api.canViewCnic('owner'),true);assert.equal(await api.canViewCnic('staffA'),true);assert.equal(await api.canViewCnic('subA'),false);assert.equal(await api.canViewCnic('nobody'),false);
 // Every read path: full for owner and staff, redacted for sub-staff — while every other field is intact.
 for(const who of ['owner','staffA']){
  assert.equal((await api.getCustomerById(who,c.id)).cnic,CNIC,who+' byId');assert.equal((await api.getCustomerByName(who,'Sam Cnic')).cnic,CNIC,who+' byName');
  assert.equal((await api.getCustomers(who)).find(x=>x.id===c.id).cnic,CNIC,who+' list');
 }
 const byId=await api.getCustomerById('subA',c.id);assert.ok(byId,'sub-staff still sees the customer');assert.equal(byId.cnic,null,'sub-staff byId redacted');assert.equal(byId.phone,'0300 1112223','other fields untouched');
 assert.equal((await api.getCustomerByName('subA','Sam Cnic')).cnic,null,'sub-staff byName redacted');
 const listed=(await api.getCustomers('subA')).find(x=>x.id===c.id);assert.ok(listed);assert.equal(listed.cnic,null,'sub-staff list redacted');
 assert.ok(!JSON.stringify(await api.getCustomers('subA')).includes(CNIC),'no sub-staff read carries the value anywhere');
 // Writes mirror the read rule.
 await assert.rejects(()=>api.addCustomer({user_id:'subA',name:'New',cnic:CNIC}),/owner or branch staff/,'sub-staff cannot record one');
 await assert.rejects(()=>api.updateCustomer(c.id,'subA',{cnic:'11111-1111111-1'}),/owner or branch staff/,'sub-staff cannot change one');
 await api.updateCustomer(c.id,'subA',{city:'Sialkot',cnic:''});
 const row=h.one('SELECT * FROM customers WHERE id=?',c.id);assert.equal(row.city,'Sialkot','sub-staff edits of other fields still save');assert.equal(row.cnic,CNIC,'a blank from a sub-staff form never wipes the stored CNIC');
 await api.updateCustomer(c.id,'staffA',{cnic:''});assert.equal(h.one('SELECT cnic FROM customers WHERE id=?',c.id).cnic,null,'branch staff may clear it');
 // Stored still in SQLite for those entitled — redaction is at the read layer, not a rewrite.
 await api.updateCustomer(c.id,'owner',{cnic:CNIC});assert.equal(h.one('SELECT cnic FROM customers WHERE id=?',c.id).cnic,CNIC);
 assert.equal((await api.getCustomerById('subA',c.id)).cnic,null);assert.equal(h.one('SELECT cnic FROM customers WHERE id=?',c.id).cnic,CNIC,'redaction never touches the row');
 // Screens: the field is offered only to those who may see it, and the detail row hides when null.
 for(const f of ['src/screens/staff/AddCustomerModal.tsx','src/screens/CustomerBook/CustomerBookScreen.tsx']){const s=read(f);assert.ok(/canViewCnic\(user\.id\)/.test(s),f);assert.ok(/showCnic &&/.test(s),f+' hides the CNIC field');assert.ok(/\.\.\.\(showCnic \? \{ cnic \} : \{\}\)/.test(s),f+' never sends the key when hidden');}
 assert.ok(/\{customer\.cnic && </.test(read('src/screens/staff/CustomerDetailScreen.tsx')),'detail row is conditional on the (possibly redacted) value');
}));

(async()=>{
 const originals=new Map(sourceFiles().map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
 let passed=0;const failures=[];
 for(const t of testCases){try{await t.fn();passed++;console.info('PASS '+String(t.id).padStart(2,'0')+' '+t.name);}catch(e){failures.push(t.id);console.info('FAIL '+String(t.id).padStart(2,'0')+' '+t.name+'\n  '+t.where+'\n  '+e.message.replace(/\n/g,'\n  '));}}
 for(const [p,hash]of originals)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),hash,'Application source changed during tests: '+p);
 console.info('\nTOTAL '+testCases.length+': '+passed+' PASS, '+failures.length+' FAIL'+(failures.length?' ('+failures.join(', ')+')':''));
 console.info('Temporary databases removed. Application code unchanged. Native PDF rendering/device startup are not simulated.');
 process.exitCode=failures.length?1:0;
})().catch(e=>{console.error('HARNESS ERROR',e);process.exitCode=1;});
