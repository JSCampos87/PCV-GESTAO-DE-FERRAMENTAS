/* PCV Ferramentas – camada de dados para a versão GitHub / ficheiro local.
   Fornece window.claude.use('db' | 'user' | 'downloads') com a mesma interface que a app usa no claude.ai:
   - modo "local": dados guardados no browser (localStorage), cada computador tem os seus;
   - modo "firebase": dados partilhados entre todos os postos (Cloud Firestore), se config.js tiver a configuração. */
(function(){
  if(window.claude&&window.claude.use)return;           // dentro do claude.ai usa a base partilhada nativa
  window.__PCV_STANDALONE=true;
  const CFG=window.PCV_CONFIG||{};
  const clone=o=>JSON.parse(JSON.stringify(o));
  const loadJs=src=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('Falhou '+src));document.head.append(s)});
  const downloads={save:async r=>{const blob=r.data instanceof Blob?r.data:new Blob([r.data]);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=r.filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000);return {status:'saved'}}};

  /* ---------- modo local ---------- */
  function localDb(){
    window.PCV_MODE='local';
    const KEY=CFG.chaveLocal||'pcv_ferramentas_v1';let STORE=null;
    try{STORE=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
    const seed=window.PCV_SEED||{};
    if(!STORE)STORE=clone(seed);else for(const k in seed)if(k.startsWith('config/')&&!(k in STORE))STORE[k]=clone(seed[k]);
    let saveT=null;
    const persist=()=>{clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(STORE))}catch(e){alert('Não foi possível guardar no browser (espaço cheio?). Faça uma cópia de segurança em Armazém › Importar / exportar.')}},150)};
    persist();
    const subs=new Set();const notify=()=>{persist();subs.forEach(f=>f())};
    const deepMerge=(a,b)=>{for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object')deepMerge(a[k],b[k]);else a[k]=b[k]}return a};
    const snapDoc=p=>({id:p.split('/').pop(),exists:p in STORE,data:()=>STORE[p],metadata:{fromCache:false,hasPendingWrites:false}});
    const docRef=p=>({id:p.split('/').pop(),path:p,
      get:async()=>snapDoc(p),
      set:async d=>{STORE[p]=clone(d);notify()},
      update:async d=>{if(!(p in STORE))throw {code:'invalid_argument',message:'documento inexistente'};const c=clone(d),o=STORE[p];for(const k in c){const v=c[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])){for(const k2 in v)o[k][k2]=v[k2]}else o[k]=v}notify()},   /* como o Firestore: 2 níveis, o valor do 2.º nível é substituído */
      delete:async()=>{delete STORE[p];notify()},
      onSnapshot(next){const f=()=>next(snapDoc(p));subs.add(f);setTimeout(f,0);return()=>subs.delete(f)},
      collection:c=>coll(p+'/'+c)});
    function coll(c){let ob=null,lim=0;const n=c.split('/').length;
      const snap=()=>{let ds=Object.keys(STORE).filter(k=>k.startsWith(c+'/')&&k.split('/').length===n+1).sort().map(snapDoc);
        if(ob)ds.sort((a,b)=>String(a.data()[ob[0]]).localeCompare(String(b.data()[ob[0]]))*(ob[1]==='desc'?-1:1));if(lim)ds=ds.slice(0,lim);
        return {docs:ds,size:ds.length,empty:!ds.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}};
      const q={where(){return q},orderBy(f,d){ob=[f,d];return q},limit(x){lim=x;return q},
        doc:id=>docRef(c+'/'+(id||Date.now().toString(36)+Math.random().toString(36).slice(2,8))),
        add:async d=>{const r=q.doc();await r.set(d);return r},get:async()=>snap(),
        onSnapshot(next){const f=()=>next(snap());subs.add(f);setTimeout(f,0);return()=>subs.delete(f)}};
      return q}
    return {doc:docRef,collection:coll};
  }

  /* ---------- modo Firebase (Cloud Firestore) ---------- */
  async function firebaseDb(){
    window.PCV_MODE='firebase';
    const V=CFG.firebaseVersao||'10.12.2',base=window.PCV_VENDOR||`https://www.gstatic.com/firebasejs/${V}/`;
    await loadJs(base+'firebase-app-compat.js');await loadJs(base+'firebase-firestore-compat.js');
    if(CFG.firebaseAuth!=='nenhuma')await loadJs(base+'firebase-auth-compat.js');
    const app=firebase.initializeApp(CFG.firebase);
    if(CFG.firebaseAuth!=='nenhuma'){await firebase.auth().signInAnonymously();}
    const fs=firebase.firestore();try{fs.settings({ignoreUndefinedProperties:true,merge:true})}catch{}
    const FP=firebase.firestore.FieldPath;
    const map=e=>({code:e?.code==='permission-denied'?'invalid_argument':(e?.code||'unavailable'),message:e?.message||String(e)});
    const wrapSnap=s=>({id:s.id,exists:s.exists,data:()=>s.data(),metadata:{fromCache:s.metadata?.fromCache,hasPendingWrites:s.metadata?.hasPendingWrites}});
    const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const docW=ref=>({id:ref.id,path:ref.path,
      get:async()=>wrapSnap(await ref.get()),
      set:d=>ref.set(d).catch(e=>{throw map(e)}),
      update:d=>{const args=[];for(const[k,v]of Object.entries(d)){if(isObj(v)&&Object.keys(v).length){for(const[k2,v2]of Object.entries(v))args.push(new FP(k,k2),v2===undefined?null:v2)}else args.push(new FP(k),v===undefined?null:v)}
        if(!args.length)return Promise.resolve();return ref.update(...args).catch(e=>{throw map(e)})},
      delete:()=>ref.delete().catch(e=>{throw map(e)}),
      onSnapshot:(next,err)=>ref.onSnapshot(s=>next(wrapSnap(s)),e=>err&&err(map(e))),
      collection:c=>collW(ref.collection(c))});
    const collW=q=>({where:(a,b,c)=>collW(q.where(a,b,c)),orderBy:(f,d)=>collW(q.orderBy(f,d)),limit:n=>collW(q.limit(n)),
      doc:id=>docW(id?q.doc(id):q.doc()),add:async d=>docW(await q.add(d)),
      get:async()=>{const s=await q.get();return {docs:s.docs.map(wrapSnap),size:s.size,empty:s.empty,docChanges:()=>[],metadata:{}}},
      onSnapshot:(next,err)=>q.onSnapshot(s=>next({docs:s.docs.map(wrapSnap),size:s.size,empty:s.empty,docChanges:()=>[],metadata:{fromCache:s.metadata.fromCache}}),e=>err&&err(map(e)))});
    window.__PCV_UID=firebase.auth?firebase.auth().currentUser?.uid:null;
    return {doc:p=>docW(fs.doc(p)),collection:p=>collW(fs.collection(p))};
  }

  window.PCV_DIAG=[];
  if(!window.PCV_CONFIG)PCV_DIAG.push('Falta o ficheiro <b>config.js</b> na raiz do repositório — a app fica em modo local.');
  else if(!(CFG.firebase&&CFG.firebase.apiKey)&&!window.PCV_SINGLE)PCV_DIAG.push('O <b>config.js</b> não tem a configuração do Firebase (versão antiga do zip?) — a app fica em modo local.');
  let dbP=null;
  const getDb=()=>dbP||(dbP=(CFG.firebase&&CFG.firebase.apiKey?firebaseDb().catch(e=>{console.error(e);alert('Não foi possível ligar à base de dados partilhada (Firebase). A app vai funcionar em modo local neste browser.\n\n'+(e.message||e));return localDb()}):Promise.resolve(localDb())));
  const user={id:async()=>{await getDb();return window.__PCV_UID||'local'},can:async()=>true,canEdit:async()=>true,isOwner:async()=>true,profiles:async()=>({})};
  window.claude={use:async n=>n==='db'?getDb():n==='user'?user:n==='downloads'?downloads:null};
})();
