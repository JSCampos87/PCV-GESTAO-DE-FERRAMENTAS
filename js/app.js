"use strict";
/* ============ utilidades ============ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const nowIso=()=>new Date().toISOString();
const fmtD=s=>{if(!s)return '';const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:s};
const fmtDT=s=>{if(!s)return '';const d=new Date(s);if(isNaN(d))return s;return d.toLocaleDateString('pt-PT')+' '+d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const safeId=s=>String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g,'_').slice(0,120)||uid();
let toastT;function toast(msg,err){let t=$('.toast');if(!t){t=document.createElement('div');document.body.append(t)}t.className='toast'+(err?' err':'');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,err?6000:3200)}
function loadScript(src){return new Promise((ok,ko)=>{if($(`script[src="${src}"]`)){ok();return}const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('Não foi possível carregar '+src));document.head.append(s)})}
const vend=(f,cdn)=>window.PCV_VENDOR?window.PCV_VENDOR+f:cdn;
const LIB={
  pdf:async()=>{if(window.pdfjsLib)return;await loadScript(vend('pdf.worker.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'));await loadScript(vend('pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'))},
  jspdf:async()=>{if(window.jspdf?.jsPDF?.API?.autoTable)return;await loadScript(vend('jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'));await loadScript(vend('jspdf.plugin.autotable.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'))}
};

/* ============ estado ============ */
const EST={armazem:'Em armazém',maquina:'Na máquina',reparacao:'Em reparação',sucatado:'Sucatado'};
const DEFAULT_CL={groups:[
 {name:'Cortante',items:['Confirmar se estão as borrachas todas','Confirmar se existe algum problema com as lâminas','Limpeza']},
 {name:'Chapa',items:['Confirmar se a chapa não se encontra danificada ou empenada','Limpeza']},
 {name:'Folha de alceamento',items:['Confirmar se a folha não se encontra rasgada']},
 {name:'Descasque macho',items:['Verificar madeiras','Verificar lâminas']},
 {name:'Descasque fêmea',items:['Verificar madeiras','Verificar lâminas']},
 {name:'Agulhas',items:['Confirmar se estão todas as agulhas necessárias']},
 {name:'Desmoldagem',items:['Verificar todas as esponjas']},
 {name:'Separação',items:['Verificar fitas e pernos']},
 {name:'Braille',items:['Verificar Braille']}],machines:['B145','B142','B106','B104','B142E']};
const DEFAULT_OPS=["Sérgio Carvalho", "Abel Tavares", "Humberto Sousa", "Rúben Dantas", "Paulo Moreira", "Carlos Santos", "Vitor Moreira", "Bruno Ferreira", "Hélio Costa", "Sérgio Amorim", "José Tavares", "José Henrique", "Nelson Coêlho", "Vera Pais", "Eduardo Dias", "António Ferreira", "Cássio Santos"];
const operadores=()=>(S.cl&&S.cl.operadores&&S.cl.operadores.length?S.cl.operadores:DEFAULT_OPS);
function fillOpSelect(){const s=$('#xOp');if(!s)return;const cur=s.value||getName();s.innerHTML='<option value="">Escolher operador…</option>'+operadores().map(m=>`<option>${esc(m)}</option>`).join('');if(operadores().includes(cur))s.value=cur;const dl=$('#opList');if(dl)dl.innerHTML=operadores().map(m=>`<option>${esc(m)}</option>`).join('')}
const DEFAULT_REC=['Célia Rocha','Soraia Pinto','André Sousa','João Pinto'];
const recetores=()=>(S.cl&&S.cl.recetores&&S.cl.recetores.length?S.cl.recetores:DEFAULT_REC);
const machines=()=>(S.cl&&S.cl.machines&&S.cl.machines.length?S.cl.machines:DEFAULT_CL.machines);
function fillMaqSelect(){const s=$('#xMaq');if(!s)return;const cur=s.value;s.innerHTML='<option value="">Escolher máquina…</option>'+machines().map(m=>`<option>${esc(m)}</option>`).join('');if(machines().includes(cur))s.value=cur}
const S={db:null,user:null,me:null,canWrite:false,dl:null,sample:null,assets:null,
  tools:new Map(),shardOf:new Map(),shards:new Map(),positions:{},posV:false,cl:null,orders:[],insp:[],ncs:[],recs:[],exits:[],
  loaded:{tools:false,orders:false,insp:false},names:{}};
const LOGO_URL='img/logo.png';

/* ============ base de dados ============ */
const queues={};
function serial(key,fn){const p=(queues[key]||Promise.resolve()).then(fn,fn);queues[key]=p.catch(()=>{});return p}
function dbErr(e){const c=e?.code;if(c==='quota_exceeded')return 'A base de dados está cheia. Apaga registos antigos.';if(c==='invalid_argument')return 'Sem permissão para gravar (pede acesso de Contribuidor) ou dados inválidos.';if(c==='resource_exhausted')return 'Demasiados pedidos seguidos. Aguarda uns segundos e tenta outra vez.';return 'Não foi possível gravar: '+(e?.message||c||e)}
function needDb(){if(!S.db){toast('Sem ligação à base de dados partilhada.',1);return false}if(!S.canWrite){toast('Tens acesso só de leitura.',1);return false}return true}
function pickShard(extraBytes){
  let best=null,bs=Infinity;
  for(const[id,sz]of S.shards){if(sz+extraBytes<180000&&sz<bs){bs=sz;best=id}}
  if(best)return {id:best,isNew:false};
  let n=0;while(S.shards.has('s'+String(n).padStart(2,'0')))n++;const id='s'+String(n).padStart(2,'0');S.shards.set(id,0);return {id,isNew:true};
}
async function saveTools(list,opts={}){
  if(!needDb())return false;
  const by={},newShards=new Set();
  for(const t of list){
    let sh=S.shardOf.get(t.id);
    if(!sh){const p=pickShard(JSON.stringify(t).length);sh=p.id;if(p.isNew)newShards.add(sh);S.shardOf.set(t.id,sh)}
    (by[sh]=by[sh]||{})[t.id]=t;
    S.shards.set(sh,(S.shards.get(sh)||0)+JSON.stringify(t).length);
    S.tools.set(t.id,t);
  }
  try{
    for(const sh of Object.keys(by)){
      const ref=S.db.doc('tools/'+sh);
      await serial('tools/'+sh,()=>newShards.has(sh)?ref.set({items:by[sh]}):ref.update({items:by[sh]}));
    }
    refreshAll();return true;
  }catch(e){toast(dbErr(e),1);return false}
}
async function deleteTool(id){
  if(!needDb())return;const sh=S.shardOf.get(id);if(!sh)return;
  try{await serial('tools/'+sh,()=>S.db.doc('tools/'+sh).update({items:{[id]:null}}));S.tools.delete(id);S.shardOf.delete(id);refreshAll();toast('Ferramenta eliminada.')}catch(e){toast(dbErr(e),1)}
}
function addHist(t,a){t.hist=[{d:nowIso(),a,by:S.me||'',...(typeof ROLE!=='undefined'&&ROLE?{r:ROLE}:{})},...(t.hist||[])].slice(0,25);t.upd=today()}

async function initDb(){
  const sync=$('#sync');
  const set=(cls,txt)=>{sync.className='sync '+cls;sync.lastElementChild.textContent=txt};
  if(!window.claude?.use){set('off','Sem base partilhada');showBanner();return}
  const [db,user,dl,sample,assets]=await Promise.all(['db','user','downloads','sample','assets'].map(n=>window.claude.use(n).catch(()=>null)));
  S.db=db;S.user=user;S.dl=dl;S.sample=sample;S.assets=assets;
  if(!db){set('off','Sem base partilhada');showBanner();return}
  if(user){try{S.me=await user.id()}catch{}try{const c=await user.can('data.write');S.canWrite=c!==false}catch{S.canWrite=true}}else S.canWrite=true;
  document.body.classList.toggle('ro',!S.canWrite);
  set('on',window.PCV_MODE==='local'?'Modo local · dados neste browser':S.canWrite?'Ligado · partilhado':'Ligado · só leitura');
  db.collection('tools').onSnapshot(snap=>{
    S.tools.clear();S.shardOf.clear();S.shards.clear();
    for(const d of snap.docs){const it=d.data()?.items||{};let sz=0;for(const[k,v]of Object.entries(it)){if(!v)continue;S.tools.set(k,v);S.shardOf.set(k,d.id);sz+=JSON.stringify(v).length}S.shards.set(d.id,sz)}
    S.loaded.tools=true;refreshAll();
  },e=>{toast('Ligação às ferramentas perdida: '+(e.message||e.code),1)});
  db.doc('config/positions').onSnapshot(d=>{S.positions=d.exists?(d.data().items||{}):{};S.posV=d.exists;refreshAll()},()=>{});
  db.doc('config/checklist').onSnapshot(d=>{S.cl=d.exists?d.data():null;S.clExists=d.exists;refreshQualConfig()},()=>{});
  db.doc('config/links').onSnapshot(d=>{S.links=d.exists?d.data():{};S.linksV=d.exists;[['#lnkC','cortante'],['#lnkB','braille'],['#lnkR','relevo']].forEach(([s,k])=>{if(document.activeElement!==$(s))$(s).value=S.links[k]||''});refreshAll()},()=>{});
  db.collection('orders').onSnapshot(snap=>{S.orders=snap.docs.map(d=>({...d.data(),_id:d.id}));S.loaded.orders=true;refreshAll()},()=>{});
  db.collection('exits').orderBy('ts','desc').limit(1500).onSnapshot(snap=>{S.exits=snap.docs.map(d=>({...d.data(),_id:d.id}));S.loaded.exits=true;refreshAll()},()=>{});
  db.collection('receptions').orderBy('ts','desc').limit(1000).onSnapshot(snap=>{S.recs=snap.docs.map(d=>({...d.data(),_id:d.id}));S.loaded.recs=true;refreshAll()},()=>{});
  db.collection('ncs').orderBy('ts','desc').limit(500).onSnapshot(snap=>{S.ncs=snap.docs.map(d=>({...d.data(),_id:d.id}));refreshAll()},()=>{});
  db.collection('inspections').orderBy('ts','desc').limit(1000).onSnapshot(snap=>{S.insp=snap.docs.map(d=>({...d.data(),_id:d.id}));S.loaded.insp=true;refreshAll()},()=>{});
}
function showBanner(){$('#banner').innerHTML='<div class="banner">Esta vista não tem acesso à base de dados partilhada. Abre a app a partir do link do claude.ai com sessão iniciada para ver e gravar dados.</div>'}
async function names(ids){
  ids=[...new Set(ids.filter(Boolean))].filter(i=>!(i in S.names));
  if(ids.length&&S.user?.profiles){try{const p=await S.user.profiles(ids);for(const i of ids)S.names[i]=p?.[i]?.name||''}catch{}}
}
function fillNames(root){const ids=$$('[data-uid]',root).map(e=>e.dataset.uid);names(ids).then(()=>$$('[data-uid]',root).forEach(e=>{e.textContent=S.names[e.dataset.uid]||'utilizador'}))}

/* ============ ficheiros: exportação ============ */
async function saveFile(filename,data){
  if(!S.dl){toast('Esta vista não permite descarregar ficheiros.',1);return}
  try{await S.dl.save({filename,data});}catch(e){if(e?.code!=='declined')toast('Não foi possível descarregar: '+(e.message||e.code),1)}
}
async function exportXlsx(name,sheets){
  if(!window.XLSX){try{await loadScript(vend('xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'))}catch{toast('A biblioteca de Excel não carregou.',1);return}}
  const wb=XLSX.utils.book_new();
  for(const[sn,rows]of sheets){const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=rows[0].map((h,i)=>({wch:Math.min(50,Math.max(String(h).length,...rows.slice(1,200).map(r=>String(r[i]??'').length))+2)}));XLSX.utils.book_append_sheet(wb,ws,sn.slice(0,31))}
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  await saveFile(name,new Uint8Array(buf));
}
/* abrir PDF para imprimir: na app online o browser não deixa abrir a janela de impressão diretamente;
   o PDF é gerado com impressão automática (abre a janela da impressora ao ser aberto). */
async function printPdf(doc,filename){
  try{doc.autoPrint({variant:'non-conform'})}catch{}
  if(window.__PCV_LOCAL||window.__PCV_STANDALONE){try{const u=URL.createObjectURL(new Blob([doc.output('arraybuffer')],{type:'application/pdf'}));const w=window.open(u,'_blank');if(w)return}catch{}}
  await saveFile(filename,doc.output('arraybuffer'));
}
let logoData=null;
async function getLogo(){if(logoData)return logoData;try{const b=await (await fetch(LOGO_URL)).blob();logoData=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})}catch{logoData=''}return logoData}
async function newPdf(title,sub,landscape){
  await LIB.jspdf();const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:landscape?'l':'p',unit:'mm',format:'a4'});
  const W=doc.internal.pageSize.getWidth();const lg=await getLogo();
  if(lg){try{doc.addImage(lg,'PNG',W-14-40,10,40,8.9)}catch{}}
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(20,118,63);doc.text(title,14,16);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(95,111,101);doc.text(sub||('PCV · Pré-corte e Vinco · gerado em '+new Date().toLocaleString('pt-PT')),14,22);
  doc.setDrawColor(185,216,195);doc.line(14,25,W-14,25);return doc;
}
function pdfTable(doc,head,body,startY,extra){doc.autoTable({head:[head],body,startY:startY||29,styles:{fontSize:8,cellPadding:1.6,lineColor:[217,226,220],lineWidth:.1},headStyles:{fillColor:[20,118,63],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[245,247,245]},margin:{left:14,right:14},...(extra||{})})}
function pdfFooter(doc){const n=doc.internal.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(140);doc.text('Página '+i+' de '+n,doc.internal.pageSize.getWidth()-14,doc.internal.pageSize.getHeight()-8,{align:'right'})}}

/* ============ leitura de folhas ============ */
async function readSheet(file){
  if(!window.XLSX){try{await loadScript(vend('xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'))}catch{throw new Error('a biblioteca de Excel não carregou (verifica a ligação à internet)')}}
  const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:true});
  return wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''})}));
}
const cellStr=v=>{if(v instanceof Date){return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')}if(typeof v==='number'&&Number.isInteger(v))return String(v);return String(v??'').replace(/\s+/g,' ').trim()};
function findHeader(rows,tests,minHits){
  for(let i=0;i<Math.min(rows.length,25);i++){
    const r=rows[i].map(c=>norm(c));const map={};let hits=0;
    for(const[k,re]of Object.entries(tests)){const j=r.findIndex((c,ix)=>c&&re.test(c)&&!Object.values(map).includes(ix));if(j>=0){map[k]=j;hits++}}
    if(hits>=minHits)return {row:i,map};
  }return null;
}

/* ============ navegação ============ */
const UI={view:'inicio',arm:'lista',qual:'nova',comp:'ped',op:'nova',acc:'',page:0,hl:'',openOrder:null};
function go(v,sub){
  UI.view=v;$$('.view').forEach(s=>s.hidden=s.id!=='v-'+v);
  $$('nav.main button').forEach(b=>b.setAttribute('aria-current',b.dataset.go===v));
  if(sub){if(v==='armazem')UI.arm=sub;if(v==='qualidade')UI.qual=sub}
  syncTabs();try{history.replaceState(null,'','#'+v)}catch{}
  refreshAll();window.scrollTo(0,0);
}
function syncTabs(){
  const set=(key,cur,sec)=>{$$(`[data-tabs="${key}"] [data-sub]`).forEach(b=>b.setAttribute('aria-selected',b.dataset.sub===cur));$$('#'+sec+' [data-pane]').forEach(p=>p.hidden=p.dataset.pane!==cur)};
  set('arm',UI.arm,'v-armazem');set('qual',UI.qual,'v-qualidade');set('comp',UI.comp,'v-pedidos');set('op',UI.op,'v-operador');if(UI.def)set('def',UI.def,'v-def');$$('[data-show]').forEach(el=>el.hidden=el.dataset.show!==UI.comp);
}
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}
  const t=e.target.closest('[data-sub]');if(t){const k=t.closest('[data-tabs]').dataset.tabs;if(k==='arm')UI.arm=t.dataset.sub;else if(k==='comp')UI.comp=t.dataset.sub;else if(k==='op')UI.op=t.dataset.sub;else if(k==='def')UI.def=t.dataset.sub;else UI.qual=t.dataset.sub;syncTabs();refreshAll()}
});
function refreshAll(){
  if(UI.view==='inicio')renderHome();
  if(UI.view==='armazem'){if(UI.arm==='lista')renderTools();if(UI.arm==='posicoes')renderPositions();if(UI.arm==='sucata')renderScrapMarked()}
  if(UI.view==='pedidos'){if(UI.comp==='ped')renderOrders();if(UI.comp==='rhist')renderRecHist();if(UI.comp==='rkpi')renderRecKpi()}
  if(UI.view==='qualidade'){if(UI.qual==='hist')renderHist();if(UI.qual==='kpi')renderKpi();if(UI.qual==='nova')renderToolInfo()}
  if(UI.view==='operador'){if(UI.op==='hist')renderExitHist();if(UI.op==='kpi')renderExitKpi();if(UI.op==='nova')renderExitTool()}
  if(UI.view==='def'&&typeof renderDefs==='function')renderDefs();
  if(UI.view==='armazem')sync3D();
}

/* ============ início ============ */
function renderHome(){
  const all=[...S.tools.values()];const act=all.filter(t=>t.est!=='sucatado');
  const rep=act.filter(t=>t.est==='reparacao').length;const free=freePositions().length;
  const st=(v,l,c)=>`<div class="stat ${c||''}"><b>${v}</b><span>${l}</span></div>`;
  const ld=S.loaded.tools?null:'—';
  $('#stA').innerHTML=st(ld??act.length,'ativas')+st(ld??free,'posições livres')+st(ld??rep,'em reparação',rep?'warn':'');
  const open=S.orders.filter(o=>o.estado!=='Recebido'&&o.estado!=='Cancelado');
  const ot=orderTotals(),lo=S.loaded.orders;
  $('#stP').innerHTML=st(lo?ot.ped:'—','ferramentas pedidas')+st(lo?ot.rec:'—','recebidas até '+fmtD(today()).slice(0,5))+st(lo?ot.ped-ot.rec:'—','por receber',ot.ped-ot.rec?'warn':'');
  $('#homeOrd').innerHTML=lo&&ot.ped?`<b>${ot.ped}</b> ferramentas pedidas · <b>${ot.rec}</b> recebidas até ${fmtD(today())}`:'';
  const d30=Date.now()-30*864e5;const q30=S.insp.filter(i=>new Date(i.ts)>d30);const n30=q30.filter(i=>i.res==='NOK').length;
  {const ex30=(S.exits||[]).filter(i=>new Date(i.ts)>d30);const lim=vidaMax();const ov=all.filter(t=>t.est!=='sucatado'&&(+t.folhas||0)>=vidaMax(t)).length;
   $('#stO').innerHTML=st(S.loaded.exits?ex30.length:'—','registos 30 d')+st(S.loaded.exits?Math.round(ex30.reduce((s,i)=>s+(+i.folhas||0),0)/1000)+' mil':'—','folhas 30 d')+st(S.loaded.tools?ov:'—','acima do limite',ov?'alert':'');}
  $('#stQ').innerHTML=st(S.loaded.insp?q30.length:'—','verificações 30 d')+st(S.loaded.insp?n30:'—','NOK 30 d',n30?'alert':'')+st(S.loaded.tools?rep:'—','em reparação',rep?'warn':'');
  const lim=vidaMax(),vida=all.filter(t=>t.est!=='sucatado'&&(+t.folhas||0)>=vidaMax(t)*0.9).sort((x,y)=>(+y.folhas||0)/vidaMax(y)-(+x.folhas||0)/vidaMax(x));
  $('#vidaN').textContent=vida.filter(t=>(+t.folhas||0)>=vidaMax(t)).length;
  $('#vidaList').innerHTML=vida.length?`<div class="tw"><table class="t"><thead><tr><th>Cortante</th><th>Folhas</th></tr></thead><tbody>${vida.slice(0,15).map(t=>`<tr class="click" data-tool="${esc(t.id)}"><td class="code">${esc(t.cod)}<div class="small muted" style="font-family:var(--f-sans);font-weight:400">${esc(t.pos||'')}</div></td><td><b class="mono" style="color:${(+t.folhas||0)>=vidaMax(t)?'var(--nok)':'var(--warn)'}">${fmtN(t.folhas)}</b>${vidaBar(t)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="small muted" style="margin:0">Nenhum cortante perto do limite de ${fmtN(lim)} folhas.</p>`;
  const reps=all.filter(t=>t.est==='reparacao').sort((x,y)=>String(x.repDesde||'').localeCompare(String(y.repDesde||'')));
  $('#repN').textContent=reps.length;
  $('#repList').innerHTML=reps.length?`<div class="tw"><table class="t"><thead><tr><th>Cortante</th><th>Motivo</th><th>Desde</th><th></th></tr></thead><tbody>${reps.map(t=>`<tr class="click" data-tool="${esc(t.id)}"><td class="code">${esc(t.cod)}<div class="small muted" style="font-family:var(--f-sans);font-weight:400">${esc(t.pos||'')}</div></td><td class="small">${esc(t.repMot||((t.hist||[]).find(h=>/repara/i.test(h.a))||{}).a||'—')}${t.repOrig?`<div class="muted">${esc(t.repOrig)}</div>`:''}</td><td class="mono small">${fmtD(t.repDesde)||'—'}</td><td class="w-only" data-min="PCV"><button class="btn sm" data-repok="${esc(t.id)}">Reparado</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted" style="margin:0">Sem cortantes em reparação.</p>';
  const ncs=(S.ncs||[]).filter(n=>n.estado!=='Fechada');
  $('#ncN').textContent=ncs.length;
  $('#ncList').innerHTML=ncs.length?`<div class="tw"><table class="t"><thead><tr><th>Pedido</th><th>Material / problema</th><th>Estado</th></tr></thead><tbody>${ncs.map(n=>`<tr class="click" data-nc="${esc(n._id)}"><td class="code">${esc(n.pedido)}<div class="small muted" style="font-family:var(--f-sans);font-weight:400">${fmtD(n.data)}</div></td><td class="small">${esc(n.forn||'')} · ${esc(n.mat||n.cod||'')}<div class="muted">${esc(n.tipo||'')}: ${esc((n.descricao||'').slice(0,80))}</div></td><td><span class="pill ${n.estado==='Aberta'?'p-nok':'p-par'}">${esc(n.estado)}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted" style="margin:0">Sem não conformidades em aberto.</p>';
  const ev=[];
  for(const t of all)for(const h of (t.hist||[]).slice(0,3))ev.push({d:h.d,txt:`<b class="mono">${esc(t.cod)}</b> ${esc(h.a)}`});
  for(const i of S.insp.slice(0,15))ev.push({d:i.ts,txt:`Verificação <b class="mono">${esc(i.cod)}</b> · ${esc(i.maq||'')} · <span class="pill ${i.res==='OK'?'p-ok':'p-nok'}">${i.res}</span>`});
  for(const o of S.orders)if(o.criado)ev.push({d:o.criado,txt:`Pedido <b class="mono">${esc(o.num)}</b> registado (${(o.linhas||[]).length} linhas)`});
  ev.sort((a,b)=>String(b.d).localeCompare(String(a.d)));
  $('#feed').innerHTML=ev.length?ev.slice(0,8).map(e=>`<li><time>${fmtDT(e.d)}</time><span>${e.txt}</span></li>`).join(''):`<li class="muted">${S.db?'Ainda sem atividade registada na app. As mudanças de posição, pedidos e verificações aparecem aqui.':'Sem ligação à base de dados.'}</li>`;
}
function toolAc(input,list,onPick){
  let sel=0,items=[];
  const draw=()=>{list.innerHTML=items.map((t,i)=>`<button type="button" data-i="${i}" class="${i===sel?'sel':''}"><b>${esc(t.cod)}</b>${esc(t.pos||'sem posição')} · ${esc((t.cli||t.den||'').slice(0,48))}</button>`).join('');list.hidden=!items.length};
  input.addEventListener('input',()=>{const q=norm(input.value);sel=0;items=q.length<2?[]:[...S.tools.values()].filter(t=>norm(t.cod).includes(q)||norm(t.pos).startsWith(q)).sort((a,b)=>(a.est==='sucatado')-(b.est==='sucatado')||norm(a.cod).indexOf(q)-norm(b.cod).indexOf(q)).slice(0,10);draw()});
  input.addEventListener('keydown',e=>{if(list.hidden)return;if(e.key==='ArrowDown'){sel=Math.min(sel+1,items.length-1);draw();e.preventDefault()}if(e.key==='ArrowUp'){sel=Math.max(sel-1,0);draw();e.preventDefault()}if(e.key==='Enter'&&items[sel]){e.preventDefault();list.hidden=true;onPick(items[sel])}if(e.key==='Escape')list.hidden=true});
  list.addEventListener('mousedown',e=>{const b=e.target.closest('[data-i]');if(b){e.preventDefault();list.hidden=true;onPick(items[+b.dataset.i])}});
  input.addEventListener('blur',()=>setTimeout(()=>list.hidden=true,150));
}
toolAc($('#homeSearch'),$('#homeAc'),t=>{$('#homeSearch').value='';openTool(t.id)});
$('#repList').addEventListener('click',async e=>{const b=e.target.closest('[data-repok]');if(b){const t=S.tools.get(b.dataset.repok);if(!t)return;const n={...t,est:'armazem'};delete n.repDesde;delete n.repMot;delete n.repOrig;addHist(n,'Reparação concluída; regressou ao armazém ('+(t.pos||'sem posição')+')');if(await saveTools([n]))toast(t.cod+' reparado e de volta ao armazém.');return}const r=e.target.closest('[data-tool]');if(r)openTool(r.dataset.tool)});
$('#vidaList').addEventListener('click',e=>{const r=e.target.closest('[data-tool]');if(r)openTool(r.dataset.tool)});
$('#ncList').addEventListener('click',e=>{const r=e.target.closest('[data-nc]');if(r){const n=(S.ncs||[]).find(x=>x._id===r.dataset.nc);if(n)openNc(n)}});

/* ============ armazém: lista ============ */
const PAGE=100;
function locals(){const s=new Set();for(const t of S.tools.values())if(t.local)s.add(t.local);for(const p of Object.values(S.positions))if(p.l)s.add(p.l);return [...s].sort((a,b)=>a.localeCompare(b,'pt',{numeric:true}))}
function fillLocalSelect(sel,allLabel){const cur=sel.value;sel.innerHTML=`<option value="">${allLabel}</option>`+locals().map(l=>`<option>${esc(l)}</option>`).join('');sel.value=cur}
function filteredTools(){
  const q=norm($('#q').value),loc=$('#fLocal').value,est=$('#fEst').value;
  let a=[...S.tools.values()];
  if(UI.acc==='br')a=a.filter(t=>t.br);else if(UI.acc==='rl')a=a.filter(t=>t.rl);else if(UI.acc==='brrl')a=a.filter(t=>t.br&&t.rl);
  if(loc)a=a.filter(t=>t.local===loc);
  if(est==='ativos')a=a.filter(t=>t.est!=='sucatado');else if(est==='sucatar')a=a.filter(t=>t.dec==='Sucatar'&&t.est!=='sucatado');else if(est)a=a.filter(t=>(t.est||'armazem')===est);
  if(q){const ws=q.split(/\s+/);a=a.filter(t=>{const h=norm([t.cod,t.pos,t.local,t.cli,t.ncli,t.mat,t.den,t.notas,t.obs,t.kam,t.br&&('braille '+(t.br.pos||'')),t.rl&&('relevo '+(t.rl.pos||''))].join(' '));return ws.every(w=>h.includes(w))})}
  return a.sort((x,y)=>(!x.pos)-(!y.pos)||String(x.pos||'').localeCompare(String(y.pos||''),'pt',{numeric:true})||String(x.cod).localeCompare(String(y.cod)));
}
const vidaMax=t=>+(t&&t.vidaMax)||+(S.cl?.vidaMax)||800000;
const fmtN=n=>Number(n||0).toLocaleString('pt-PT');
function vidaTag(t){const f=+t.folhas||0,m=vidaMax(t);if(f>=m)return ` <span class="tag vida" title="${fmtN(f)} folhas">⚠ ${Math.round(f/1000)} mil folhas</span>`;if(f>=m*0.9)return ` <span class="tag vidaw" title="${fmtN(f)} folhas">${Math.round(f/1000)} mil folhas</span>`;return ''}
function vidaBar(t){const f=+t.folhas||0,m=vidaMax(t),p=Math.min(100,f/m*100);return `<div class="life ${f>=m?'over':f>=m*0.9?'warn':''}"><i style="width:${p}%"></i></div>`}
function estPill(t){const e=t.est||'armazem';return `<span class="pill p-${e}">${EST[e]}</span>`+(t.dec==='Sucatar'&&e!=='sucatado'?' <span class="tag sucatar">p/ sucatar</span>':'')}
/* ligação ao PDF: link próprio (SharePoint) > ficheiro anexado > padrão SharePoint configurado */
function pdfUrl(t,kind){
  const it=kind==='cortante'?t:t[kind==='braille'?'br':'rl'];if(!it)return '';
  if(it.pdf)return it.pdf;if(kind==='cortante'&&t.desenho?.id)return '/_blob/'+t.desenho.id;
  const pat=(S.links||{})[kind];return pat&&/\{cod\}/i.test(pat)?pat.replace(/\{cod\}/gi,encodeURIComponent(t.cod)):'';
}
/* pasta do SharePoint normalizada: aceita o endereço da vista (AllItems.aspx?id=...) ou o caminho direto */
function folderOf(kind){let u=((S.links||{})[kind]||'').trim();if(!u)return '';
  try{const m=u.match(/[?&]id=([^&#]+)/);if(m){u=u.match(/^https?:\/\/[^/]+/)[0]+decodeURIComponent(m[1])}
    if(/\{cod\}/i.test(u))u=u.slice(0,u.lastIndexOf('/'));u=u.replace(/\/+$/,'');return encodeURI(decodeURI(u))+'/'}catch{return ''}}
/* código base do cortante: "S1980A (X2 CX)" -> "S1980A" */
function baseCod(c){const m=String(c||'').toUpperCase().match(/^[A-Z]\d{4,5}[A-Z]?/);return m?m[0]:String(c||'').toUpperCase().trim()}
function spSearch(cod){cod=baseCod(cod);const f=folderOf('cortante')||folderOf('braille')||folderOf('relevo');const o=(f.match(/^https?:\/\/[^/]+/)||['https://hinojosagroup.sharepoint.com'])[0];return o+'/_layouts/15/search.aspx?q='+encodeURIComponent(cod)}
const PDF_SVG='<svg viewBox="0 0 20 24" width="16" height="19" aria-hidden="true"><path d="M3 1h9l6 6v15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="var(--pdf-bg)" stroke="var(--pdf)" stroke-width="1.3"/><path d="M12 1v6h6" fill="none" stroke="var(--pdf)" stroke-width="1.3"/><rect x="0" y="12" width="15" height="7" rx="1.5" fill="var(--pdf)"/><text x="7.5" y="17.6" font-size="5.6" font-family="Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">PDF</text></svg>';
function pdfIcon(t,kind,label){const u=pdfUrl(t,kind);if(u)return `<a class="pdfi" href="${esc(u)}" target="_blank" rel="noopener" title="Abrir PDF ${esc(label||kind)} ${esc(t.cod)}">${PDF_SVG}</a>`;
  return `<a class="pdfi off" href="${esc(spSearch(t.cod))}" target="_blank" rel="noopener" title="PDF ${esc(label||kind)} ainda não associado – procurar ${esc(t.cod)} no SharePoint">${PDF_SVG}</a>`}
function accCell(t,kind){const it=t[kind==='braille'?'br':'rl'];if(!it)return '<span class="muted">—</span>';return `<span class="acc"><span class="acc-k">${kind==='braille'?'Braille':'Relevo'}</span><span class="mono${it.pos?'':' muted'}">${esc(it.pos||'posição ?')}</span>${pdfIcon(t,kind,kind==='braille'?'Braille':'Relevo')}</span>`}
function renderTools(){
  let nb=0,nr=0,nall=0;for(const t of S.tools.values())if(t.est!=='sucatado'){nall++;if(t.br)nb++;if(t.rl)nr++}
  $('#typeChips').innerHTML=[['','Todos os cortantes',nall],['br','Com Braille',nb],['rl','Com relevo',nr]].map(([k,v,n])=>`<button class="chip" data-acc="${k}" aria-pressed="${(UI.acc||'')===k}">${v}<span class="n">${n}</span></button>`).join('');
  fillLocalSelect($('#fLocal'),'Todos os locais');
  const a=filteredTools();UI.hl3d=norm($('#q').value).length>=2&&a.length<=12?a.map(t=>t.pos).filter(Boolean):[];const pages=Math.max(1,Math.ceil(a.length/PAGE));UI.page=Math.min(UI.page,pages-1);
  const rows=a.slice(UI.page*PAGE,(UI.page+1)*PAGE);
  $('#toolRows').innerHTML=!S.loaded.tools?`<tr><td colspan="7" class="empty">${S.db?'A carregar ferramentas…':'Sem ligação à base de dados.'}</td></tr>`:
    rows.length?rows.map(t=>`<tr class="click" data-tool="${esc(t.id)}"><td class="code"><span class="acc">${esc(t.cod)}${pdfIcon(t,'cortante','desenho do cortante')}</span></td><td class="pos">${esc(t.pos||'—')}${t.local?`<div class="small muted" style="font-family:var(--f-sans)">${esc(t.local)}</div>`:''}</td><td>${esc(t.cli||t.ncli||'')}</td><td class="wrap">${esc(t.den||'')}${t.notas?`<div class="small muted">${esc(t.notas)}</div>`:''}</td><td class="accc">${accCell(t,'braille')}</td><td class="accc">${accCell(t,'relevo')}</td><td>${estPill(t)}${vidaTag(t)}${t.ult?`<div class="small muted mono" title="Última data" style="margin-top:3px">${fmtD(t.ult)}</div>`:''}</td></tr>`).join(''):
    `<tr><td colspan="7" class="empty">${S.tools.size?'Nenhum cortante corresponde à pesquisa.':'Ainda não há cortantes registados. Usa “+ Novo cortante” ou importa um Excel em “Importar / exportar”.'+(window.PCV_SEED&&S.canWrite?'<div style="margin-top:12px"><button class="btn pri" id="seedGo">Carregar base inicial (lista CORTANTES PCV)</button></div>':S.canWrite?'<div style="margin-top:8px">Para carregar a base inicial: <b>Importar / exportar › Repor cópia…</b> e escolher o ficheiro <span class="mono">PCV_base_inicial.json</span>.</div>':'')}</td></tr>`;
  if(typeof sync3D==='function')sync3D();
  $('#pager').innerHTML=`<span>${a.length} ${a.length===1?'cortante':'cortantes'}</span>`+(pages>1?`<button class="btn sm" data-pg="-1" ${UI.page?'':'disabled'}>‹</button><span class="mono">${UI.page+1}/${pages}</span><button class="btn sm" data-pg="1" ${UI.page<pages-1?'':'disabled'}>›</button>`:'');
}
$('#typeChips').addEventListener('click',e=>{const b=e.target.closest('[data-acc]');if(b){UI.acc=b.dataset.acc;UI.page=0;renderTools()}});
['#q','#fLocal','#fEst'].forEach(s=>$(s).addEventListener('input',()=>{UI.page=0;renderTools()}));
$('#pager').addEventListener('click',e=>{const b=e.target.closest('[data-pg]');if(b){UI.page+=+b.dataset.pg;renderTools()}});
$('#toolRows').addEventListener('click',e=>{if(e.target.closest('a'))return;const np=e.target.closest('[data-nopdf]');if(np){const t=S.tools.get(np.closest('[data-tool]').dataset.tool);if(t)openToolForm(t,{focus:np.dataset.nopdf});return}const r=e.target.closest('[data-tool]');if(r)openTool(r.dataset.tool)});
const toolCols=[['Parâmetros (máquina: pressão / velocidade)',t=>Object.entries(t.param||{}).map(([m,x])=>m+': '+(x.p||'-')+' / '+(x.v||'-')).join('; ')],['Local',t=>t.local],['Posição',t=>t.pos],['Código',t=>t.cod],['Notas',t=>t.notas],['Material',t=>t.mat],['Denominação',t=>t.den],['Observações',t=>t.obs],['Nº Cliente',t=>t.ncli],['Nome Cliente',t=>t.cli],['KAM',t=>t.kam],['Última Data',t=>fmtD(t.ult)],['Status',t=>t.dec],['Estado',t=>EST[t.est||'armazem']],['PDF Cortante',t=>t.pdf||''],['Braille',t=>t.br?'Sim':''],['Posição Braille',t=>t.br?.pos],['PDF Braille',t=>t.br?.pdf],['Relevo',t=>t.rl?'Sim':''],['Posição Relevo',t=>t.rl?.pos],['PDF Relevo',t=>t.rl?.pdf],['Atualizado',t=>fmtD(t.upd)]];
const toolsAoa=a=>[toolCols.map(c=>c[0]),...a.map(t=>toolCols.map(c=>c[1](t)??''))];
const accName=()=>({br:'Cortantes_com_Braille',rl:'Cortantes_com_Relevo'})[UI.acc]||'Cortantes';
$('#expXls').onclick=()=>exportXlsx(`${accName()}_PCV_${today()}.xlsx`,[['Cortantes',toolsAoa(filteredTools())]]);
$('#expAllXls').onclick=()=>{const all=[...S.tools.values()].sort((a,b)=>String(a.pos).localeCompare(String(b.pos),'pt',{numeric:true}));exportXlsx(`Armazem_PCV_${today()}.xlsx`,[['Cortantes',toolsAoa(all)],['Brailles',[['Cortante','Posição Braille','PDF'],...all.filter(t=>t.br).map(t=>[t.cod,t.br.pos||'',pdfUrl(t,'braille')])]],['Relevos',[['Cortante','Posição Relevo','PDF'],...all.filter(t=>t.rl).map(t=>[t.cod,t.rl.pos||'',pdfUrl(t,'relevo')])]]])};
$('#expFreeXls').onclick=()=>{const f=freePositions();exportXlsx(`Posicoes_livres_${today()}.xlsx`,[['Livres',[['Local','Posição','Nota'],...f.map(p=>[S.positions[p]?.l||'',p,S.positions[p]?.n||''])]]])};
async function toolsPdf(a,title){try{const doc=await newPdf(title,`${a.length} ferramentas · ${new Date().toLocaleString('pt-PT')}`,true);pdfTable(doc,['Código','Posição','Local','Cliente','Denominação','Braille','Relevo','Estado','Últ. data'],a.map(t=>[t.cod,t.pos||'',t.local||'',t.cli||t.ncli||'',t.den||'',t.br?(t.br.pos||'Sim'):'—',t.rl?(t.rl.pos||'Sim'):'—',EST[t.est||'armazem'],fmtD(t.ult)]),29,{columnStyles:{0:{fontStyle:'bold',cellWidth:22},1:{cellWidth:18},4:{cellWidth:78}}});pdfFooter(doc);await saveFile(title.replace(/[^\w]+/g,'_')+'_'+today()+'.pdf',doc.output('arraybuffer'))}catch(e){toast(e.message,1)}}
$('#expPdf').onclick=()=>toolsPdf(filteredTools(),accName().replace(/_/g,' ')+' – PCV');
$('#expAllPdf').onclick=()=>toolsPdf([...S.tools.values()].filter(t=>t.est!=='sucatado').sort((a,b)=>String(a.pos).localeCompare(String(b.pos),'pt',{numeric:true})),'Lista de posições – Armazém PCV');

/* ============ posições ============ */
function occupied(){const m=new Map();for(const t of S.tools.values())if(t.pos&&t.est!=='sucatado'){if(!m.has(t.pos))m.set(t.pos,[]);m.get(t.pos).push(t)}return m}
function allPositions(){const s={...S.positions};for(const t of S.tools.values())if(t.pos&&!s[t.pos])s[t.pos]={l:t.local||''};return s}
function freePositions(local){const occ=occupied();return Object.entries(allPositions()).filter(([p,v])=>!occ.has(p)&&(!local||v.l===local)&&/^[A-H]\d{3,4}$/i.test(p)).map(([p])=>p).sort((a,b)=>a.localeCompare(b,'pt',{numeric:true}))}
function renderPositions(){
  fillLocalSelect($('#posLocal'),'Todos os locais');
  const q=norm($('#posQ').value),loc=$('#posLocal').value,onlyFree=$('#posFree').checked;
  const occ=occupied(),all=allPositions();
  let hit=new Set();if(q.length>=2){for(const[p,ts]of occ)if(ts.some(t=>norm(t.cod).includes(q)))hit.add(p);for(const p of Object.keys(all))if(norm(p)===q)hit.add(p)}
  const groups={};for(const[p,v]of Object.entries(all)){const l=v.l||'Sem local';if(loc&&l!==loc)continue;if(hit.size&&!loc&&!hit.has(p)&&q.length>=2){/* mantém só grupos com resultados */}(groups[l]=groups[l]||[]).push(p)}
  let keys=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'pt',{numeric:true}));
  if(hit.size&&!loc)keys=keys.filter(k=>groups[k].some(p=>hit.has(p)));
  if(!S.loaded.tools){$('#locs').innerHTML='<p class="muted">A carregar…</p>';return}
  $('#locs').innerHTML=keys.length?keys.map(l=>{
    const ps=groups[l].sort((a,b)=>a.localeCompare(b,'pt',{numeric:true}));const f=ps.filter(p=>!occ.has(p)).length;
    const cells=ps.filter(p=>!onlyFree||!occ.has(p)).map(p=>{const ts=occ.get(p);const cls=hit.has(p)?'hit':ts?(ts.some(t=>t.est==='reparacao')?'rep':'occ'):'free';const tip=ts?ts.map(t=>t.cod+' '+(t.cli||'')).join(' / '):'Livre'+(all[p]?.n?' · '+all[p].n:'');return `<button class="cell ${cls}" data-pos="${esc(p)}" title="${esc(tip)}">${esc(p.length>8?p.slice(0,8)+'…':p)}</button>`}).join('');
    return `<div class="loc"><h4>${esc(l)} <small>${ps.length} posições · ${f} livres</small></h4><div class="cells">${cells||'<span class="small muted">Sem posições livres.</span>'}</div></div>`}).join(''):`<p class="muted">${q?'Nenhuma posição encontrada.':'Ainda não há posições registadas.'}</p>`;
  if(hit.size){const el=$('.cell.hit');el?.scrollIntoView({block:'center',behavior:'smooth'})}
  UI.hl3d=[...hit];sync3D();
}
['#posQ','#posLocal','#posFree'].forEach(s=>$(s).addEventListener('input',renderPositions));
$('#locs').addEventListener('click',e=>{const c=e.target.closest('[data-pos]');if(!c)return;const ts=occupied().get(c.dataset.pos);if(ts?.length)openTool(ts[0].id);else if(S.canWrite&&roleAtLeast('PCV'))openToolForm(null,{pos:c.dataset.pos,local:allPositions()[c.dataset.pos]?.l||''})});

/* ============ ficha da ferramenta ============ */
const ov=$('#ov'),dr=$('#drawer');
function openDrawer(html){dr.innerHTML=html;ov.hidden=false;dr.scrollTop=0;$('[data-close]',dr)?.focus()}
function closeDrawer(){ov.hidden=true;dr.innerHTML=''}
ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-close]'))closeDrawer()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden)closeDrawer()});
function openTool(id){
  const t=S.tools.get(id);if(!t)return;
  const ins=S.insp.filter(i=>i.toolId===id||i.cod===t.cod).slice(0,8);
  const kv=(k,v)=>v?`<dt>${k}</dt><dd>${v}</dd>`:'';
  openDrawer(`<div class="dh"><div class="grow"><h3>${esc(t.cod)}</h3><p>Cortante · ${estPill(t)}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="panel"><div class="row" style="align-items:baseline;gap:18px"><div><div class="small muted">Posição</div><div class="mono" style="font-size:26px;font-weight:600;color:var(--brand-ink)">${esc(t.pos||'—')}</div></div><div><div class="small muted">Local</div><div style="font-size:16px;font-weight:600">${esc(t.local||'—')}</div></div><span class="grow"></span><button class="btn sm" id="dMap">Ver no mapa</button></div></div>
  <div class="two">${accPanel(t,'braille')}${accPanel(t,'relevo')}</div>
  <div class="row w-only" data-min="PCV">
    <button class="btn" id="dMove">Mudar posição</button>
    ${t.est!=='maquina'&&t.est!=='sucatado'?'<button class="btn" id="dMaq">Saída para máquina</button>':''}
    ${t.est==='maquina'||t.est==='reparacao'?'<button class="btn" id="dBack">Regressou ao armazém</button>':''}
    ${t.est!=='reparacao'&&t.est!=='sucatado'?'<button class="btn" id="dRep">Enviar p/ reparação</button>':''}
    ${t.est!=='sucatado'?'<button class="btn danger" id="dScrap" data-min="SUPV">Sucatar</button>':''}
    <button class="btn" id="dEdit">Editar dados</button>
  </div>
  <div id="dAct"></div>
  <div class="panel stack" style="gap:8px"><div class="row"><h4 class="grow">Parâmetros ideais por máquina</h4><button class="btn sm w-only" id="dParEdit" data-min="PCV">Editar</button></div><div id="dPar">${paramTable(t)}</div></div>
  <div class="panel"><div class="row"><span class="small muted grow">Vida do cortante</span><b class="mono">${fmtN(t.folhas)}</b><span class="small muted">/ ${fmtN(vidaMax(t))} folhas${t.vidaMax?' (limite próprio)':''}</span></div>${vidaBar(t)}${(+t.folhas||0)>=vidaMax(t)?'<div class="small" style="color:var(--nok);margin-top:6px">Ultrapassou o limite de vida. Avaliar substituição ou reparação.</div>':''}</div>
  <dl class="kv panel">${kv('Material',esc(t.mat))}${kv('Denominação',esc(t.den))}${kv('Cliente',esc([t.ncli,t.cli].filter(Boolean).join(' · ')))}${kv('KAM',esc(t.kam))}${kv('Última data',fmtD(t.ult))}${kv('Notas',esc(t.notas))}${kv('Observações',esc(t.obs))}${kv('Status',esc(t.dec))}${kv('Revisão',esc(t.rev))}${kv('Atualizado',fmtD(t.upd))}</dl>
  <div class="panel stack"><div class="row"><h4 class="grow">Desenho do cortante</h4>${pdfUrl(t,'cortante')?`<a class="btn sm" href="${esc(pdfUrl(t,'cortante'))}" target="_blank" rel="noopener">${PDF_SVG} Abrir PDF</a>`:`<span class="small muted">Sem PDF associado.</span> <a class="btn sm" href="${esc(spSearch(t.cod))}" target="_blank" rel="noopener">Procurar no SharePoint</a>`}</div>${S.assets?`<label class="small w-only" data-min="PCV">Anexar PDF ou imagem do desenho <input type="file" id="dDes" accept=".pdf,image/*"></label>`:''}</div>
  <div class="panel"><h4 style="margin-bottom:6px">Controlo de qualidade PCV</h4>${ins.length?`<ul class="hist">${ins.map(i=>`<li><time>${fmtD(i.data)}</time><span>${esc(i.maq||'')} · verificado por <b>${esc(i.op||'—')}</b></span><span class="grow"></span><span class="pill ${i.res==='OK'?'p-ok':'p-nok'}">${i.res}</span></li>`).join('')}</ul>`:'<p class="small muted" style="margin:0">Sem verificações registadas.</p>'}</div>
  ${typeof exitsPanel==='function'?exitsPanel(t):''}
  <div class="panel"><h4 style="margin-bottom:6px">Histórico (entradas, saídas, reparações)</h4>${(t.hist||[]).length?`<ul class="hist">${t.hist.map(h=>`<li><time>${fmtDT(h.d)}</time><span class="grow">${esc(h.a)}${h.r?` <span class="tag">${esc(h.r)}</span>`:''}</span>${h.by?`<span class="small muted" data-uid="${esc(h.by)}"></span>`:''}</li>`).join('')}</ul>`:'<p class="small muted" style="margin:0">Sem movimentos registados na app.</p>'}</div>
  <div class="w-only" data-min="SUPV"><button class="btn danger sm" id="dDel">Eliminar registo</button></div>`);
  fillNames(dr);
  const act=$('#dAct');
  const upd=async(changes,msg)=>{const n={...t,...changes};addHist(n,msg);if(await saveTools([n])){toast(msg);openTool(id)}};
  $('#dMap').onclick=()=>{closeDrawer();UI.arm='posicoes';go('armazem');$('#posLocal').value='';$('#posQ').value=t.pos||t.cod;renderPositions();$('#r3card').scrollIntoView({block:'start',behavior:'smooth'})};
  $('#dMove')&&($('#dMove').onclick=()=>{
    const fr=freePositions(t.local);const fa=freePositions();
    act.innerHTML=`<div class="panel stack"><div class="grid-f"><label class="f"><span>Nova posição</span><input type="text" id="mvPos" list="mvList" value="${esc(fr[0]||'')}"><datalist id="mvList">${fa.slice(0,400).map(p=>`<option value="${esc(p)}">${esc(S.positions[p]?.l||'')}</option>`).join('')}</datalist></label><label class="f"><span>Local</span><input type="text" id="mvLoc" list="mvLocs" value="${esc(t.local||'')}"><datalist id="mvLocs">${locals().map(l=>`<option>${esc(l)}</option>`).join('')}</datalist></label></div>
    <div class="sugg">${fr.length?`Posições livres em ${esc(t.local)}: <b class="mono">${fr.slice(0,8).join(', ')}</b>${fr.length>8?' …':''}`:'Não há posições livres neste local; escolhe outra da lista.'}</div><div id="mvWarn"></div><div class="row"><button class="btn pri" id="mvOk">Confirmar mudança</button><button class="btn" id="mvNo">Cancelar</button></div></div>`;
    const chk=()=>{const p=$('#mvPos').value.trim().toUpperCase();const o=occupied().get(p)?.filter(x=>x.id!==id);$('#mvWarn').innerHTML=o?.length?`<div class="banner" style="margin:0">A posição ${esc(p)} está ocupada por ${o.map(x=>esc(x.cod)).join(', ')}.</div>`:'';const l=allPositions()[p]?.l;if(l)$('#mvLoc').value=l};
    $('#mvPos').oninput=chk;chk();$('#mvNo').onclick=()=>act.innerHTML='';
    $('#mvOk').onclick=()=>{const p=$('#mvPos').value.trim().toUpperCase();if(!p){toast('Indica a nova posição.',1);return}upd({pos:p,local:$('#mvLoc').value.trim(),est:t.est==='sucatado'?'armazem':(t.est||'armazem')},`Mudou de ${t.pos||'—'} para ${p}`)};
  });
  $('#dMaq')&&($('#dMaq').onclick=()=>{act.innerHTML=`<div class="panel row"><label class="f grow"><span>Máquina</span><input type="text" id="mqN" list="maqList"></label><button class="btn pri" id="mqOk" style="margin-top:18px">Registar saída</button></div>`;$('#mqOk').onclick=()=>upd({est:'maquina',maq:$('#mqN').value.trim()},'Saída para máquina '+($('#mqN').value.trim()||''))});
  $('#dBack')&&($('#dBack').onclick=()=>upd({est:'armazem',maq:'',repDesde:null,repMot:null,repOrig:null},'Regressou ao armazém ('+(t.pos||'sem posição')+')'));
  $('#dRep')&&($('#dRep').onclick=()=>{act.innerHTML=`<div class="panel row"><label class="f grow"><span>Motivo</span><input type="text" id="rpM" placeholder="ex.: lâmina partida"></label><button class="btn pri" id="rpOk" style="margin-top:18px">Enviar</button></div>`;$('#rpOk').onclick=()=>upd({est:'reparacao',repDesde:today(),repMot:$('#rpM').value.trim(),repOrig:'Manual'},'Enviado para reparação'+($('#rpM').value.trim()?': '+$('#rpM').value.trim():''))});
  $('#dScrap')&&($('#dScrap').onclick=()=>{if(!roleAtLeast('SUPV'))return;act.innerHTML=`<div class="confirm"><span class="grow">Sucatar <b>${esc(t.cod)}</b> e libertar a posição <b>${esc(t.pos||'—')}</b>?</span><button class="btn danger" id="scOk">Sim, sucatar</button><button class="btn" id="scNo">Cancelar</button></div>`;$('#scNo').onclick=()=>act.innerHTML='';$('#scOk').onclick=()=>upd({est:'sucatado',posAnt:t.pos||'',pos:''},'Sucatado; posição '+(t.pos||'—')+' libertada')});
  $('#dEdit')&&($('#dEdit').onclick=()=>openToolForm(t));
  $('#dParEdit')&&($('#dParEdit').onclick=()=>{const P=t.param||{};
    $('#dPar').innerHTML=`<div class="tw"><table class="t"><thead><tr><th>Máquina</th><th>Pressão</th><th>Velocidade</th><th>Nota</th></tr></thead><tbody>${machines().map(m=>`<tr><td class="code">${esc(m)}</td><td><input type="text" data-pm="${esc(m)}" data-pk="p" value="${esc(P[m]?.p||'')}" placeholder="ex.: 180 t"></td><td><input type="text" data-pm="${esc(m)}" data-pk="v" value="${esc(P[m]?.v||'')}" placeholder="ex.: 6500 f/h"></td><td><input type="text" data-pm="${esc(m)}" data-pk="n" value="${esc(P[m]?.n||'')}" placeholder="opcional"></td></tr>`).join('')}</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn pri sm" id="dParSave">Guardar parâmetros</button><button class="btn sm" id="dParNo">Cancelar</button></div>`;
    $('#dParNo').onclick=()=>{$('#dPar').innerHTML=paramTable(t)};
    $('#dParSave').onclick=()=>{const np={};$$('[data-pm]',dr).forEach(i=>{const v=i.value.trim();if(!v)return;(np[i.dataset.pm]=np[i.dataset.pm]||{})[i.dataset.pk]=v});upd({param:np},'Parâmetros de máquina atualizados')}});
  $$('[data-accedit]',dr).forEach(b=>b.onclick=()=>openToolForm(t,{focus:b.dataset.accedit}));
  $('#dDel')&&($('#dDel').onclick=()=>{act.innerHTML=`<div class="confirm"><span class="grow">Eliminar definitivamente o registo de <b>${esc(t.cod)}</b>? Para ferramentas destruídas usa “Sucatar”.</span><button class="btn danger" id="delOk">Eliminar</button><button class="btn" id="delNo">Cancelar</button></div>`;act.scrollIntoView({block:'center'});$('#delNo').onclick=()=>act.innerHTML='';$('#delOk').onclick=()=>{deleteTool(id);closeDrawer()}});
  $('#dDes')&&($('#dDes').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{toast('A carregar desenho…');const r=await S.assets.upload(f);await upd({desenho:{id:r.id,nome:f.name}},'Desenho anexado: '+f.name)}catch(err){toast('Não foi possível anexar: '+(err.message||err.code),1)}});
}
function paramTable(t){const P=t.param||{};const ms=[...new Set([...machines(),...Object.keys(P)])].filter(m=>P[m]);
  return ms.length?`<div class="tw"><table class="t"><thead><tr><th>Máquina</th><th>Pressão</th><th>Velocidade</th><th>Nota</th></tr></thead><tbody>${ms.map(m=>`<tr><td class="code">${esc(m)}</td><td class="mono">${esc(P[m].p||'—')}</td><td class="mono">${esc(P[m].v||'—')}</td><td class="small">${esc(P[m].n||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted" style="margin:0">Sem parâmetros registados. Usa “Editar” para indicar a pressão e a velocidade ideais em cada máquina.</p>'}
function accPanel(t,kind){const k=kind==='braille'?'br':'rl',it=t[k],L=kind==='braille'?'Braille':'Relevo';
  if(!it)return `<div class="panel acc-p off"><div class="small muted">${L}</div><div class="muted">Sem ${L.toLowerCase()}</div><button class="btn sm w-only" data-min="PCV" data-accedit="${k}">+ Associar ${L.toLowerCase()}</button></div>`;
  const u=pdfUrl(t,kind);
  return `<div class="panel acc-p"><div class="row"><span class="small muted grow">${L}</span>${u?`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">${PDF_SVG} PDF</a>`:''}</div><div class="mono" style="font-size:20px;font-weight:600;color:var(--brand-ink)">${esc(it.pos||'Posição a definir')}</div>${it.local?`<div class="small">${esc(it.local)}</div>`:''}${it.nota?`<div class="small muted">${esc(it.nota)}</div>`:''}<button class="btn sm w-only" data-min="PCV" data-accedit="${k}">Editar ${L.toLowerCase()}</button></div>`}
function openToolForm(t,preIn){
  const {onSaved,focus,...pre}=preIn||{};
  const n=t?JSON.parse(JSON.stringify(t)):{tipo:'cortante',est:'armazem',...pre};
  for(const k in n)if(n[k]===''||n[k]==null)delete n[k];
  if(!t&&!n.pos){const f=freePositions(n.local);n.pos=f[0]||''}
  const F=(k,l,ph,span)=>`<label class="f"${span?' style="grid-column:1/-1"':''}><span>${l}</span><input type="text" data-k="${k}" value="${esc(n[k]||'')}" placeholder="${esc(ph||'')}"${k==='pos'?' list="nfPos"':''}${k==='local'?' list="nfLoc"':''}></label>`;
  openDrawer(`<div class="dh"><div class="grow"><h3 style="font-family:var(--f-sans)">${t?'Editar '+esc(t.cod):'Novo cortante'}</h3><p>${t?'Altera os dados e guarda.':'Regista a entrada de um cortante no armazém, com Braille e relevo se tiver.'}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="panel stack"><div class="grid-f">
   ${F('cod','Código *','ex.: S3601A')}${F('pos','Posição','ex.: A0123')}${F('local','Local','ex.: A - Piso 2')}
   <label class="f" data-min="SUPV"><span>Folhas acumuladas</span><input type="number" data-k="folhas" value="${esc(n.folhas||'')}" min="0"></label>
   <label class="f" data-min="SUPV"><span>Limite de vida próprio (folhas)</span><input type="number" data-k="vidaMax" value="${esc(n.vidaMax||'')}" min="1000" step="1000" placeholder="padrão ${fmtN(vidaMax())}"></label>
   ${F('mat','Material SAP')}${F('ncli','Nº cliente')}${F('cli','Nome cliente')}${F('kam','KAM')}
   <label class="f"><span>Última data</span><input type="date" data-k="ult" value="${esc(n.ult||'')}"></label>
   <label class="f"><span>Status</span><select data-k="dec"><option value="">—</option><option ${n.dec==='Manter'?'selected':''}>Manter</option><option ${n.dec==='Sucatar'?'selected':''}>Sucatar</option></select></label>
   ${F('den','Denominação','',1)}${F('notas','Notas','',1)}${F('obs','Observações','',1)}
   ${F('pdf','Link do PDF do cortante (SharePoint)','https://…sharepoint.com/…/S3601A.pdf',1)}
  </div>
  ${['br','rl'].map(k=>{const L=k==='br'?'Braille':'Relevo',it=n[k]||{};return `<fieldset class="accf" id="af-${k}"><legend><label class="row" style="gap:6px"><input type="checkbox" data-has="${k}" ${n[k]?'checked':''}> Este cortante tem ${L.toLowerCase()}</label></legend><div class="grid-f" ${n[k]?'':'hidden'}>
    <label class="f"><span>Posição do ${L.toLowerCase()}</span><input type="text" data-a="${k}.pos" value="${esc(it.pos||'')}" placeholder="a definir"></label>
    <label class="f"><span>Local</span><input type="text" data-a="${k}.local" value="${esc(it.local||'')}"></label>
    <label class="f" style="grid-column:1/-1"><span>Link do PDF do ${L.toLowerCase()} (SharePoint)</span><input type="text" data-a="${k}.pdf" value="${esc(it.pdf||'')}" placeholder="https://…"></label>
    <label class="f" style="grid-column:1/-1"><span>Nota</span><input type="text" data-a="${k}.nota" value="${esc(it.nota||'')}"></label></div></fieldset>`}).join('')}<datalist id="nfPos">${freePositions().slice(0,400).map(p=>`<option value="${esc(p)}">${esc(S.positions[p]?.l||'')}</option>`).join('')}</datalist><datalist id="nfLoc">${locals().map(l=>`<option>${esc(l)}</option>`).join('')}</datalist>
  <div id="nfWarn"></div><div class="row"><button class="btn pri" id="nfSave">${t?'Guardar alterações':'Registar entrada'}</button><button class="btn" data-close>Cancelar</button></div></div>`);
  const chk=()=>{const p=$('[data-k=pos]',dr).value.trim().toUpperCase();const o=occupied().get(p)?.filter(x=>!t||x.id!==t.id);$('#nfWarn').innerHTML=o?.length?`<div class="banner" style="margin:0">Atenção: a posição ${esc(p)} já tem ${o.map(x=>esc(x.cod)).join(', ')}.</div>`:'';const l=allPositions()[p]?.l;if(l&&!$('[data-k=local]',dr).value)$('[data-k=local]',dr).value=l};
  $('[data-k=pos]',dr).oninput=chk;chk();
  $$('[data-has]',dr).forEach(c=>c.onchange=()=>{c.closest('fieldset').querySelector('.grid-f').hidden=!c.checked});
  if(focus==='pdf'){const i=$('[data-k=pdf]',dr);i.scrollIntoView({block:'center'});i.focus()}
  else if(focus){const fk=focus.split('.')[0];const c=$(`[data-has="${fk}"]`,dr);if(c&&!c.checked){c.checked=true;c.onchange()}$('#af-'+fk).scrollIntoView({block:'center'});$(`[data-a="${focus.includes('.')?focus:fk+'.pos'}"]`,dr)?.focus()}
  if(false){const c=$(`[data-has="${focus}"]`,dr);if(c&&!c.checked){c.checked=true;c.onchange()}$('#af-'+focus).scrollIntoView({block:'center'});$(`[data-a="${focus}.pos"]`,dr)?.focus()}
  $('#nfSave').onclick=async()=>{
    const o={...n};$$('[data-k]',dr).forEach(i=>{const v=i.value.trim();if(v)o[i.dataset.k]=v;else delete o[i.dataset.k]});if(o.folhas)o.folhas=Math.max(0,Math.round(+o.folhas)||0);if(o.vidaMax)o.vidaMax=Math.max(1000,Math.round(+o.vidaMax)||0);
    for(const k of ['br','rl']){if($(`[data-has="${k}"]`,dr).checked){const it={};$$(`[data-a^="${k}."]`,dr).forEach(i=>{const v=i.value.trim();if(v)it[i.dataset.a.split('.')[1]]=k&&i.dataset.a.endsWith('.pos')?v.toUpperCase():v});o[k]=it}else delete o[k]}
    if(!o.cod){toast('O código é obrigatório.',1);return}o.cod=o.cod.toUpperCase();if(o.pos)o.pos=o.pos.toUpperCase();
    if(!t){o.id=safeId(o.cod)+(S.tools.has(safeId(o.cod))?'-'+uid().slice(-4):'');o.est='armazem';addHist(o,'Entrada no armazém'+(o.pos?' em '+o.pos:''))}else addHist(o,'Dados editados');
    if(o.pos&&!S.positions[o.pos])registerPositions({[o.pos]:{l:o.local||''}});
    if(await saveTools([o])){toast(t?'Alterações guardadas.':'Ferramenta registada.');openTool(o.id);if(onSaved)onSaved(o)}
  };
}
$('#newTool').onclick=()=>openToolForm(null);
async function registerPositions(map){if(!S.db||!S.canWrite||!Object.keys(map).length)return;Object.assign(S.positions,map);try{await serial('config/positions',()=>S.posV?S.db.doc('config/positions').update({items:map}):S.db.doc('config/positions').set({items:{...S.positions}}));S.posV=true}catch(e){toast(dbErr(e),1)}}

function codesIn(name){const u=String(name).toUpperCase();const out=new Set();(u.match(/[A-Z]\d{4,5}[A-Z]?/g)||[]).forEach(c=>{if(S.byCod.has(c))out.add(c)});return [...out]}
async function readLinkList(){
  const kind=$('#lnkKind').value,base=folderOf(kind);
  if(!base){toast('Indica e guarda primeiro a pasta do SharePoint deste tipo.',1);return}
  let text=$('#lnkList').value;const f=$('#lnkFile').files[0];
  if(f){const sh=await readSheet(f);text+='\n'+sh.map(s=>s.rows.map(r=>r.join('\t')).join('\n')).join('\n')}
  const names=new Set();for(const line of text.split(/\r?\n|\t/)){const m=line.trim().match(/^(?:.*[\/\\])?([^\/\\]+?\.pdf)$/i);if(m)names.add(m[1].trim())}
  if(!names.size){$('#lnkPrev').innerHTML='<div class="banner" style="margin:0">Não encontrei nomes de ficheiros .pdf no texto colado.</div>';return}
  S.byCod=new Map();for(const t of S.tools.values())if(t.est!=='sucatado'){const k=baseCod(t.cod);if(!S.byCod.has(k))S.byCod.set(k,[]);S.byCod.get(k).push(t)}
  const upd=new Map(),orphans=[];let n=0;
  for(const nm of names){const cs=codesIn(nm);if(!cs.length){orphans.push(nm);continue}n++;
    for(const c of cs)for(const t of S.byCod.get(c)){const x=upd.get(t.id)||JSON.parse(JSON.stringify(t));const url=base+encodeURIComponent(nm);
      if(kind==='cortante')x.pdf=url;else{const k=kind==='braille'?'br':'rl';x[k]={...(x[k]||{}),pdf:url}}upd.set(t.id,x)}}
  const list=[...upd.values()];
  $('#lnkPrev').innerHTML=`<div class="confirm"><span class="grow"><b>${names.size}</b> PDFs lidos · <b>${list.length}</b> cortantes vão ficar com link${orphans.length?` · <span style="color:var(--nok)">${orphans.length} sem código reconhecido: ${esc(orphans.slice(0,6).join(', '))}${orphans.length>6?'…':''}</span>`:''}</span><button class="btn pri" id="lnkGo" ${list.length?'':'disabled'}>Associar</button></div>`;
  $('#lnkGo').onclick=async()=>{$('#lnkGo').disabled=true;list.forEach(x=>addHist(x,'PDF '+kind+' associado do SharePoint'));let ok=true;for(let i=0;i<list.length&&ok;i+=300)ok=await saveTools(list.slice(i,i+300));if(ok){toast(list.length+' cortantes com PDF associado.');$('#lnkPrev').innerHTML='';$('#lnkList').value='';$('#lnkFile').value=''}};
}
$('#lnkRead').onclick=()=>readLinkList().catch(e=>toast('Não consegui ler a lista: '+e.message,1));
$('#lnkSave').onclick=async()=>{if(!needDb())return;const v={cortante:$('#lnkC').value.trim(),braille:$('#lnkB').value.trim(),relevo:$('#lnkR').value.trim()};
  if(Object.values(v).some(x=>x&&!/^https?:\/\//i.test(x))){toast('Os endereços têm de começar por https://',1);return}
  try{await serial('config/links',()=>S.db.doc('config/links').set(v));toast('Ligações guardadas.')}catch(e){toast(dbErr(e),1)}};
/* ============ sucata ============ */
let scrapList=null;
function renderScrapMarked(){if(!scrapList)$('#scrapPrev').innerHTML=''}
function showScrap(found,missing,src){
  scrapList=found;
  $('#scrapPrev').innerHTML=`<div class="stack"><p class="small" style="margin:0"><b>${found.length}</b> ferramentas encontradas${missing.length?` · <span style="color:var(--nok)">${missing.length} códigos não encontrados: ${esc(missing.slice(0,20).join(', '))}${missing.length>20?'…':''}</span>`:''} <span class="muted">(${esc(src)})</span></p>
  ${found.length?`<div class="tw"><table class="t"><thead><tr><th><input type="checkbox" id="scAll" checked aria-label="Todas"></th><th>Código</th><th>Posição</th><th>Local</th><th>Cliente</th><th>Estado</th></tr></thead><tbody>${found.map((t,i)=>`<tr><td><input type="checkbox" data-sc="${i}" checked></td><td class="code">${esc(t.cod)}</td><td class="pos">${esc(t.pos||'—')}</td><td>${esc(t.local||'')}</td><td>${esc(t.cli||'')}</td><td>${estPill(t)}</td></tr>`).join('')}</tbody></table></div>
  <div class="confirm"><span class="grow">Confirmar a retirada física destas ferramentas. Ficam marcadas como sucatadas e as posições são libertadas.</span><button class="btn danger" id="scGo">Confirmar retirada e libertar posições</button></div>`:''}</div>`;
  $('#scAll')&&($('#scAll').onchange=e=>$$('[data-sc]').forEach(c=>c.checked=e.target.checked));
  $('#scGo')&&($('#scGo').onclick=async()=>{const sel=$$('[data-sc]').filter(c=>c.checked).map(c=>scrapList[+c.dataset.sc]);if(!sel.length)return;const up=sel.map(t=>{const n={...t,est:'sucatado',posAnt:t.pos||'',pos:''};addHist(n,'Sucatado; posição '+(t.pos||'—')+' libertada');return n});if(await saveTools(up)){toast(up.length+' ferramentas sucatadas; posições libertadas.');scrapList=null;$('#scrapPrev').innerHTML=''}});
}
$('#scrapFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{
  const sh=await readSheet(f);const codes=new Set();
  for(const s of sh)for(const r of s.rows)for(const c of r){const m=String(c).toUpperCase().match(/\b[A-Z]\d{3,5}[A-Z]?\b/g);if(m)m.forEach(x=>codes.add(x))}
  const found=[],missing=[];for(const c of codes){const ts=[...S.tools.values()].filter(t=>t.cod===c&&t.est!=='sucatado');if(ts.length)found.push(...ts);else missing.push(c)}
  showScrap(found,missing,f.name);}catch(err){toast('Não consegui ler o ficheiro: '+err.message,1)}e.target.value=''};
$('#scrapMarked').onclick=()=>showScrap([...S.tools.values()].filter(t=>t.dec==='Sucatar'&&t.est!=='sucatado'),[],'marcadas com Status “Sucatar”');

/* ============ importação do armazém ============ */
const normPos=p=>/^[a-h]\d{3,4}$/i.test(p)?p.toUpperCase():p;
function normLoc(v){const m=v.match(/^A\s*-?\s*Piso\s*(\d)$/i);if(m)return 'A - Piso '+m[1];if(/^Piso\s*1$/i.test(v))return 'A - Piso 1';if(/^cx/i.test(v))return 'Caixotes';if(v==='zChão')return 'Chão';return v}
const IMP_TESTS={bpos:/posi.*braille|braille.*posi/,rpos:/posi.*relevo|relevo.*posi/,bpdf:/pdf.*braille|braille.*pdf/,rpdf:/pdf.*relevo|relevo.*pdf/,braille:/^braille/,relevo:/^relevo/,cpdf:/pdf|link|sharepoint/,local:/^local/,pos:/posi/,cod:/codigo|cortante|^cod/,notas:/^notas?$/,mat:/^material/,den:/denomina|descri/,obs:/observa/,ncli:/n.? ?(de )?1? ?cliente|^n.*cliente/,cli:/nome cliente|^cliente/,kam:/^kam/,ult:/ultima|data/,dec:/^status$/,rev:/status .+/};
$('#impFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;e.target.value='';
  try{const sh=await readSheet(f);let best=null;
    for(const s of sh){const h=findHeader(s.rows,IMP_TESTS,3);if(h&&'cod' in h.map){best={...h,rows:s.rows};break}}
    if(!best){$('#impPrev').innerHTML='<div class="banner" style="margin:0">Não encontrei a linha de cabeçalho com “Código” e “Posição”. Confirma que o Excel tem esses títulos.</div>';return}
    const tipo='cortante';const recs=[],pos={};const yes=v=>v&&!/^(nao|não|n|no|0|-|—)$/i.test(v);
    for(const r of best.rows.slice(best.row+1)){const g=k=>k in best.map?cellStr(r[best.map[k]]):'';const cod=g('cod').toUpperCase(),p=normPos(g('pos')),l=normLoc(g('local'));
      if(p&&!S.positions[p])pos[p]={l};if(!cod)continue;
      const o={tipo,cod,pos:p,local:l,notas:g('notas'),mat:g('mat'),den:g('den'),obs:g('obs'),ncli:g('ncli'),cli:g('cli'),kam:g('kam'),ult:g('ult'),dec:['Manter','Sucatar'].includes(g('dec'))?g('dec'):'',rev:g('rev')};
      if(g('cpdf'))o.pdf=g('cpdf');
      if(yes(g('braille'))||g('bpos')){o.br={pos:g('bpos').toUpperCase(),pdf:g('bpdf')};for(const k in o.br)if(!o.br[k])delete o.br[k]}
      if(yes(g('relevo'))||g('rpos')){o.rl={pos:g('rpos').toUpperCase(),pdf:g('rpdf')};for(const k in o.rl)if(!o.rl[k])delete o.rl[k]}
      for(const k in o)if(!o[k])delete o[k];recs.push(o)}
    const byKey=new Map();for(const t of S.tools.values())byKey.set((t.tipo||'cortante')+'|'+t.cod+'|'+norm(t.pos||''),t);
    const ups=[],news=[];for(const o of recs){const ex=byKey.get(tipo+'|'+o.cod+'|'+norm(o.pos||''));if(ex){const n={...ex,...o};if(JSON.stringify(n)!==JSON.stringify(ex)){addHist(n,'Atualizado por importação');ups.push(n)}}else{const n={...o,id:safeId(o.cod)+'-'+uid().slice(-5),est:'armazem'};addHist(n,'Importado de '+f.name);news.push(n)}}
    $('#impPrev').innerHTML=`<div class="confirm"><span class="grow"><b>${news.length}</b> novas · <b>${ups.length}</b> atualizadas · ${recs.length-news.length-ups.length} sem alterações · ${Object.keys(pos).length} posições novas</span><button class="btn pri" id="impGo" ${news.length+ups.length+Object.keys(pos).length?'':'disabled'}>Importar</button></div>`;
    $('#impGo').onclick=async()=>{$('#impGo').disabled=true;await registerPositions(pos);const all=[...ups,...news];let ok=true;for(let i=0;i<all.length&&ok;i+=300)ok=await saveTools(all.slice(i,i+300));if(ok){toast('Importação concluída.');$('#impPrev').innerHTML=''}};
  }catch(err){toast('Não consegui ler o ficheiro: '+err.message,1)}};

/* ============ pedidos de compra ============ */
const ORD_TESTS={num:/pedido|doc.*compra|purch|^po$|n.? ?doc|documento/,data:/^data|date|dt\.? ?doc/,forn:/fornec|vendor|supplier|credor/,mat:/^material|^mat\b|artigo|cod/,desc:/descri|texto|short text|denomina/,qtd:/quant|qtd|qty/,un:/^un|unid|uom|umb|^um$/,preco:/pre[cç]o|net price|valor|price/,entrega:/entrega|delivery/};
const toolCode=s=>{const m=String(s||'').toUpperCase().replace(/_/g,' ').match(/(?<![A-Z0-9])([SBRF]\d{4}[A-Z])(?=M\d{2}|[^A-Z0-9]|$)/);return m?m[1]:''};
/* tabela do SAP sem cabeçalho (ex.: ME2N copiado): Pedido | Data | Material | Texto breve | Quantidade …
   a data só aparece na 1.ª linha de cada dia, por isso é herdada da linha anterior */
const isOrdNum=x=>/^4\d{9}$/.test(x);
const isDate=x=>/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(x)||/^\d{4}-\d{2}-\d{2}$/.test(x);
const isQty=x=>/^-?\d{1,3}([.\s]\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/.test(x);
function sapRows(rows){
  const out=[];let lastNum='',lastDate='';
  for(const raw of rows){const c=raw.map(x=>cellStr(x));if(!c.some(Boolean))continue;
    let ni=c.findIndex(isOrdNum);let num=ni>=0?c[ni]:'';
    const di=c.findIndex(isDate);let data=di>=0?toIsoDate(c[di]):'';
    const start=Math.max(ni,di);
    const mi=c.findIndex((x,i)=>i>start&&/^\d{6,12}$/.test(x));
    const ti=c.findIndex((x,i)=>i>Math.max(start,mi)&&/[A-Za-zÀ-ÿ]/.test(x));
    if(ti<0)continue;
    if(!num){if(!lastNum)continue;num=lastNum}
    if(!data&&num===lastNum)data=lastDate;if(!data)data=lastDate;
    const qi=c.findIndex((x,i)=>i>ti&&isQty(x));
    const un=c.find((x,i)=>i>ti&&/^(UN|PC|PÇ|EA|ST|KG|M|M2|ROL|CX|UNI)$/i.test(x))||'';
    out.push({num,data,forn:'',mat:mi>=0?c[mi]:'',desc:c[ti],qtd:qi>=0?numVal(c[qi]):'',un:un.toUpperCase(),preco:'',entrega:''});
    lastNum=num;if(data)lastDate=data;
  }
  return out.length?out:null;
}
const numVal=v=>{if(typeof v==='number')return v;const s=String(v||'').replace(/\s/g,'');if(!s)return '';const n=+(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return isNaN(n)?String(v):n};
function rowsToOrders(rows,src){
  const h=findHeader(rows,ORD_TESTS,2);if(!h||!('desc' in h.map||'mat' in h.map))return null;
  const out=[];for(const r of rows.slice(h.row+1)){const g=k=>k in h.map?cellStr(r[h.map[k]]):'';if(!g('desc')&&!g('mat'))continue;
    out.push({num:g('num'),data:toIsoDate(g('data')),forn:g('forn'),mat:g('mat'),desc:g('desc'),qtd:numVal(g('qtd')),un:g('un'),preco:numVal(g('preco')),entrega:toIsoDate(g('entrega'))})}
  return out.length?out:null;
}
function toIsoDate(s){if(!s)return '';const m=String(s).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);if(m)return (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');const m2=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m2)return m2[0];if(/^\d{5}$/.test(s)){const d=new Date(Math.round((+s-25569)*864e5));return d.toISOString().slice(0,10)}return s}
const AI_PROMPT=`És um assistente de compras de uma fábrica de cartão (setor de pré-corte e vinco). Extrai TODAS as linhas de pedidos de compra do conteúdo abaixo (pode ser texto de um PDF, uma tabela do SAP ou uma imagem de ecrã do SAP).
Responde só com JSON neste formato:
{"linhas":[{"num":"4500012345","data":"2026-10-13","forn":"Nome do fornecedor","mat":"130010561","desc":"Descrição do material","qtd":1,"un":"UN","preco":123.45,"entrega":"2026-10-20"}]}
Regras: "num" é o número do pedido de compra (documento de compra, 10 dígitos começados por 41, 42 ou 45), normalmente na 1.ª coluna; repete-o em cada linha. Numa lista do SAP sem cabeçalho as colunas costumam ser: Pedido | Data | Material | Texto breve | Quantidade; a data só aparece na primeira linha de cada dia e aplica-se às linhas seguintes até aparecer outra. O material é o número de 9-10 dígitos a seguir à data (não confundir com o nº do pedido). Quantidades do SAP como "1,000" significam 1. Datas em AAAA-MM-DD. Números com ponto decimal. Campos desconhecidos ficam "". Não inventes linhas.`;
let ordDraft=null;
function setOrdStatus(html){$('#ordPrev').innerHTML=html}
async function aiExtract(text,images,src){
  if(!S.sample){throw new Error(images?'Esta versão não consegue ler imagens (prints). No SAP, seleciona as linhas da lista e copia com Ctrl + C (ou exporta para Excel) e cola aqui com Ctrl + V.':'A leitura automática (Claude) não está disponível nesta versão. Exporta a lista do SAP para Excel e arrasta o ficheiro para aqui.')}
  setOrdStatus(`<div class="panel progress"><span class="spin"></span> A ler ${esc(src)} com o Claude…</div>`);
  const res=await S.sample.json(AI_PROMPT+(text?'\n\nCONTEÚDO:\n'+text.slice(0,60000):'\n\nO conteúdo está na imagem anexada.'),{images:images||undefined,modelTier:'default'});
  return Array.isArray(res?.linhas)?res.linhas.map(l=>({num:String(l.num||''),data:toIsoDate(l.data||''),forn:l.forn||'',mat:String(l.mat||''),desc:l.desc||'',qtd:numVal(l.qtd),un:l.un||'',preco:numVal(l.preco),entrega:toIsoDate(l.entrega||'')})):[];
}
function regexParse(t){const out=[];const num=(t.match(/\b4[25]\d{8}\b/)||[''])[0];t.split(/\r?\n/).forEach(l=>{const m=l.match(/(\d{9})\s+(.+?)\s+(\d+[,.]?\d*)\s*(UN|EA|PC|ST|KG|M2?)\b/i);if(m)out.push({num,data:'',forn:'',mat:m[1],desc:m[2].trim(),qtd:numVal(m[3]),un:m[4].toUpperCase(),preco:'',entrega:''})});return out}
async function pdfText(file){
  await LIB.pdf();const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;let out='';
  for(let p=1;p<=Math.min(pdf.numPages,30);p++){const c=await (await pdf.getPage(p)).getTextContent();const lines={};for(const it of c.items){const y=Math.round(it.transform[5]/3);(lines[y]=lines[y]||[]).push({x:it.transform[4],s:it.str})}
    out+=Object.keys(lines).sort((a,b)=>b-a).map(y=>lines[y].sort((a,b)=>a.x-b.x).map(i=>i.s).join('  ')).join('\n')+'\n\n'}
  return out;
}
async function handleOrderInput(kind,payload,src){
  try{let lines=null;
    if(kind==='sheet'){const sh=await readSheet(payload);for(const s of sh){lines=rowsToOrders(s.rows,src)||sapRows(s.rows);if(lines)break}
      if(!lines){const txt=sh.map(s=>s.rows.map(r=>r.join('\t')).join('\n')).join('\n\n');lines=await aiExtract(txt,null,src)}}
    else if(kind==='text'){const rows=payload.split(/\r?\n/).map(l=>l.split('\t'));lines=rows.some(r=>r.length>2)?(rowsToOrders(rows,src)||sapRows(rows)):null;if(!lines){try{lines=await aiExtract(payload,null,src)}catch(e){lines=regexParse(payload);if(!lines.length)throw e}}}
    else if(kind==='pdf'){setOrdStatus(`<div class="panel progress"><span class="spin"></span> A extrair texto de ${esc(src)}…</div>`);const txt=await pdfText(payload);
      if(txt.replace(/\s/g,'').length<40){lines=await aiExtract('',[payload],src)}else{try{lines=await aiExtract(txt,null,src)}catch(e){lines=sapRows(txt.split(/\n/).map(l=>l.split(/\s{2,}/)))||regexParse(txt);if(!lines||!lines.length)throw e}}}
    else if(kind==='image'){try{lines=await aiExtract('',[payload],src)}catch(e){throw new Error(e?.code==='not_granted'?'A leitura de imagens não foi autorizada. Autoriza o Claude quando a app pedir, ou copia as linhas no SAP (Ctrl + C) e cola aqui.':(e.message||String(e)))}}
    if(!lines||!lines.length){setOrdStatus(`<div class="banner" style="margin:0">Não encontrei linhas de pedido em ${esc(src)}. Experimenta copiar a tabela do SAP e colar aqui (Ctrl + V).</div>`);return}
    const lastNum=lines.find(l=>l.num)?.num||'';lines.forEach(l=>{if(!l.num)l.num=lastNum;l.cod=toolCode(l.desc)||toolCode(l.mat)});
    ordDraft={src,lines:(ordDraft&&ordDraft.lines.length?[...ordDraft.lines,...lines]:lines)};renderDraft();
  }catch(e){setOrdStatus(`<div class="banner" style="margin:0">${esc(e.message||e.code||String(e))}</div>`)}
}
function renderDraft(){
  if(!ordDraft){setOrdStatus('');return}
  const L=ordDraft.lines;const cols=[['num','Nº pedido',110],['data','Data',110],['forn','Fornecedor',150],['mat','Material',110],['desc','Descrição',260],['qtd','Qtd',60],['un','Un',50],['preco','Preço',80],['entrega','Entrega',110]];
  setOrdStatus(`<div class="panel stack"><div class="row"><h3 class="grow" style="font-size:16px">Rever antes de guardar <span class="muted small">· ${L.length} linhas de ${esc(ordDraft.src)}</span></h3><button class="btn sm" id="drAdd">+ Linha</button></div>
  <div class="tw"><table class="t"><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${L.map((l,i)=>`<tr>${cols.map(([k,,w])=>`<td><input data-dr="${i}" data-k="${k}" value="${esc(l[k]??'')}" style="min-width:${w}px"></td>`).join('')}<td><button class="btn sm danger" data-drdel="${i}" aria-label="Remover">✕</button></td></tr>`).join('')}</tbody></table></div>
  <div class="row"><button class="btn pri" id="drSave">Guardar ${new Set(L.map(l=>l.num||'?')).size} pedido(s)</button><button class="btn" id="drXls">Exportar só esta tabela</button><button class="btn" id="drCancel">Descartar</button></div></div>`);
  $('#ordPrev').oninput=e=>{const i=e.target.dataset.dr;if(i!=null)ordDraft.lines[+i][e.target.dataset.k]=e.target.value};
  $('#ordPrev').onclick=e=>{const d=e.target.closest('[data-drdel]');if(d){ordDraft.lines.splice(+d.dataset.drdel,1);renderDraft()}};
  $('#drAdd').onclick=()=>{ordDraft.lines.push({num:L[L.length-1]?.num||'',data:today()});renderDraft()};
  $('#drCancel').onclick=()=>{ordDraft=null;renderDraft()};
  $('#drXls').onclick=()=>exportXlsx('Pedido_'+today()+'.xlsx',[['Pedido',[cols.map(c=>c[1]),...L.map(l=>cols.map(c=>l[c[0]]??''))]]]);
  $('#drSave').onclick=saveDraft;
}
async function saveDraft(){
  if(!needDb())return;const groups={};
  for(const l of ordDraft.lines){const k=String(l.num||'').trim()||('SEM-'+today());(groups[k]=groups[k]||[]).push(l)}
  try{for(const[num,ls]of Object.entries(groups)){
    const id=safeId(num);const ex=S.orders.find(o=>o._id===id);
    const clean=ls.map(l=>{const o={mat:String(l.mat||''),desc:l.desc||'',qtd:numVal(l.qtd),un:l.un||'',preco:numVal(l.preco),entrega:toIsoDate(l.entrega||''),cod:toolCode(l.desc)||toolCode(l.mat)};for(const k in o)if(o[k]===''||o[k]==null)delete o[k];return o});
    const head={num,data:toIsoDate(ls.find(l=>l.data)?.data||'')||today(),forn:ls.find(l=>l.forn)?.forn||''};
    if(ex){const seen=new Set((ex.linhas||[]).map(l=>(l.mat||'')+'|'+(l.desc||'')));const add=clean.filter(l=>!seen.has((l.mat||'')+'|'+(l.desc||'')));
      await serial('orders/'+id,()=>S.db.doc('orders/'+id).update({linhas:[...(ex.linhas||[]),...add],forn:ex.forn||head.forn}))}
    else await serial('orders/'+id,()=>S.db.doc('orders/'+id).set({...head,estado:'Encomendado',origem:ordDraft.src,criado:nowIso(),by:S.me||'',linhas:clean}));
  }toast('Pedidos guardados.');ordDraft=null;renderDraft()}catch(e){toast(dbErr(e),1)}
}
const drop=$('#drop');
$('#pick').onclick=e=>{e.stopPropagation();$('#ordFile').click()};
$('#ordFile').onchange=e=>{[...e.target.files].forEach(routeFile);e.target.value=''};
function routeFile(f){const n=f.name||'imagem';if(f.type.startsWith('image/'))handleOrderInput('image',f,n);else if(/\.pdf$/i.test(n)||f.type==='application/pdf')handleOrderInput('pdf',f,n);else if(/\.(xlsx|xls|csv)$/i.test(n))handleOrderInput('sheet',f,n);else toast('Formato não suportado: '+n,1)}
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over')});
drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');[...e.dataTransfer.files].forEach(routeFile)});
document.addEventListener('paste',e=>{
  if(UI.view!=='pedidos'||!S.canWrite)return;if(e.target?.closest?.('input,textarea'))return;
  const items=[...(e.clipboardData?.items||[])];const img=items.find(i=>i.type.startsWith('image/'));
  if(img){e.preventDefault();handleOrderInput('image',img.getAsFile(),'print colado');return}
  const t=e.clipboardData?.getData('text');if(t&&t.trim()){e.preventDefault();handleOrderInput('text',t,'texto colado do SAP')}
});
const OEST=['Encomendado','Recebido parcial','Recebido','Cancelado'];const oCls={Encomendado:'p-enc','Recebido parcial':'p-par',Recebido:'p-rec',Cancelado:'p-can'};
function filteredOrders(){const q=norm($('#oq').value),e=$('#oEst').value;return S.orders.filter(o=>(!e||o.estado===e)&&(!q||norm([o.num,o.forn,o.origem,...(o.linhas||[]).flatMap(l=>[l.mat,l.desc,l.cod])].join(' ')).includes(q))).sort((a,b)=>String(b.data||b.criado).localeCompare(String(a.data||a.criado)))}
function renderOrders(){
  const a=filteredOrders();
  $('#ordRows').innerHTML=!S.loaded.orders?`<tr><td colspan="7" class="empty">${S.db?'A carregar pedidos…':'Sem ligação à base de dados.'}</td></tr>`:a.length?a.map(o=>{const open=UI.openOrder===o._id;return `<tr class="click" data-ord="${esc(o._id)}"><td class="code">${esc(o.num)}</td><td class="mono small">${fmtD(o.data)}</td><td>${esc(o.forn||'')}</td><td class="num">${recBadge(o)}</td><td class="small muted">${esc(o.origem||'')}</td><td><span class="pill ${oCls[o.estado]||'p-enc'}">${esc(o.estado||'Encomendado')}</span></td><td>${open?'▾':'▸'}</td></tr>`+(open?`<tr><td colspan="7" style="background:var(--surface-2)">${orderDetail(o)}</td></tr>`:'')}).join(''):`<tr><td colspan="7" class="empty">${S.orders.length?'Nenhum pedido corresponde à pesquisa.':'Ainda não há pedidos. Arrasta um Excel, PDF ou print do SAP para a área acima.'}</td></tr>`;
}
/* ---------- receção com controlo de qualidade + não conformidades ---------- */
const NC_TO_DEFAULT=['sandra.barros@graphicsleader.pt','vitor.moreira@graphicsleader.pt','mario.david@graphicsleader.pt'];
const ncTo=()=>(S.cl?.ncTo&&S.cl.ncTo.length?S.cl.ncTo:NC_TO_DEFAULT);
const NC_TIPOS=['Danificada no transporte','Medidas / formato errado','Falta de componentes','Lâminas ou vincos com defeito','Borrachas em falta ou mal coladas','Não corresponde ao pedido','Outro'];
function getName(){try{return localStorage.getItem('pcv_nome')||''}catch{return ''}}
function setName(n){try{localStorage.setItem('pcv_nome',n)}catch{}}
const REC_CHECK=['Tem farpas visíveis nas madeiras?','Tem lâminas, borrachas ou peças soltas?','Algum elemento danificado?'];
function recCheck(){return (S.cl?.recCheck&&S.cl.recCheck.length?S.cl.recCheck:REC_CHECK)}
async function saveReception(o,i,l,rq){
  const rec={ts:nowIso(),data:rq.data,pedido:o.num,ordId:o._id,linha:i,forn:o.forn||'',mat:l.mat||'',desc:l.desc||'',cod:l.cod||'',qtd:l.qtd??'',un:l.un||'',qtdRec:rq.qtdRec??'',por:rq.por,guia:rq.guia||'',by:S.me||'',res:rq.res,itens:rq.itens||[]};
  if(rq.desc)rec.descricao=rq.desc;if(rq.ncId)rec.ncId=rq.ncId;
  try{await S.db.collection('receptions').doc(safeId('R_'+o.num+'_'+i+'_'+uid())).set(rec)}catch(e){toast(dbErr(e),1)}
}
function openReception(o,i,setLines){
  const l=o.linhas[i];const Q=recCheck();
  openDrawer(`<div class="dh"><div class="grow"><h3 style="font-family:var(--f-sans)">Confirmar chegada</h3><p>Pedido <b class="mono">${esc(o.num)}</b> · ${esc(o.forn||'')}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="panel"><div class="small muted">Material</div><div><b class="mono">${esc(l.mat||'')}</b> ${esc(l.desc||'')}</div><div class="small muted">Quantidade pedida: ${esc(l.qtd??'')} ${esc(l.un||'')}</div></div>
  <div class="panel stack"><div class="grid-f"><label class="f"><span>Rececionado por</span><select id="rcPor"><option value="">Escolher…</option>${recetores().map(r=>`<option ${r===getName()?'selected':''}>${esc(r)}</option>`).join('')}</select></label><label class="f"><span>Data</span><input type="date" id="rcData" value="${today()}"></label><label class="f"><span>Quantidade recebida</span><input type="number" id="rcQtd" value="${esc(l.qtd??'')}" min="0"></label><label class="f"><span>Guia de remessa <span class="muted">(opcional)</span></span><input type="text" id="rcGuia" placeholder="Nº da guia"></label></div></div>
  <div class="cl-group"><h4>Verificação na receção</h4>${Q.map((q,k)=>`<div class="cl-item" data-q="${k}"><span>${esc(q)}</span><div class="tri" role="group" aria-label="${esc(q)}"><button class="o" data-qa="Não" aria-pressed="false">Não</button><button class="n" data-qa="Sim" aria-pressed="false">Sim</button></div></div>`).join('')}</div>
  <div id="rcVer"></div>
  <div id="rcNok" class="panel stack" hidden><div class="grid-f"><label class="f"><span>Quantidade não conforme</span><input type="number" id="rcQn" value="${esc(l.qtd??1)}" min="0"></label></div>
     <label class="f"><span>Descrição do problema *</span><textarea id="rcDesc" placeholder="Onde está o problema, o que se vê, quantas peças…"></textarea></label>
     <p class="small muted" style="margin:0">Ao confirmar, é criado o relatório de não conformidade para ${ncTo().map(esc).join(', ')}.</p></div>
  <div class="row"><button class="btn pri" id="rcOk">Confirmar chegada</button><button class="btn" data-close>Cancelar</button></div>`);
  const ans={};
  const upd=()=>{const done=Q.filter((_,k)=>ans[k]).length,nok=Q.filter((_,k)=>ans[k]==='Sim').length;
    $('#rcVer').innerHTML=done<Q.length?`<div class="verdict pend">${done} de ${Q.length} pontos verificados</div>`:nok?`<div class="verdict nok">Não conforme · ${nok} ${nok===1?'ponto':'pontos'} com problema</div>`:'<div class="verdict ok">Conforme · material OK</div>';
    $('#rcNok').hidden=!nok;return {done,nok}};
  upd();
  $$('[data-qa]',dr).forEach(b=>b.onclick=()=>{const k=+b.closest('[data-q]').dataset.q;ans[k]=b.dataset.qa;$$('[data-qa]',b.parentElement).forEach(x=>x.setAttribute('aria-pressed',x===b));const v=upd();if(v.nok&&b.dataset.qa==='Sim')$('#rcDesc').focus()});
  $('#rcOk').onclick=async()=>{
    const v=upd();if(v.done<Q.length){toast(`Responde aos ${Q.length} pontos de verificação.`,1);return}
    const por=$('#rcPor').value.trim();if(!por){toast('Indica quem rececionou.',1);$('#rcPor').focus();return}setName(por);
    const itens=Q.map((q,k)=>({t:q,r:ans[k]==='Sim'?'NOK':'OK'}));const res=v.nok?'NOK':'OK';
    const rq={res,por,d:nowIso(),data:$('#rcData').value||today(),qtdRec:numVal($('#rcQtd').value),itens};const guia=$('#rcGuia').value.trim();if(guia)rq.guia=guia;
    if(res==='NOK'){rq.tipo=itens.filter(x=>x.r==='NOK').map(x=>x.t.replace(/\?$/,'')).join('; ');rq.desc=$('#rcDesc').value.trim();rq.qtdNok=numVal($('#rcQn').value);if(!rq.desc){toast('Descreve o problema encontrado.',1);$('#rcDesc').focus();return}}
    const ls=o.linhas.map(x=>({...x}));ls[i].rec=rq.data;if(S.me)ls[i].recBy=S.me;const {itens:_,data:__,...rqLine}=rq;ls[i].rq=rqLine;
    $('#rcOk').disabled=true;await setLines(ls);
    if(res==='NOK'){const nc={ts:nowIso(),data:rq.data,pedido:o.num,ordId:o._id,linha:i,forn:o.forn||'',mat:l.mat||'',desc:l.desc||'',cod:l.cod||'',qtd:l.qtd??'',un:l.un||'',qtdNok:rq.qtdNok,tipo:rq.tipo,itens,descricao:rq.desc,por,guia:rq.guia||'',hora:fmtHora(rq.d),by:S.me||'',estado:'Aberta',para:ncTo()};
      try{const id=safeId('NC_'+o.num+'_'+i+'_'+uid());await S.db.collection('ncs').doc(id).set(nc);rq.ncId=id;await saveReception(o,i,l,rq);toast('Não conformidade registada.');await notifyNc({...nc,_id:id});openNc((S.ncs||[]).find(x=>x._id===id)||{...nc,_id:id})}catch(e){toast(dbErr(e),1)}}
    else{await saveReception(o,i,l,rq);toast('Chegada confirmada · conforme.');closeDrawer()}
  };
}
const fmtHora=iso=>{const d=new Date(iso);return isNaN(d)?'':String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function ncText(n){
  const subj=`Não conformidade na receção – Pedido ${n.pedido} – ${n.forn||'fornecedor'} – ${n.mat||n.cod||''}`.trim();
  const body=`Bom dia,

Na receção de material do setor de Pré-corte e Vinco (PCV) foi detetada a seguinte não conformidade:

Pedido de compra: ${n.pedido}
Fornecedor: ${n.forn||'-'}
Material: ${n.mat||'-'}${n.cod?' ('+n.cod+')':''}
Descrição: ${n.desc||'-'}
Quantidade pedida: ${n.qtd??'-'} ${n.un||''}
Quantidade não conforme: ${n.qtdNok??'-'}
Problemas detetados: ${n.tipo||'-'}
Problema detetado: ${n.descricao||'-'}
Guia de remessa: ${n.guia||'-'}
Data e hora do controlo: ${fmtD(n.data)} às ${n.hora||fmtHora(n.ts)}
Rececionado por: ${n.por||'-'}

Solicita-se o tratamento da não conformidade e o contacto com o fornecedor.

Relatório gerado automaticamente pela app PCV Ferramentas.`;
  return {subj,body,to:(n.para&&n.para.length?n.para:ncTo())};
}
async function ncPdf(n){try{const doc=await newPdf('Relatório de não conformidade – Receção',`Pedido ${n.pedido} · ${n.forn||''} · ${fmtD(n.data)}`);
  doc.autoTable({body:[['Pedido de compra',n.pedido],['Fornecedor',n.forn||''],['Material',(n.mat||'')+(n.cod?'  ('+n.cod+')':'')],['Descrição',n.desc||''],['Qtd. pedida',String(n.qtd??'')+' '+(n.un||'')],['Qtd. não conforme',String(n.qtdNok??'')],['Tipo',n.tipo||''],['Problema detetado',n.descricao||''],['Guia de remessa',n.guia||'-'],['Data e hora do controlo',fmtD(n.data)+' às '+(n.hora||fmtHora(n.ts))],['Rececionado por',n.por||''],['Estado',n.estado||'Aberta'],['Destinatários',(n.para||ncTo()).join(', ')]],startY:30,theme:'grid',styles:{fontSize:9.5,cellPadding:2.4,lineColor:[217,226,220]},columnStyles:{0:{fontStyle:'bold',fillColor:[245,249,246],cellWidth:45}},margin:{left:14,right:14}});
  let y=doc.lastAutoTable.finalY+12;doc.setFontSize(9);doc.setTextColor(60);doc.text('Tratamento / resposta do fornecedor:',14,y);doc.setDrawColor(190);for(let k=1;k<=4;k++)doc.line(14,y+k*8,196,y+k*8);
  y+=48;doc.line(14,y,90,y);doc.line(120,y,196,y);doc.setFontSize(8);doc.setTextColor(110);doc.text('Rececionado por',14,y+4);doc.text('Qualidade / Compras',120,y+4);
  pdfFooter(doc);await saveFile(`NC_${n.pedido}_${(n.mat||n.cod||'').replace(/[^\w-]/g,'')}.pdf`,doc.output('arraybuffer'))}catch(e){toast(e.message,1)}}
const NC_EST=['Aberta','Enviada ao fornecedor','Fechada'];
function openNc(n){const m=ncText(n);
  openDrawer(`<div class="dh"><div class="grow"><h3 style="font-family:var(--f-sans);color:var(--nok)">Não conformidade</h3><p>Pedido <b class="mono">${esc(n.pedido)}</b>${n.forn?' · '+esc(n.forn):''} · ${fmtD(n.data)} às ${n.hora||fmtHora(n.ts)}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="panel stack"><div class="small muted">Para</div><div class="mono small" style="user-select:all">${m.to.map(esc).join('; ')}</div>
   <div class="small muted">Assunto</div><div style="user-select:all">${esc(m.subj)}</div>
   <div class="small muted">Mensagem</div><pre style="white-space:pre-wrap;font:13px/1.5 var(--f-sans);margin:0;user-select:all;background:var(--surface-2);padding:10px;border-radius:6px">${esc(m.body)}</pre>
   <div class="row">${typeof EJ==='function'&&EJ()?`<button class="btn pri" id="ncSend">${n.emailAuto?'Reenviar email':'Enviar email agora'}</button>`:''}<button class="btn${typeof EJ==='function'&&EJ()?'':' pri'}" id="ncCopy">Copiar email</button><a class="btn" href="mailto:${m.to.join(',')}?subject=${encodeURIComponent(m.subj)}&body=${encodeURIComponent(m.body)}">Abrir no Outlook</a><button class="btn" id="ncPdf">Relatório PDF</button></div>
   <p class="small muted" style="margin:0">${n.emailAuto?`<b style="color:var(--ok)">Email enviado automaticamente</b> em ${fmtDT(n.emailAuto)}. Podes reenviar ou anexar o PDF manualmente.`:(typeof EJ==='function'&&EJ()?'<b style="color:var(--nok)">Email ainda não enviado.</b> Carrega em “Enviar email agora”.':'O envio automático só funciona na versão GitHub (jscampos87.github.io). Aqui, cola o email no Outlook e anexa o relatório PDF.')}</p></div>
  <div class="panel row w-only"><label class="f"><span>Estado</span><select id="ncEst">${NC_EST.map(e=>`<option ${n.estado===e?'selected':''}>${e}</option>`).join('')}</select></label><label class="f grow"><span>Nota de tratamento</span><input type="text" id="ncNota" value="${esc(n.nota||'')}" placeholder="ex.: fornecedor vai substituir"></label><button class="btn" id="ncSave" style="margin-top:18px">Guardar</button></div>`);
  $('#ncCopy').onclick=async()=>{const txt='Para: '+m.to.join('; ')+'\nAssunto: '+m.subj+'\n\n'+m.body;try{await navigator.clipboard.writeText(txt);toast('Email copiado. Cola no Outlook.')}catch{const r=document.createRange();r.selectNodeContents($('pre',dr));getSelection().removeAllRanges();getSelection().addRange(r);toast('Seleciona e copia com Ctrl + C.')}};
  $('#ncPdf').onclick=()=>ncPdf(n);
  $('#ncSend')&&($('#ncSend').onclick=async()=>{$('#ncSend').disabled=true;const ok=await notifyNc(n,true);if(ok)openNc({...n,emailAuto:nowIso()});else $('#ncSend').disabled=false});
  $('#ncSave')&&($('#ncSave').onclick=async()=>{if(!needDb())return;try{await serial('ncs/'+n._id,()=>S.db.doc('ncs/'+n._id).update({estado:$('#ncEst').value,nota:$('#ncNota').value.trim(),...($('#ncEst').value!=='Aberta'&&!n.enviada?{enviada:today()}:{})}));toast('Não conformidade atualizada.');closeDrawer()}catch(e){toast(dbErr(e),1)}});
}
const qn=l=>{const n=Number(l.qtd);return n>0?n:1};
function recBadge(o){const L=o.linhas||[],r=L.filter(l=>l.rec).length;return `<span class="mono ${r===L.length&&L.length?'ok-t':''}">${r}/${L.length}</span>`}
function orderTotals(){let ped=0,rec=0;for(const o of S.orders){if(o.estado==='Cancelado')continue;for(const l of o.linhas||[]){ped+=qn(l);if(l.rec)rec+=qn(l)}}return {ped,rec}}
function orderDetail(o){
  return `<div class="stack" style="padding:6px 0"><div class="tw"><table class="t"><thead><tr><th>Material</th><th>Descrição</th><th>Qtd</th><th>Un</th><th>Preço</th><th>Entrega</th><th>Receção</th></tr></thead><tbody>${(o.linhas||[]).map((l,i)=>`<tr><td class="mono">${esc(l.mat||'')}</td><td class="wrap">${esc(l.desc||'')}${l.cod?` <span class="tag">${esc(l.cod)}</span>`:''}</td><td class="num">${esc(l.qtd??'')}</td><td>${esc(l.un||'')}</td><td class="num">${l.preco!==undefined&&l.preco!==''?esc(typeof l.preco==='number'?l.preco.toLocaleString('pt-PT',{minimumFractionDigits:2}):l.preco):''}</td><td class="mono small">${fmtD(l.entrega)}</td><td class="rcv"><button class="chk${l.rec?' on':''}" data-rec="${i}" aria-pressed="${!!l.rec}" ${S.canWrite?'':'disabled'}><span class="box" aria-hidden="true"></span>${l.rec?'Chegou '+fmtD(l.rec):'Confirmar chegada'}</button>${l.rq?` <span class="pill ${l.rq.res==='OK'?'p-ok':'p-nok'}" title="${esc(l.rq.desc||'Material conforme')}">${l.rq.res==='OK'?'OK':'NOK'}</span>`:''}${l.ent?` <span class="tag">no armazém</span>`:l.rec?` <button class="btn sm w-only" data-ent="${i}">Dar entrada no armazém</button>`:''}</td></tr>`).join('')}</tbody></table></div>
  ${(o.linhas||[]).some(l=>!l.rec)&&o.estado!=='Cancelado'?`<div class="row w-only"><button class="btn sm" data-recall>✓ Todas as linhas chegaram conformes</button><span class="small muted">Usa só se verificaste todas as linhas e nenhuma tem farpas, peças soltas ou danos.</span></div>`:''}
  <div class="row w-only"><label class="f"><span>Estado</span><select data-oest>${OEST.map(e=>`<option ${o.estado===e?'selected':''}>${e}</option>`).join('')}</select></label><label class="f grow"><span>Nota</span><input type="text" data-onota value="${esc(o.nota||'')}" placeholder="ex.: prazo confirmado pelo fornecedor"></label><button class="btn sm" data-opdf style="margin-top:18px">PDF</button><button class="btn sm danger" data-odel data-min="SUPV" style="margin-top:18px">Eliminar pedido</button></div><div data-oconf></div></div>`;
}
$('#ordRows').addEventListener('click',async e=>{
  const tr=e.target.closest('[data-ord]');if(tr&&!e.target.closest('button,select,input')){UI.openOrder=UI.openOrder===tr.dataset.ord?null:tr.dataset.ord;renderOrders();return}
  const o=S.orders.find(x=>x._id===UI.openOrder);if(!o)return;const ref=()=>S.db.doc('orders/'+o._id);
  const setLines=async ls=>{const allRec=ls.every(l=>l.rec),some=ls.some(l=>l.rec);const estado=o.estado==='Cancelado'?o.estado:allRec?'Recebido':some?'Recebido parcial':'Encomendado';try{await serial('orders/'+o._id,()=>ref().update({linhas:ls,estado}))}catch(err){toast(dbErr(err),1)}};
  const r=e.target.closest('[data-rec]');if(r){if(!needDb())return;const ls=o.linhas.map(x=>({...x}));const l=ls[+r.dataset.rec];if(l.rec){delete l.rec;delete l.recBy;delete l.rq;toast('Chegada anulada.');await setLines(ls);return}
    openReception(o,+r.dataset.rec,setLines);return}
  if(e.target.closest('[data-recall]')){if(!needDb())return;const por=getName();if(!por){toast('Confirma a primeira linha individualmente para registar o teu nome.',1);return}
    const its=recCheck().map(q=>({t:q,r:'OK'}));const todo=o.linhas.map((x,k)=>[x,k]).filter(([x])=>!x.rec);
    const ls=o.linhas.map(x=>x.rec?x:({...x,rec:today(),rq:{res:'OK',por,d:nowIso()},...(S.me?{recBy:S.me}:{})}));await setLines(ls);
    for(const [x,k] of todo)await saveReception(o,k,x,{res:'OK',por,data:today(),qtdRec:x.qtd??'',itens:its});toast('Chegada confirmada para todas as linhas.');return}
  const en=e.target.closest('[data-ent]');if(en){const i=+en.dataset.ent,l=o.linhas[i];openToolForm(null,{cod:l.cod||'',mat:l.mat||'',den:l.desc||'',ult:today(),notas:'Pedido '+o.num,onSaved:async()=>{const ls=o.linhas.map(x=>({...x}));ls[i].rec=ls[i].rec||today();ls[i].ent=today();await setLines(ls)}});return}
  if(e.target.closest('[data-opdf]')){try{const doc=await newPdf('Pedido de compra '+o.num,`${o.forn||''} · ${fmtD(o.data)} · ${o.estado||''}`);pdfTable(doc,['Material','Descrição','Qtd','Un','Preço','Entrega','Receção'],(o.linhas||[]).map(l=>[l.mat||'',l.desc||'',l.qtd??'',l.un||'',l.preco??'',fmtD(l.entrega),fmtD(l.rec)]));pdfFooter(doc);await saveFile('Pedido_'+o.num+'.pdf',doc.output('arraybuffer'))}catch(err){toast(err.message,1)}return}
  if(e.target.closest('[data-odel]')){const c=$('[data-oconf]');c.innerHTML=`<div class="confirm"><span class="grow">Eliminar o pedido ${esc(o.num)}?</span><button class="btn danger" data-odelok>Eliminar</button></div>`;return}
  if(e.target.closest('[data-odelok]')){if(!needDb())return;try{await serial('orders/'+o._id,()=>ref().delete());UI.openOrder=null;toast('Pedido eliminado.')}catch(err){toast(dbErr(err),1)}}
});
$('#ordRows').addEventListener('change',async e=>{const o=S.orders.find(x=>x._id===UI.openOrder);if(!o||!needDb())return;const ref=S.db.doc('orders/'+o._id);
  try{if(e.target.matches('[data-oest]'))await serial('orders/'+o._id,()=>ref.update({estado:e.target.value}));if(e.target.matches('[data-onota]'))await serial('orders/'+o._id,()=>ref.update({nota:e.target.value}));toast('Pedido atualizado.')}catch(err){toast(dbErr(err),1)}});
['#oq','#oEst'].forEach(s=>$(s).addEventListener('input',renderOrders));
const ordAoa=a=>[['Nº pedido','Data','Fornecedor','Estado','Material','Descrição','Ferramenta','Qtd','Un','Preço','Entrega','Recebido','Origem'],...a.flatMap(o=>(o.linhas||[]).map(l=>[o.num,fmtD(o.data),o.forn||'',o.estado||'',l.mat||'',l.desc||'',l.cod||'',l.qtd??'',l.un||'',l.preco??'',fmtD(l.entrega),fmtD(l.rec),o.origem||'']))];
$('#ordXls').onclick=()=>exportXlsx('Pedidos_PCV_'+today()+'.xlsx',[['Pedidos',ordAoa(filteredOrders())]]);
$('#ordPdf').onclick=async()=>{try{const a=filteredOrders();const doc=await newPdf('Pedidos de compra – PCV',`${a.length} pedidos · ${new Date().toLocaleString('pt-PT')}`,true);const rows=ordAoa(a).slice(1).map(r=>[r[0],r[1],r[2],r[3],r[4],r[5],r[7],r[8],r[10],r[11]]);pdfTable(doc,['Nº pedido','Data','Fornecedor','Estado','Material','Descrição','Qtd','Un','Entrega','Recebido'],rows,29,{columnStyles:{5:{cellWidth:80}}});pdfFooter(doc);await saveFile('Pedidos_PCV_'+today()+'.pdf',doc.output('arraybuffer'))}catch(e){toast(e.message,1)}};

/* ============ compras: histórico de receções e KPIs ============ */
function filteredRecs(){const q=norm($('#rq').value),r=$('#rRes').value;return S.recs.filter(x=>(!r||x.res===r)&&(!q||norm([x.pedido,x.forn,x.mat,x.desc,x.cod,x.por,x.descricao].join(' ')).includes(q)))}
function renderRecHist(){const a=filteredRecs();
  $('#rRows').innerHTML=!S.loaded.recs?`<tr><td colspan="8" class="empty">${S.db?'A carregar…':'Sem ligação à base de dados.'}</td></tr>`:a.length?a.slice(0,400).map(x=>`<tr class="click" data-recid="${esc(x._id)}"><td class="mono small">${fmtD(x.data)}</td><td class="code">${esc(x.pedido)}</td><td>${esc(x.forn||'')}</td><td class="wrap">${esc(x.desc||x.mat||'')}${x.cod?` <span class="tag">${esc(x.cod)}</span>`:''}</td><td class="num">${esc(x.qtdRec??'')}</td><td>${esc(x.por||'')}</td><td><span class="pill ${x.res==='OK'?'p-ok':'p-nok'}">${x.res==='OK'?'Conforme':'NOK'}</span></td><td class="small">${esc((x.itens||[]).filter(i=>i.r==='NOK').map(i=>i.t.replace(/\?$/,'')).join('; '))}</td></tr>`).join(''):`<tr><td colspan="8" class="empty">${S.recs.length?'Nenhuma receção corresponde ao filtro.':'Ainda não há receções registadas. Usa “Confirmar chegada” num pedido.'}</td></tr>`}
function openRec(x){if(x.ncId){const n=(S.ncs||[]).find(n=>n._id===x.ncId);if(n){openNc(n);return}}
  openDrawer(`<div class="dh"><div class="grow"><h3 style="font-family:var(--f-sans)">Receção ${esc(x.pedido)}</h3><p>${fmtD(x.data)} · ${esc(x.forn||'')} · ${esc(x.por||'')}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="verdict ${x.res==='OK'?'ok':'nok'}">${x.res==='OK'?'Conforme':'Não conforme'}</div>
  <div class="panel"><b class="mono">${esc(x.mat||'')}</b> ${esc(x.desc||'')}<div class="small muted">Qtd. pedida ${esc(x.qtd??'')} · recebida ${esc(x.qtdRec??'')}</div></div>
  <div class="tw"><table class="t"><thead><tr><th>Ponto de verificação</th><th>Resultado</th></tr></thead><tbody>${(x.itens||[]).map(i=>`<tr><td>${esc(i.t)}</td><td><span class="pill ${i.r==='OK'?'p-ok':'p-nok'}">${i.r==='OK'?'Não':'Sim'}</span></td></tr>`).join('')}</tbody></table></div>${x.descricao?`<p>${esc(x.descricao)}</p>`:''}`)}
$('#rRows').addEventListener('click',e=>{const r=e.target.closest('[data-recid]');if(r){const x=S.recs.find(y=>y._id===r.dataset.recid);if(x)openRec(x)}});
['#rq','#rRes'].forEach(s=>$(s).addEventListener('input',renderRecHist));
$('#rXls').onclick=()=>{const a=filteredRecs();exportXlsx('Rececoes_PCV_'+today()+'.xlsx',[['Receções',[['Data','Pedido','Fornecedor','Material','Descrição','Ferramenta','Qtd pedida','Qtd recebida','Rececionado por','Resultado',...recCheck(),'Problema','NC'],...a.map(x=>[fmtD(x.data),x.pedido,x.forn||'',x.mat||'',x.desc||'',x.cod||'',x.qtd??'',x.qtdRec??'',x.por||'',x.res==='OK'?'Conforme':'NOK',...recCheck().map(q=>{const it=(x.itens||[]).find(i=>i.t===q);return it?(it.r==='OK'?'Não':'Sim'):''}),x.descricao||'',x.ncId?'Sim':''])]]])};
function renderRecKpi(){
  const per=+$('#rkPer').value;const from=per?Date.now()-per*864e5:0;const a=S.recs.filter(x=>!from||new Date(x.data||x.ts)>=from);
  const nok=a.filter(x=>x.res==='NOK');const ncs=(S.ncs||[]).filter(n=>!from||new Date(n.data||n.ts)>=from);
  $('#rkTiles').innerHTML=[[a.length,'Receções verificadas'],[a.length?Math.round((a.length-nok.length)/a.length*100)+'%':'—','Conformes'],[nok.length,'Não conformidades'],[ncs.filter(n=>n.estado==='Aberta').length,'NC por tratar'],[ncs.filter(n=>n.estado==='Enviada ao fornecedor').length,'Enviadas ao fornecedor']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
  const pt={};nok.forEach(x=>(x.itens||[]).forEach(i=>{if(i.r==='NOK')pt[i.t]=(pt[i.t]||0)+1}));
  bars($('#rkPts'),Object.entries(pt).sort((x,y)=>y[1]-x[1]).map(([l,v])=>({l:l.replace(/\?$/,''),v,t:v+'×'})));
  const fo={};a.forEach(x=>{const k=x.forn||'Sem fornecedor';fo[k]=fo[k]||{n:0,k:0};fo[k].n++;if(x.res==='NOK')fo[k].k++});
  bars($('#rkForn'),Object.entries(fo).map(([l,o])=>({l,v:o.k/o.n*100,t:Math.round(o.k/o.n*100)+'% de '+o.n})).sort((x,y)=>y.v-x.v).slice(0,10));
  const mo={};a.forEach(x=>{const m=String(x.data||x.ts).slice(0,7);mo[m]=mo[m]||{n:0,k:0};mo[m].n++;if(x.res==='NOK')mo[m].k++});
  bars($('#rkMes'),Object.entries(mo).sort((x,y)=>x[0].localeCompare(y[0])).slice(-12).map(([m,o])=>({l:m.slice(5)+'/'+m.slice(0,4),v:o.k,t:o.k+' NC / '+o.n})));
}
$('#rkPer').addEventListener('input',renderRecKpi);

/* ============ qualidade ============ */
const Q={tool:null,ans:{}};
const CL=()=>S.cl&&S.cl.groups?S.cl:DEFAULT_CL;
function refreshQualConfig(){
  fillMaqSelect();fillOpSelect();$('#maqList').innerHTML=machines().map(m=>`<option>${esc(m)}</option>`).join('');
  if(!$('#qList').dataset.dirty)renderChecklist();renderEditor();if(typeof renderExitList==='function'&&!Object.keys(X.ans).length)renderExitList();
}
function renderChecklist(){
  const g=CL().groups;
  $('#qList').innerHTML=g.map((gr,gi)=>`<div class="cl-group"><h4><span class="n">${gi+1}.</span> ${esc(gr.name)}</h4>${gr.items.map((it,ii)=>{const k=gi+'.'+ii,a=Q.ans[k]||{};return `<div class="cl-item" data-k="${k}"><span>${esc(it)}</span><div class="tri" role="group" aria-label="${esc(it)}"><button class="o" aria-pressed="${a.r==='OK'}" data-r="OK">OK</button><button class="n" aria-pressed="${a.r==='NOK'}" data-r="NOK">NOK</button><button class="a" aria-pressed="${a.r==='NA'}" data-r="NA">N/A</button></div>${a.r==='NOK'?`<input class="cmt" type="text" data-c="${k}" value="${esc(a.c||'')}" placeholder="Descreve o problema (obrigatório)">`:''}</div>`}).join('')}</div>`).join('');
  verdict();
}
function verdict(){
  const g=CL().groups;let tot=0,done=0,nok=0;g.forEach((gr,gi)=>gr.items.forEach((_,ii)=>{tot++;const a=Q.ans[gi+'.'+ii];if(a?.r)done++;if(a?.r==='NOK')nok++}));
  $('#qVerdict').innerHTML=done<tot?`<div class="verdict pend">${done} de ${tot} pontos verificados</div>`:nok?`<div class="verdict nok">Reprovado · ${nok} ${nok===1?'ponto':'pontos'} NOK</div>`:`<div class="verdict ok">Aprovado · todos os pontos OK</div>`;
  $('#qRepWrap').hidden=!nok;return {tot,done,nok};
}
$('#qList').addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(!b)return;const k=b.closest('[data-k]').dataset.k;Q.ans[k]={...(Q.ans[k]||{}),r:b.dataset.r};$('#qList').dataset.dirty='1';renderChecklist();if(b.dataset.r==='NOK')$(`[data-c="${k}"]`)?.focus()});
$('#qList').addEventListener('input',e=>{const k=e.target.dataset.c;if(k)Q.ans[k].c=e.target.value});
toolAc($('#qCod'),$('#qAc'),t=>{Q.tool=t;$('#qCod').value=t.cod;renderToolInfo()});
$('#qCod').addEventListener('input',()=>{Q.tool=null;renderToolInfo()});
function renderToolInfo(){
  const t=Q.tool||[...S.tools.values()].find(x=>x.cod===$('#qCod').value.trim().toUpperCase()&&x.est!=='sucatado');
  if(t&&!Q.tool)Q.tool=t;
  const last=t?S.insp.find(i=>i.toolId===t.id||i.cod===t.cod):null;
  $('#qTool').innerHTML=t?`<b class="mono">${esc(t.cod)}</b> · posição <b class="mono">${esc(t.pos||'—')}</b> · ${esc(t.cli||'')} · ${estPill(t)}${last?` · última verificação ${fmtD(last.data)} <span class="pill ${last.res==='OK'?'p-ok':'p-nok'}">${last.res}</span>`:''}`:'';
}
function collect(){
  const g=CL().groups,v=verdict();const cod=$('#qCod').value.trim().toUpperCase();
  const itens=[];g.forEach((gr,gi)=>gr.items.forEach((it,ii)=>{const a=Q.ans[gi+'.'+ii]||{};itens.push({g:gr.name,t:it,r:a.r||'',c:a.c||''})}));
  return {cod,toolId:Q.tool?.cod===cod?Q.tool.id:'',maq:$('#qMaq').value.trim(),data:$('#qData').value||today(),op:$('#qOp').value.trim(),obs:$('#qObs').value.trim(),itens,res:v.nok?'NOK':'OK',v};
}
$('#qSave').onclick=async()=>{
  const c=collect();if(!c.cod){toast('Indica o código do cortante.',1);$('#qCod').focus();return}
  if(c.v.done<c.v.tot){toast(`Faltam ${c.v.tot-c.v.done} pontos por verificar.`,1);return}
  if(c.itens.some(i=>i.r==='NOK'&&!i.c.trim())){toast('Descreve o problema em cada ponto NOK.',1);return}
  if(!needDb())return;
  const rep=c.res==='NOK'&&$('#qRep').checked&&c.toolId;
  const doc={ts:nowIso(),data:c.data,cod:c.cod,toolId:c.toolId,maq:c.maq,op:c.op,obs:c.obs,res:c.res,itens:c.itens.map(i=>{const o={g:i.g,t:i.t,r:i.r};if(i.c)o.c=i.c;return o}),by:S.me||'',nivel:(typeof ROLE!=='undefined'&&ROLE)||'',repar:!!rep};
  try{const ref=S.db.collection('inspections').doc(safeId(c.data+'_'+c.cod+'_'+uid()));await ref.set(doc);
    if(rep){const t=S.tools.get(c.toolId);if(t){const n={...t,est:'reparacao',repDesde:today(),repMot:c.itens.filter(i=>i.r==='NOK').map(i=>i.g+': '+i.t+(i.c?' ('+i.c+')':'')).join('; '),repOrig:'Verificação PCM'+(c.maq?' · '+c.maq:'')};addHist(n,'Enviado para reparação (verificação NOK: '+c.itens.filter(i=>i.r==='NOK').map(i=>i.t).join('; ')+')');await saveTools([n])}}
    else if(c.toolId){const t=S.tools.get(c.toolId);if(t){const n={...t};addHist(n,`Verificação PCM ${c.res}${c.maq?' · '+c.maq:''}`);await saveTools([n])}}
    toast('Verificação guardada'+(rep?' e cortante enviado para reparação.':'.'));
    lastSaved=doc;$('#qSave').textContent='Guardado ✓';setTimeout(()=>$('#qSave').textContent='Guardar e imprimir',2500);
    await inspPdf(doc,true);
  }catch(e){toast(dbErr(e),1)}
};
let lastSaved=null;
async function inspPdf(d,print){
  try{const saida=d.kind==='saida';const doc=await newPdf(saida?'Saída de máquina – verificação do cortante':'Verificação de cortante – PCM',`Cortante ${d.cod} · ${fmtD(d.data)}`);
  const t=S.tools.get(d.toolId)||[...S.tools.values()].find(x=>x.cod===d.cod);
  doc.autoTable({body:[['Cortante',d.cod,'Máquina',d.maq||''],['Data',fmtD(d.data),'Operador',d.op||''],['Posição',t?.pos||'','Cliente',t?.cli||''],['Resultado',d.res==='OK'?'APROVADO':'REPROVADO','Registo',d.ts?fmtDT(d.ts):''],...(saida?[['Folhas cortadas',fmtN(d.folhas),'Vida acumulada',fmtN(d.total)+' / '+fmtN(vidaMax())]]:[])],startY:29,theme:'grid',styles:{fontSize:9,cellPadding:2,lineColor:[217,226,220]},columnStyles:{0:{fontStyle:'bold',fillColor:[238,242,239],cellWidth:28},2:{fontStyle:'bold',fillColor:[238,242,239],cellWidth:28}},margin:{left:14,right:14},didParseCell:x=>{if(x.row.index===3&&x.column.index===1){x.cell.styles.textColor=d.res==='OK'?[31,138,76]:[192,57,43];x.cell.styles.fontStyle='bold'}}});
  pdfTable(doc,['Grupo','Ponto de verificação','Resultado','Comentário'],d.itens.map(i=>[i.g,i.t,i.r==='NA'?'N/A':i.r,i.c||'']),doc.lastAutoTable.finalY+6,{columnStyles:{0:{cellWidth:34},2:{cellWidth:22,halign:'center',fontStyle:'bold'}},didParseCell:x=>{if(x.section==='body'&&x.column.index===2){x.cell.styles.textColor=x.cell.raw==='OK'?[31,138,76]:x.cell.raw==='NOK'?[192,57,43]:[120,120,120]}}});
  let y=doc.lastAutoTable.finalY+8;if(d.obs){doc.setFontSize(9);doc.setTextColor(60);doc.text('Observações: '+d.obs,14,y,{maxWidth:180});y+=12}
  doc.setDrawColor(150);doc.line(14,y+14,90,y+14);doc.line(120,y+14,196,y+14);doc.setFontSize(8);doc.setTextColor(110);doc.text('Operador',14,y+18);doc.text(saida?'Chefe de turno':'Responsável PCV',120,y+18);
  pdfFooter(doc);const fn=`${saida?'Saida':'Verificacao'}_${d.cod}_${d.data}.pdf`;if(print)await printPdf(doc,fn);else await saveFile(fn,doc.output('arraybuffer'))}catch(e){toast(e.message,1)}
}
$('#qPdf').onclick=()=>{const c=collect();if(!c.cod){toast('Indica o código do cortante.',1);return}inspPdf({...c,ts:lastSaved?.cod===c.cod?lastSaved.ts:''},true)};
function resetQ(){Q.ans={};Q.tool=null;lastSaved=null;['#qCod','#qObs'].forEach(s=>$(s).value='');$('#qData').value=today();delete $('#qList').dataset.dirty;renderChecklist();renderToolInfo()}
$('#qReset').onclick=resetQ;
function filteredInsp(){const q=norm($('#hq').value),r=$('#hRes').value;return S.insp.filter(i=>(!r||i.res===r)&&(!q||norm([i.cod,i.maq,i.op,i.obs].join(' ')).includes(q)))}
function renderHist(){const a=filteredInsp();
  $('#hRows').innerHTML=!S.loaded.insp?`<tr><td colspan="7" class="empty">${S.db?'A carregar…':'Sem ligação à base de dados.'}</td></tr>`:a.length?a.slice(0,300).map(i=>`<tr class="click" data-insp="${esc(i._id)}"><td class="mono small">${fmtD(i.data)}</td><td class="code">${esc(i.cod)}</td><td>${esc(i.maq||'')}</td><td>${esc(i.op||'')}</td><td><span class="pill ${i.res==='OK'?'p-ok':'p-nok'}">${i.res}</span>${i.repar?' <span class="tag">reparação</span>':''}</td><td class="small">${esc((i.itens||[]).filter(x=>x.r==='NOK').map(x=>x.g+': '+x.t).join('; '))}</td><td><button class="btn sm" data-ipdf="${esc(i._id)}">PDF</button></td></tr>`).join(''):`<tr><td colspan="7" class="empty">${S.insp.length?'Nenhuma verificação corresponde ao filtro.':'Ainda não há verificações. Faz a primeira em “Nova verificação”.'}</td></tr>`}
['#hq','#hRes'].forEach(s=>$(s).addEventListener('input',renderHist));
$('#hRows').addEventListener('click',e=>{const p=e.target.closest('[data-ipdf]');if(p){const d=S.insp.find(i=>i._id===p.dataset.ipdf);if(d)inspPdf(d);return}const r=e.target.closest('[data-insp]');if(r){const d=S.insp.find(i=>i._id===r.dataset.insp);if(d)openInsp(d)}});
function openInsp(d){openDrawer(`<div class="dh"><div class="grow"><h3>${esc(d.cod)}</h3><p>${fmtD(d.data)} · ${esc(d.maq||'')} · ${esc(d.op||'')}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="verdict ${d.res==='OK'?'ok':'nok'}">${d.res==='OK'?'Aprovado':'Reprovado'}${d.repar?' · enviado para reparação':''}</div>
  <div class="tw"><table class="t"><thead><tr><th>Grupo</th><th>Ponto</th><th>Resultado</th></tr></thead><tbody>${(d.itens||[]).map(i=>`<tr><td>${esc(i.g)}</td><td>${esc(i.t)}${i.c?`<div class="small" style="color:var(--nok)">${esc(i.c)}</div>`:''}</td><td><span class="pill ${i.r==='OK'?'p-ok':i.r==='NOK'?'p-nok':'p-sucatado'}">${i.r==='NA'?'N/A':esc(i.r)}</span></td></tr>`).join('')}</tbody></table></div>
  ${d.obs?`<p>${esc(d.obs)}</p>`:''}<div class="row"><button class="btn" id="iPdf">Descarregar PDF</button>${d.by?`<span class="small muted">Registado por <span data-uid="${esc(d.by)}"></span> · ${fmtDT(d.ts)}</span>`:''}</div>`);fillNames(dr);$('#iPdf').onclick=()=>inspPdf(d)}
$('#hXls').onclick=()=>{const a=filteredInsp();exportXlsx('Verificacoes_PCM_'+today()+'.xlsx',[['Verificações',[['Data','Cortante','Máquina','Operador','Resultado','Pontos NOK','Comentários','Observações','Reparação'],...a.map(i=>[fmtD(i.data),i.cod,i.maq||'',i.op||'',i.res,(i.itens||[]).filter(x=>x.r==='NOK').map(x=>x.g+': '+x.t).join('; '),(i.itens||[]).filter(x=>x.c).map(x=>x.c).join('; '),i.obs||'',i.repar?'Sim':''])]]])};
function bars(el,data,green){const mx=Math.max(1,...data.map(d=>d.v));el.innerHTML=data.length?data.map(d=>`<div class="bar"><span title="${esc(d.l)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.l)}</span><span class="tr"><span class="fl ${green?'g':''}" style="width:${Math.max(2,d.v/mx*100)}%;display:block"></span></span><span class="v">${d.t}</span></div>`).join(''):'<p class="small muted" style="margin:0">Sem dados no período.</p>'}
function renderKpi(){
  const per=+$('#kPer').value;const from=per?Date.now()-per*864e5:0;const a=S.insp.filter(i=>!from||new Date(i.data||i.ts)>=from);
  const nok=a.filter(i=>i.res==='NOK').length;const tools=new Set(a.map(i=>i.cod)).size;
  $('#kTiles').innerHTML=[[a.length,'Verificações'],[a.length?Math.round((a.length-nok)/a.length*100)+'%':'—','Aprovadas'],[nok,'Reprovadas'],[tools,'Cortantes verificados'],[a.filter(i=>i.repar).length,'Enviados p/ reparação']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
  const it={};a.forEach(i=>(i.itens||[]).forEach(x=>{if(x.r==='NOK'){const k=x.g+' · '+x.t;it[k]=(it[k]||0)+1}}));
  bars($('#kItems'),Object.entries(it).sort((x,y)=>y[1]-x[1]).slice(0,10).map(([l,v])=>({l,v,t:v+'×'})));
  const mq={};a.forEach(i=>{const k=i.maq||'Sem máquina';mq[k]=mq[k]||{n:0,k:0};mq[k].n++;if(i.res==='NOK')mq[k].k++});
  bars($('#kMaq'),Object.entries(mq).map(([l,o])=>({l,v:o.k/o.n*100,t:Math.round(o.k/o.n*100)+'% de '+o.n})).sort((x,y)=>y.v-x.v).slice(0,10));
  const tc={};a.forEach(i=>{if(i.res==='NOK')tc[i.cod]=(tc[i.cod]||0)+1});
  bars($('#kTools'),Object.entries(tc).sort((x,y)=>y[1]-x[1]).slice(0,10).map(([l,v])=>({l,v,t:v+'×'})));
}
$('#kPer').addEventListener('input',renderKpi);
/* editor da checklist */
let edState=null;
function renderEditor(){
  if(!edState||!$('#edGroups').dataset.dirty)edState=JSON.parse(JSON.stringify(CL().groups));
  $('#edGroups').innerHTML=edState.map((g,gi)=>`<div class="cl-group"><h4><span class="n">${gi+1}.</span><input type="text" data-eg="${gi}" value="${esc(g.name)}" style="flex:1"><button class="btn sm danger w-only" data-delg="${gi}">Eliminar grupo</button></h4><div style="padding:6px 12px 10px">${g.items.map((it,ii)=>`<div class="ed-item"><input type="text" data-ei="${gi}.${ii}" value="${esc(it)}"><button class="btn sm danger w-only" data-deli="${gi}.${ii}" aria-label="Eliminar ponto">✕</button></div>`).join('')}<button class="btn sm w-only" data-addi="${gi}">+ Adicionar ponto</button></div></div>`).join('');
  if(typeof renderDefs==='function')renderDefs();
}
$('#edGroups').addEventListener('input',e=>{$('#edGroups').dataset.dirty='1';if(e.target.dataset.eg!=null)edState[+e.target.dataset.eg].name=e.target.value;if(e.target.dataset.ei){const[g,i]=e.target.dataset.ei.split('.').map(Number);edState[g].items[i]=e.target.value}});
$('#edGroups').addEventListener('click',e=>{const t=e.target;$('#edGroups').dataset.dirty='1';
  if(t.dataset.delg!=null){edState.splice(+t.dataset.delg,1);renderEditor()}
  if(t.dataset.deli){const[g,i]=t.dataset.deli.split('.').map(Number);edState[g].items.splice(i,1);renderEditor()}
  if(t.dataset.addi!=null){edState[+t.dataset.addi].items.push('');renderEditor();const ins=$$(`[data-ei^="${t.dataset.addi}."]`);ins[ins.length-1]?.focus()}});
$('#edAddG').onclick=()=>{$('#edGroups').dataset.dirty='1';edState.push({name:'Novo grupo',items:['']});renderEditor()};
async function saveCl(patch){if(!needDb())return;const body={...(S.cl||{}),groups:CL().groups,machines:machines(),operadores:operadores(),ncTo:ncTo(),vidaMax:vidaMax(),...patch,upd:nowIso(),by:S.me||''};try{await serial('config/checklist',()=>S.db.doc('config/checklist').set(body));toast('Guardado.');return true}catch(e){toast(dbErr(e),1)}}
$('#edSave').onclick=async()=>{const g=edState.map(x=>({name:x.name.trim(),items:x.items.map(s=>s.trim()).filter(Boolean)})).filter(x=>x.name&&x.items.length);if(!g.length){toast('A checklist precisa de pelo menos um grupo com pontos.',1);return}if(await saveCl({groups:g})){delete $('#edGroups').dataset.dirty;Q.ans={};delete $('#qList').dataset.dirty}};

