// Plain Node: real dictionaries/store/formatters; only AsyncStorage is mocked.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {root,read,sourceFiles,ts,assert}=require('./regression-harness.cjs');
function runtime(saved='en',failRead=false){
 const cache=new Map(),storage=new Map([['app_language',saved]]);
 const load=p=>{
  p=path.resolve(root,p);if(cache.has(p))return cache.get(p).exports;
  const m={exports:{}};cache.set(p,m);
  const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const req=id=>{
   if(id==='@react-native-async-storage/async-storage')return {getItem:async k=>{if(failRead)throw Error('storage unavailable');return storage.get(k)||null;},setItem:async(k,v)=>storage.set(k,v)};
   if(id.startsWith('.')){const b=path.resolve(path.dirname(p),id);return load([b+'.ts',b+'.tsx',path.join(b,'index.ts')].find(fs.existsSync));}
   return require(id);
  };
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{__DEV__:false,console},{filename:p})(req,m,m.exports);
  return m.exports;
 };
 return {load,storage};
}
const checks=[];const check=(name,fn)=>checks.push({name,fn});
const placeholders=s=>[...s.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(m=>m[1]).sort();
check('English/Urdu key parity, nonempty values and matching named placeholders',()=>{
 const r=runtime(),en=r.load('src/i18n/en.ts').en,ur=r.load('src/i18n/ur.ts').ur;
 assert.deepEqual(Object.keys(en).sort(),Object.keys(ur).sort());
 for(const k of Object.keys(en)){
  assert.ok(en[k].trim()&&ur[k].trim(),k+' is empty');
  assert.deepEqual(placeholders(en[k]),placeholders(ur[k]),k+' placeholders differ');
  assert.ok(!/Rs\.|\p{Nd}+/u.test(ur[k]),k+' contains currency or digits');
 }
 assert.ok(read('src/i18n/en.ts').includes('as const'));
 assert.ok(read('src/i18n/ur.ts').includes('Record<TKey, string>'));
 for(const k of ['registerBtn','registerTitle','createAccount','bizName','passLen'])assert.ok(!(k in en),'dead public registration key '+k);
 assert.notEqual(en.welcome,'welcome');assert.notEqual(ur.welcome,'welcome');
});
check('Every literal t() key in source exists in both dictionaries',()=>{
 const r=runtime(),en=r.load('src/i18n/en.ts').en,ur=r.load('src/i18n/ur.ts').ur;
 for(const file of sourceFiles(path.join(root,'src'))){
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const visit=n=>{
   if(ts.isCallExpression(n)&&(/^(t|.*\.t)$/.test(n.expression.getText(sf)))){
    const arg=n.arguments[0];if(arg&&ts.isStringLiteral(arg))assert.ok(arg.text in en&&arg.text in ur,file+': missing '+arg.text);
   }ts.forEachChild(n,visit);
  };visit(sf);
 }
});
check('Named interpolation is literal, repeated, order-independent and preserves missing tokens',()=>{
 const r=runtime(),en=r.load('src/i18n/en.ts').en,{translate}=r.load('src/i18n/translate.ts');
 en.fromDate='{name}: {date} / {name}';
 assert.equal(translate('en','fromDate',{date:'13 Sep 2026',name:'$&'}),'$&: 13 Sep 2026 / $&');
 assert.equal(translate('en','fromDate',{}),'{name}: {date} / {name}');
 assert.equal(translate('ur','editedEvent',{name:'Ahmed'}),'یہ اندراج تبدیل کیا: Ahmed');
});
check('Saved language is restored, toggles persist, unavailable storage finishes loading',async()=>{
 for(const lang of ['en','ur']){
  const r=runtime(lang),store=r.load('src/store/useLanguageStore.ts').useLanguageStore;
  assert.equal(store.getState().isLoaded,false);await store.getState().loadLanguage();
  assert.equal(store.getState().isLoaded,true);assert.equal(store.getState().language,lang);
  const before=store.getState().t('welcome');await store.getState().toggleLanguage();
  assert.notEqual(store.getState().t('welcome'),before);
  assert.equal(r.storage.get('app_language'),store.getState().language);
 }
 const r=runtime('en',true),store=r.load('src/store/useLanguageStore.ts').useLanguageStore;
 await store.getState().loadLanguage();assert.equal(store.getState().isLoaded,true);
});
check('Boot restores language before DB/session and gates rendering; Login does not restore it',()=>{
 const boot=read('src/navigation/AppNavigator.tsx'),login=read('src/screens/auth/LoginScreen.tsx');
 assert.ok(boot.indexOf('await loadLanguage()')<boot.indexOf('await getDatabase()'));
 assert.ok(boot.indexOf('await loadLanguage()')<boot.indexOf('await checkSession()'));
 assert.ok(boot.indexOf('if (!isLoaded)')<boot.indexOf('<NavigationContainer'));
 assert.ok(boot.indexOf('if (!isLoaded)')<boot.indexOf("t('loading')"));
 assert.ok(!/loadLanguage/.test(login));
});
check('Currency is byte-identical and ASCII under English and Urdu; dates remain en-PK',async()=>{
 const r=runtime(),store=r.load('src/store/useLanguageStore.ts').useLanguageStore;
 const {formatCurrency}=r.load('src/utils/calculations.ts'),{formatDisplayDate}=r.load('src/utils/dates.ts');
 const values=[0,1,99,100,9999,123456,-123456,999999999];
 await store.getState().setLanguage('en');const before=values.map(formatCurrency),date=formatDisplayDate('2026-09-13');
 await store.getState().setLanguage('ur');const after=values.map(formatCurrency);
 for(let i=0;i<before.length;i++){
  assert.ok(Buffer.from(before[i]).equals(Buffer.from(after[i])));
  assert.ok(/^[\x00-\x7F]+$/.test(after[i]));
 }
 assert.equal(before[5],'Rs. 1,234.56');assert.equal(formatDisplayDate('2026-09-13'),date);
 assert.ok(read('src/utils/calculations.ts').includes("toLocaleString('en-PK'"));
 assert.ok(read('src/utils/dates.ts').includes("toLocaleDateString('en-PK'"));
});
check('No forced RTL anywhere; translated shared components do not mix figures with labels',()=>{
 for(const f of sourceFiles(path.join(root,'src')))assert.ok(!/\bforceRTL\s*\(/.test(fs.readFileSync(f,'utf8')),f+' forces RTL');
 const files=['src/components/TopHeaderWithBooks.tsx','src/components/Download/DownloadOptionsModal.tsx','src/components/ui/EntryHistory.tsx','src/components/ui/DateField.tsx','src/components/ui/DateRangeFilter.tsx','src/components/OfflineBanner.tsx','src/components/SuccessModal.tsx','src/components/CountryCodePicker.tsx','src/components/reports/DateFilterPicker.tsx'];
 for(const f of files){
  const text=read(f);assert.ok(!/writingDirection/.test(text),f+' overrides bidi direction');
  const sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(n){
   if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(sf)==='Text'){
    const body=n.children.map(c=>c.getText(sf)).join(' ');
    if(/formatCurrency|formatDisplayDate|valueText/.test(body))assert.ok(!/\bt\(/.test(body),f+' combines a figure/date and a translated label');
   }ts.forEachChild(n,visit);
  }visit(sf);
 }
});
(async()=>{let passed=0;for(const c of checks){try{await c.fn();passed++;console.info('PASS '+c.name);}catch(e){console.error('FAIL '+c.name+'\n'+e.stack);}}console.info(`TOTAL ${checks.length}: ${passed} PASS, ${checks.length-passed} FAIL`);process.exitCode=passed===checks.length?0:1;})();
