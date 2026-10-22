/* ============ níveis de acesso (OP / PCV / SUPV) ============
   As passwords separam menus e evitam erros; não são segurança forte (o código da página é público). */
const ROLES={OP:1,PCV:2,SUPV:3};
const ROLE_NAME={OP:'Operador',PCV:'PCV',SUPV:'Supervisão'};
const PW_DEF={OP:'dd26a03cba7113fd01d48b790b248ea54d2f29242691e3b3686924f900bf7426',
  PCV:'ba5ba38aa16ccb9b5d0375e5bd5bd17c62e67abdcf94b83616012c276802f848',
  SUPV:'ed8b04f489f85e2d3906151eb8d1391c5e8b4e6c1ac107dc935bf5a189301e5c'};
let ROLE=null,ROLE_H='';
const pwHash=r=>(S.cl&&S.cl.pw&&S.cl.pw[r])||PW_DEF[r];
const roleAtLeast=l=>(ROLES[ROLE]||0)>=(ROLES[l]||9);
const opGroups=()=>(S.cl&&S.cl.opGroups&&S.cl.opGroups.length?S.cl.opGroups:CL().groups);

function sha256(str){
  const s=unescape(encodeURIComponent(str)),K=[],H=[];let n=2,c=0;
  const isP=x=>{for(let f=2;f*f<=x;f++)if(x%f===0)return false;return true};
  const fr=x=>((x-Math.floor(x))*4294967296)|0;
  while(c<64){if(isP(n)){if(c<8)H[c]=fr(Math.pow(n,1/2));K[c]=fr(Math.pow(n,1/3));c++}n++}
  const w=[],l=s.length*8;let i;
  for(i=0;i<s.length;i++)w[i>>2]|=s.charCodeAt(i)<<(24-(i%4)*8);
  w[l>>5]|=0x80<<(24-l%32);w[(((l+64)>>9)<<4)+15]=l;
  const r=(x,y)=>(x>>>y)|(x<<(32-y));
  for(let j=0;j<w.length;j+=16){
    const W=[];let [a,b,cc,d,e,f,g,h]=H;
    for(i=0;i<64;i++){
      if(i<16)W[i]=w[j+i]|0;else{const x=W[i-15],y=W[i-2];W[i]=(W[i-16]+(r(x,7)^r(x,18)^(x>>>3))+W[i-7]+(r(y,17)^r(y,19)^(y>>>10)))|0}
      const t1=(h+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+W[i])|0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&cc)^(b&cc)))|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=cc;cc=b;b=a;a=(t1+t2)|0}
    H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+cc)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0}
  return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
const pwNorm=v=>sha256(String(v||'').trim().toUpperCase());

/* páginas e separadores mínimos por nível */
const VIEW_MIN={pedidos:'PCV',qualidade:'PCV',def:'SUPV'};
const viewAllowed=v=>!VIEW_MIN[v]||roleAtLeast(VIEW_MIN[v]);
function fixTabs(){if(UI.arm==='sucata'&&!roleAtLeast('SUPV'))UI.arm='lista';if(UI.op==='kpi'&&!roleAtLeast('PCV'))UI.op='nova'}
{const _go=go;go=function(v,sub){if(!ROLE||!viewAllowed(v))v='inicio';_go(v,sub)}}
{const _st=syncTabs;syncTabs=function(){fixTabs();_st()}}

function applyRole(){
  document.body.classList.remove('role-OP','role-PCV','role-SUPV');
  if(ROLE)document.body.classList.add('role-'+ROLE);
  $('#roleName').textContent=ROLE||'—';$('#roleChip').title=ROLE?('Nível: '+ROLE_NAME[ROLE]+' · clicar para trocar'):'Entrar';
  if(!viewAllowed(UI.view))go('inicio');else{syncTabs();refreshAll()}
}
function saveRole(){try{ROLE?localStorage.setItem('pcv_role',JSON.stringify({r:ROLE,h:ROLE_H})):localStorage.removeItem('pcv_role')}catch{}}
function showLogin(canCancel){
  let o=$('#login');if(!o){o=document.createElement('div');o.id='login';o.className='login';document.body.append(o)}
  const logo=$('.logo-l')?.getAttribute('src')||'';
  o.innerHTML=`<form class="box" id="lgForm" autocomplete="off">${logo?`<img src="${esc(logo)}" alt="Hinojosa">`:''}
    <h2>PCV Ferramentas</h2><p class="muted small" style="margin:0">Introduz a password do teu nível de acesso.</p>
    <input type="password" id="lgPw" placeholder="Password" autocomplete="current-password">
    <div id="lgErr" class="small" style="color:var(--nok);min-height:1em"></div>
    <div class="row"><button class="btn pri grow" type="submit">Entrar</button>${canCancel?'<button class="btn" type="button" id="lgNo">Cancelar</button>':''}</div>
    <p class="small muted" style="margin:0">Níveis: <b>OP</b> operador · <b>PCV</b> pré-corte e vinco · <b>SUPV</b> supervisão</p></form>`;
  o.hidden=false;setTimeout(()=>$('#lgPw')?.focus(),30);
  $('#lgNo')&&($('#lgNo').onclick=()=>{o.hidden=true});
  $('#lgForm').onsubmit=e=>{e.preventDefault();const h=pwNorm($('#lgPw').value);
    const r=['SUPV','PCV','OP'].find(k=>pwHash(k)===h);
    if(!r){$('#lgErr').textContent='Password errada.';$('#lgPw').select();return}
    ROLE=r;ROLE_H=h;saveRole();o.hidden=true;if(!$('#ov').hidden)closeDrawer();
    applyRole();go(r==='OP'?'inicio':UI.view);toast('Entraste como '+ROLE_NAME[r]+'.')};
}
function initAuth(){
  let st=null;try{st=JSON.parse(localStorage.getItem('pcv_role')||'null')}catch{}
  if(st&&ROLES[st.r]&&st.h===pwHash(st.r)){ROLE=st.r;ROLE_H=st.h;applyRole()}
  else{applyRole();showLogin(false)}
}
/* se a supervisão mudar as passwords, os postos têm de entrar de novo */
function checkRoleCfg(){
  if(!ROLE||S.clExists===undefined)return;
  if(ROLE_H&&ROLE_H!==pwHash(ROLE)){ROLE=null;ROLE_H='';saveRole();applyRole();showLogin(false);toast('As passwords foram alteradas. Entra de novo.',1)}
}
$('#roleChip').onclick=()=>showLogin(!!ROLE);

/* ============ início do operador ============ */
toolAc($('#opSearch'),$('#opAc'),t=>{$('#opSearch').value='';openTool(t.id)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-opgo]');if(!b)return;const k=b.dataset.opgo;
  if(k==='armazem'){UI.arm='lista';go('armazem')}else{UI.op=k==='hist'?'hist':'nova';go('operador')}});

/* ============ definições ============ */
UI.def='cl';
const MAIL_RE=/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
const LISTS={
  lstMaq:{key:'machines',get:()=>machines(),ph:'Nova máquina (ex.: B150)',up:true,what:'máquina'},
  lstOps:{key:'operadores',get:()=>operadores(),ph:'Nome do operador',what:'operador'},
  lstRec:{key:'recetores',get:()=>recetores(),ph:'Nome de quem receciona',what:'nome'},
  lstNc:{key:'ncTo',get:()=>ncTo(),ph:'email@graphicsleader.pt',mail:true,what:'email'},
  lstVida:{key:'vidaTo',get:()=>mailTo('vida'),ph:'email@graphicsleader.pt',mail:true,what:'email',fb:true},
  lstSaida:{key:'saidaTo',get:()=>mailTo('saida'),ph:'email@graphicsleader.pt',mail:true,what:'email',fb:true},
  lstPdf:{key:'pdfTo',get:()=>pdfTo(),ph:'email@graphicsleader.pt',mail:true,what:'email'}};
function wireList(id){
  const el=$('#'+id),c=LISTS[id];if(!el||el.dataset.w)return;el.dataset.w='1';
  el.innerHTML=`<div class="lst"></div><div class="small muted" data-fbnote hidden style="margin-top:4px">Ainda sem lista própria: usa os destinatários dos NOK de fornecedores.</div><div class="row w-only" style="margin-top:8px"><input type="${c.mail?'email':'text'}" data-ladd placeholder="${esc(c.ph)}" class="grow"><button class="btn sm" data-laddb>Adicionar</button></div>`;
  const add=async()=>{const inp=$('[data-ladd]',el);let v=inp.value.trim().replace(/\s+/g,' ');if(c.up)v=v.toUpperCase();if(c.mail)v=v.toLowerCase();
    if(!v)return;if(c.mail&&!MAIL_RE.test(v)){toast('Email inválido.',1);return}
    const cur=c.get();if(cur.some(x=>norm(x)===norm(v))){toast('Já está na lista.',1);return}
    if(await saveCl({[c.key]:[...cur,v]})){inp.value='';inp.focus()}};
  $('[data-laddb]',el).onclick=add;$('[data-ladd]',el).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
  el.addEventListener('click',async e=>{const b=e.target.closest('[data-ldel]');if(!b)return;const cur=c.get();
    if(cur.length<=1){toast('A lista precisa de pelo menos um '+c.what+'.',1);return}
    if(b.dataset.sure!=='1'){b.dataset.sure='1';b.textContent='Confirmar?';setTimeout(()=>{if(b.isConnected){b.dataset.sure='';b.textContent='Eliminar'}},3000);return}
    await saveCl({[c.key]:cur.filter((_,i)=>i!==+b.dataset.ldel)})});
}
function renderList(id){
  wireList(id);const el=$('#'+id),c=LISTS[id];if(!el)return;
  $('.lst',el).innerHTML=c.get().map((x,i)=>`<div class="lst-item"><span${c.up?' class="mono"':''}>${esc(x)}</span><button class="btn sm danger w-only" data-ldel="${i}">Eliminar</button></div>`).join('');
  const n=$('[data-fbnote]',el);if(n)n.hidden=!(c.fb&&!(S.cl&&S.cl[c.key]&&S.cl[c.key].length));
}

/* checklist do operador */
let edOp=null;
function renderEdOp(){
  const box=$('#edGroupsOp');if(!box)return;
  if(!edOp||!box.dataset.dirty)edOp=JSON.parse(JSON.stringify(opGroups()));
  box.innerHTML=(S.cl&&S.cl.opGroups&&S.cl.opGroups.length?'':'<p class="small muted" style="margin:0">Ainda igual à checklist PCV. Ao guardar passa a ser uma lista própria do operador.</p>')+
    edOp.map((g,gi)=>`<div class="cl-group"><h4><span class="n">${gi+1}.</span><input type="text" data-eg="${gi}" value="${esc(g.name)}" style="flex:1"><button class="btn sm danger w-only" data-delg="${gi}">Eliminar grupo</button></h4><div style="padding:6px 12px 10px">${g.items.map((it,ii)=>`<div class="ed-item"><input type="text" data-ei="${gi}.${ii}" value="${esc(it)}"><button class="btn sm danger w-only" data-deli="${gi}.${ii}" aria-label="Eliminar ponto">✕</button></div>`).join('')}<button class="btn sm w-only" data-addi="${gi}">+ Adicionar ponto</button></div></div>`).join('');
}
$('#edGroupsOp').addEventListener('input',e=>{const box=$('#edGroupsOp');box.dataset.dirty='1';if(e.target.dataset.eg!=null)edOp[+e.target.dataset.eg].name=e.target.value;if(e.target.dataset.ei){const[g,i]=e.target.dataset.ei.split('.').map(Number);edOp[g].items[i]=e.target.value}});
$('#edGroupsOp').addEventListener('click',e=>{const t=e.target,box=$('#edGroupsOp');
  if(t.dataset.delg!=null){box.dataset.dirty='1';edOp.splice(+t.dataset.delg,1);renderEdOp()}
  if(t.dataset.deli){box.dataset.dirty='1';const[g,i]=t.dataset.deli.split('.').map(Number);edOp[g].items.splice(i,1);renderEdOp()}
  if(t.dataset.addi!=null){box.dataset.dirty='1';edOp[+t.dataset.addi].items.push('');renderEdOp();const ins=$$(`#edGroupsOp [data-ei^="${t.dataset.addi}."]`);ins[ins.length-1]?.focus()}});
$('#edAddGOp').onclick=()=>{$('#edGroupsOp').dataset.dirty='1';edOp.push({name:'Novo grupo',items:['']});renderEdOp()};
$('#edCopyOp').onclick=()=>{$('#edGroupsOp').dataset.dirty='1';edOp=JSON.parse(JSON.stringify(CL().groups));renderEdOp();toast('Copiada. Carrega em “Guardar checklist Operador”.')};
$('#edSaveOp').onclick=async()=>{const g=edOp.map(x=>({name:x.name.trim(),items:x.items.map(s=>s.trim()).filter(Boolean)})).filter(x=>x.name&&x.items.length);
  if(!g.length){toast('A checklist precisa de pelo menos um grupo com pontos.',1);return}
  if(await saveCl({opGroups:g})){delete $('#edGroupsOp').dataset.dirty;if(typeof X!=='undefined'){X.ans={};renderExitList()}}};

/* vida dos cortantes */
let vdPick=null;
toolAc($('#vdCod'),$('#vdAc'),t=>{vdPick=t;$('#vdCod').value=t.cod;$('#vdLim').value=t.vidaMax||'';$('#vdLim').focus()});
$('#vdCod').addEventListener('input',()=>{vdPick=null});
$('#edVidaSave').onclick=async()=>{const v=Math.round(+$('#edVida').value);if(!(v>=1000)){toast('Indica um limite válido (mínimo 1000 folhas).',1);return}await saveCl({vidaMax:v})};
$('#vdAdd').onclick=async()=>{
  const t=vdPick||[...S.tools.values()].find(x=>norm(x.cod)===norm($('#vdCod').value));if(!t){toast('Escolhe o cortante na lista.',1);return}
  const v=Math.round(+$('#vdLim').value);if(!(v>=1000)){toast('Indica um limite válido (mínimo 1000 folhas).',1);return}
  const n={...t,vidaMax:v};addHist(n,'Limite de vida definido: '+fmtN(v)+' folhas');
  if(await saveTools([n])){toast(t.cod+': limite de '+fmtN(v)+' folhas.');$('#vdCod').value='';$('#vdLim').value='';vdPick=null}};
$('#vdRows').addEventListener('click',async e=>{const b=e.target.closest('[data-vdel]');if(b){const t=S.tools.get(b.dataset.vdel);if(!t)return;const n={...t};delete n.vidaMax;addHist(n,'Limite de vida próprio removido (passa a usar o geral)');if(await saveTools([n]))toast(t.cod+' passa a usar o limite geral.');return}
  const r=e.target.closest('[data-tool]');if(r)openTool(r.dataset.tool)});
function renderVida(){
  const ed=$('#edVida');if(ed&&document.activeElement!==ed)ed.value=vidaMax();
  const a=[...S.tools.values()].filter(t=>+t.vidaMax).sort((x,y)=>String(x.cod).localeCompare(String(y.cod)));
  $('#vdRows').innerHTML=a.length?a.map(t=>`<tr class="click" data-tool="${esc(t.id)}"><td class="code">${esc(t.cod)}</td><td class="small">${esc(t.cli||'')}</td><td class="num">${fmtN(t.folhas)}</td><td class="num"><b>${fmtN(t.vidaMax)}</b></td><td><button class="btn sm danger w-only" data-vdel="${esc(t.id)}">Remover</button></td></tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhum cortante com limite próprio. Todos usam ${fmtN(vidaMax())} folhas.</td></tr>`;
}

/* emails */
function renderMail(){
  const c=EJ();
  $('#mailCfg').innerHTML=c?`<div class="small"><span class="pill p-ok">Ativo</span> Envio automático configurado (EmailJS · ${esc(c.serviceId)}).</div>`:
    `<div class="small"><span class="pill p-par">Manual</span> Envio automático não configurado neste ambiente (config.js › emailjs). Os emails são enviados com “Copiar email” / “Abrir no Outlook”.</div>`;
  $('#edAuto').checked=autoMail();$('#edAuto').disabled=!c;$('#edMailTest').disabled=!c;
}
$('#edAuto').onchange=async e=>{if(!(await saveCl({autoMail:e.target.checked})))e.target.checked=!e.target.checked};
$('#edMailTest').onclick=async()=>{const to=$('#edTestTo').value.trim().toLowerCase();if(!MAIL_RE.test(to)){toast('Indica o teu email.',1);return}
  const b=$('#edMailTest');b.disabled=true;
  try{await sendMail([to],'[PCV] Email de teste','Teste de envio automático da app PCV Ferramentas.\n\nSe recebeste esta mensagem, as notificações estão a funcionar.');toast('Email de teste enviado para '+to+'.')}
  catch(e){toast('Falhou: '+e.message,1)}finally{b.disabled=false}};

/* passwords */
$('#pwSave').onclick=async()=>{
  const nw={};for(const r of ['OP','PCV','SUPV']){const v=$('#pw'+r).value.trim();if(!v)continue;if(v.length<6){toast('A password '+r+' precisa de pelo menos 6 caracteres.',1);return}nw[r]=pwNorm(v)}
  if(!Object.keys(nw).length){toast('Escreve pelo menos uma password nova.',1);return}
  const all={OP:pwHash('OP'),PCV:pwHash('PCV'),SUPV:pwHash('SUPV'),...nw};
  if(new Set(Object.values(all)).size<3){toast('As três passwords têm de ser diferentes.',1);return}
  const keep=ROLE_H;ROLE_H=all[ROLE];saveRole();
  if(await saveCl({pw:all})){['OP','PCV','SUPV'].forEach(r=>$('#pw'+r).value='');toast('Passwords alteradas. Os outros postos vão pedir a nova password.')}
  else{ROLE_H=keep;saveRole()}};

function renderDefs(){
  checkRoleCfg();renderPdfIdx();
  Object.keys(LISTS).forEach(renderList);renderEdOp();renderVida();renderMail();
}

/* histórico da ficha visível também para o operador: saídas de máquina */
function exitsPanel(t){
  const a=(S.exits||[]).filter(i=>i.toolId===t.id||i.cod===t.cod).slice(0,10);
  return `<div class="panel"><h4 style="margin-bottom:6px">Saídas de máquina (operador)</h4>${a.length?`<ul class="hist">${a.map(i=>`<li><time>${fmtD(i.data)}</time><span>${esc(i.maq||'')} · ${esc(i.op||'')} · ${fmtN(i.folhas)} folhas</span><span class="grow"></span><span class="pill ${i.res==='OK'?'p-ok':'p-nok'}">${i.res}</span></li>`).join('')}</ul>`:'<p class="small muted" style="margin:0">Sem saídas de máquina registadas.</p>'}</div>`;
}

/* ============ armazém intermédio: recebido mas por arrumar ============ */
const qtyOf=l=>{const n=Number(l.qtdRec??l.rq?.qtdRec??l.qtd);return n>0?n:1};
function porArrumar(){
  const a=[];for(const o of S.orders||[]){if(o.estado==='Cancelado')continue;(o.linhas||[]).forEach((l,i)=>{if(l.rec&&!l.ent&&l.loc!=='famag')a.push({o,i,l,q:qtyOf(l)})})}
  return a.sort((x,y)=>String(x.l.rec).localeCompare(String(y.l.rec)));
}
const diasDesde=d=>{const t=new Date(d);return isNaN(t)?0:Math.floor((Date.now()-t)/864e5)};
function pendTable(a){
  if(!a.length)return '<p class="small muted" style="margin:0">Nada por arrumar. Tudo o que foi recebido já tem posição no armazém.</p>';
  return `<div class="tw"><table class="t"><thead><tr><th>Recebido</th><th>Pedido</th><th>Material</th><th class="num">Qtd</th><th>Receção</th><th></th></tr></thead><tbody>${a.map(x=>{const d=diasDesde(x.l.rec),k=x.o._id+'|'+x.i;
    return `<tr><td class="mono small">${fmtD(x.l.rec)}<div class="${d>=3?'late':'muted'}" style="font-family:var(--f-sans)">${d===0?'hoje':d===1?'há 1 dia':'há '+d+' dias'}</div></td><td class="code">${esc(x.o.num)}<div class="small muted" style="font-family:var(--f-sans);font-weight:400">${esc(x.o.forn||'')}</div></td><td class="wrap small"><b class="mono">${esc(x.l.mat||'')}</b> ${esc(x.l.desc||'')}${x.l.cod?` <span class="tag">${esc(x.l.cod)}</span>`:''}</td><td class="num">${x.q}</td><td class="small">${x.l.rq?`<span class="pill ${x.l.rq.res==='NOK'?'p-nok':'p-ok'}">${x.l.rq.res==='NOK'?'NOK':'OK'}</span> `:''}${esc(x.l.rq?.por||'')}${x.l.rq?.guia?`<div class="muted">Guia ${esc(x.l.rq.guia)}</div>`:''}</td>
    <td class="w-only"><div class="pendact"><button class="btn sm pri" data-arr="${esc(k)}">Arrumar</button><button class="btn sm" data-arrok="${esc(k)}" title="Já está no armazém (ex.: substitui um cortante existente)">Já arrumado</button></div></td></tr>`}).join('')}</tbody></table></div>`;
}
const maqArrumar=()=>[...S.tools.values()].filter(t=>t.est==='arrumar').sort((x,y)=>String(x.arrDesde||'').localeCompare(String(y.arrDesde||'')));
function toolPendTable(a){
  return `<div class="tw"><table class="t"><thead><tr><th>Saiu da máquina</th><th>Cortante</th><th>Máquina</th><th>Posição reservada</th><th></th></tr></thead><tbody>${a.map(t=>{const d=diasDesde(t.arrDesde);
    return `<tr class="click" data-tool="${esc(t.id)}"><td class="mono small">${fmtDT(t.arrDesde)}<div class="${d>=2?'late':'muted'}" style="font-family:var(--f-sans)">${d===0?'hoje':d===1?'há 1 dia':'há '+d+' dias'}</div></td><td class="code">${esc(t.cod)}<div class="small muted" style="font-family:var(--f-sans);font-weight:400">${esc((t.cli||'').slice(0,40))}</div></td><td>${esc(t.maqUlt||'')}${t.arrRes?` <span class="pill ${t.arrRes==='NOK'?'p-nok':'p-ok'}">${t.arrRes}</span>`:''}</td><td class="mono">${esc(t.pos||'—')}<div class="small muted" style="font-family:var(--f-sans)">${esc(t.local||'')}</div></td><td class="w-only"><div class="pendact"><button class="btn sm pri" data-tarr="${esc(t.id)}">${t.pos?'Arrumar em '+esc(t.pos):'Escolher posição'}</button></div></td></tr>`}).join('')}</tbody></table></div>`;
}
function pendAll(){const a=porArrumar(),m=maqArrumar();
  const parts=[];if(m.length)parts.push(`<h4 style="margin:4px 0 6px">Regressados das máquinas <span class="pill p-arrumar">${m.length}</span></h4>`+toolPendTable(m));
  if(a.length)parts.push(`<h4 style="margin:10px 0 6px">Recebidos de compras <span class="pill p-arrumar">${a.reduce((s,x)=>s+x.q,0)}</span></h4>`+pendTable(a));
  return parts.length?parts.join(''):pendTable([]);}
function renderPend(){
  const a=porArrumar(),n=a.reduce((s,x)=>s+x.q,0)+maqArrumar().length;
  if($('#pendN')){$('#pendN').textContent=S.loaded.orders&&S.loaded.tools?n:'—';$('#pendPanel').toggleAttribute('data-zero',!n);$('#pendList').innerHTML=S.loaded.orders?pendAll():''}
  const b=$('#armPend');if(b){b.hidden=!n;b.textContent=n+(n===1?' ferramenta por arrumar':' ferramentas por arrumar')}
}
function arrumar(o,i){const l=o.linhas[i];
  openToolForm(null,{cod:l.cod||'',mat:l.mat||'',den:l.desc||'',ult:today(),notas:'Pedido '+o.num,onSaved:async t=>{const cur=S.orders.find(x=>x._id===o._id)||o;const ls=cur.linhas.map(x=>({...x}));ls[i].rec=ls[i].rec||today();ls[i].ent=today();ls[i].entPos=(t&&t.pos)||'';await setOrderLines(cur,ls);renderPend()}})}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-tarr]');if(!b)return;e.stopPropagation();if(!roleAtLeast('PCV')||!needDb())return;const t=S.tools.get(b.dataset.tarr);if(!t)return;
  if(!t.pos){openTool(t.id);$('#dMove')&&$('#dMove').click();return}
  if(b.dataset.sure!=='1'){b.dataset.sure='1';b.textContent='Confirmar '+t.pos+'?';setTimeout(()=>{if(b.isConnected){b.dataset.sure='';b.textContent='Arrumar em '+t.pos}},3500);return}
  const n={...t,est:'armazem'};addHist(n,`Arrumado na posição ${t.pos} (posição fixa)`);if(await saveTools([n])){toast(t.cod+' arrumado em '+t.pos+'.');renderPend()}},true);
document.addEventListener('click',e=>{const r=e.target.closest('#pendList [data-tool]');if(r&&!e.target.closest('button'))openTool(r.dataset.tool)});
document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-arr]'),k=e.target.closest('[data-arrok]');if(!a&&!k)return;
  const [oid,i]=(a||k).dataset[a?'arr':'arrok'].split('|');const o=(S.orders||[]).find(x=>x._id===oid);if(!o)return;
  if(!roleAtLeast('PCV')||!needDb())return;
  if(a){if($('#ov')&&!$('#ov').hidden&&$('#drawer [data-pendlist]'))closeDrawer();arrumar(o,+i);return}
  if(k.dataset.sure!=='1'){k.dataset.sure='1';k.textContent='Confirmar?';setTimeout(()=>{if(k.isConnected){k.dataset.sure='';k.textContent='Já arrumado'}},3000);return}
  const ls=o.linhas.map(x=>({...x}));ls[+i].ent=today();ls[+i].entNota='Marcado como arrumado sem nova ficha';if(await setOrderLines(o,ls)){toast('Marcado como arrumado.');renderPend();if($('#drawer [data-pendlist]'))$('#drawer [data-pendlist]').innerHTML=pendAll()}
});
$('#armPend').onclick=()=>openDrawer(`<div class="dh"><div class="grow"><h3 style="font-family:var(--f-sans)">Armazém intermédio</h3><p>Recebidas e ainda por arrumar</p></div><button class="btn sm" data-close>Fechar</button></div><div class="panel" data-pendlist>${pendAll()}</div>`);

/* ============ índice de PDFs do SharePoint (ligação pelo código, ex.: S1980B) ============
   config/pdfidx = {cortante:[nomes], braille:[...], relevo:[...], upd:{kind:iso}, src:{kind:'Microsoft 365'|'lista/CSV'}}
   O link é sempre pasta + nome do ficheiro; qualquer cortante (também os importados de novo) encontra o seu PDF pelo código. */
const PDF_KINDS=[['cortante','01 - Cortantes'],['braille','00 - Brailles'],['relevo','02 - Relevos']];
function pdfKeys(name){
  const u=String(name).toUpperCase().replace(/\.PDF$/,''),out=new Set();
  for(const m of u.matchAll(/(?<![A-Z0-9])([ST])(\d{4})([A-Z]?)(?!\d)/g))out.add(m[1]+m[2]+m[3]);
  const head=u.split('_')[0];
  for(const m of head.matchAll(/P-?(\d{6})/g))out.add('P'+m[1]);
  const pm=head.match(/P-?\d{6}/);if(pm)for(const m of head.slice(pm.index).matchAll(/\+(\d{3,4})-\d{2}/g))out.add('P'+m[1].padStart(6,'0'));
  return out;
}
function toolKeys(t){
  const u=String(t.cod||'').toUpperCase(),ks=[];
  for(const m of u.matchAll(/([ST])(\d{4})([A-Z]?)(?!\d)/g)){ks.push(m[1]+m[2]+m[3]);if(ks.length>=3)break}
  const p=u.match(/^P-?(\d{6})/);if(p)ks.push('P'+p[1]);
  return ks;
}
function pdfMap(){
  if(S.pdfMap)return S.pdfMap;const M={};
  for(const [k] of PDF_KINDS){const m=new Map();const add=(key,n)=>{if(!m.has(key))m.set(key,[]);if(!m.get(key).includes(n))m.get(key).push(n)};for(const n of (S.pdfidx?.[k]||[]))for(const key of pdfKeys(n))add(key,n);for(const [n,cs] of Object.entries(S.pdfcont?.[k]||{}))for(const c of cs)add(c,n);M[k]=m}
  return S.pdfMap=M;
}
const pdfRank=n=>(/_R\d{3}|IMPRESS|ENSAIO|MISTUR|SEM BOCA/i.test(n)?1:0);
function pdfFiles(t,kind){
  const m=pdfMap()[kind];if(!m||!m.size)return [];const base=folderOf(kind);if(!base)return [];
  const seen=new Set(),out=[];
  for(const k of toolKeys(t)){for(const n of m.get(k)||[])if(!seen.has(n)){seen.add(n);out.push(n)}}
  if(!out.length)for(const k of toolKeys(t)){if(/^[ST]\d{4}[A-Z]$/.test(k))for(const n of m.get(k.slice(0,5))||[])if(!seen.has(n)){seen.add(n);out.push(n)}}
  return out.sort((a,b)=>pdfRank(a)-pdfRank(b)||a.length-b.length||a.localeCompare(b)).map(n=>({n,u:base+encodeURIComponent(n)}));
}
function accOf(t,kind){const it=t[kind==='braille'?'br':'rl'];if(it)return it;return pdfFiles(t,kind).length?{auto:true}:null}
function pdfCoverage(kind,names){
  const keys=new Set();let none=0;for(const n of names){const k=pdfKeys(n);if(!k.size)none++;k.forEach(x=>keys.add(x))}
  let tools=0;for(const t of S.tools.values())if(t.est!=='sucatado'&&toolKeys(t).some(k=>keys.has(k)||keys.has(k.replace(/^([ST]\d{4})[A-Z]$/,'$1'))))tools++;
  return {tools,none};
}
async function savePdfIdx(kind,names,src){
  if(!needDb())return false;const cur=S.pdfidx||{};
  const doc={...cur,[kind]:names,upd:{...(cur.upd||{}),[kind]:nowIso()},src:{...(cur.src||{}),[kind]:src}};
  try{await serial('config/pdfidx',()=>S.db.doc('config/pdfidx').set(doc));S.pdfidx=doc;S.pdfMap=null;refreshAll();renderPdfIdx();setTimeout(()=>mailNoPdf(false),1500);toast(`${names.length} PDFs indexados (${PDF_KINDS.find(x=>x[0]===kind)[1]}).`);return true}catch(e){toast(dbErr(e),1);return false}
}
function renderPdfIdx(){
  const el=$('#pdfIdx');if(!el)return;const ms=msCfg();
  el.innerHTML=`<div class="tw"><table class="t"><thead><tr><th>Pasta</th><th class="num">PDFs</th><th class="num">Cortantes com PDF</th><th>Atualizado</th></tr></thead><tbody>${PDF_KINDS.map(([k,l])=>{const n=(S.pdfidx?.[k]||[]).length;
    const c=n?[...S.tools.values()].filter(t=>t.est!=='sucatado'&&pdfFiles(t,k).length).length:0;
    return `<tr><td>${l}</td><td class="num">${n||'—'}</td><td class="num">${n?c:'—'}</td><td class="small">${S.pdfidx?.upd?.[k]?fmtDT(S.pdfidx.upd[k])+' · '+esc(S.pdfidx.src?.[k]||''):'<span class="muted">nunca</span>'}</td></tr>`}).join('')}</tbody></table></div>
    <div class="row">${ms?'<button class="btn pri" id="pdfSync">Atualizar agora do SharePoint (Microsoft 365)</button>':'<span class="small muted">Leitura direta do SharePoint: ainda não configurada (ver README › Ligação ao Microsoft 365). Enquanto isso, usa o CSV abaixo.</span>'}<span class="small muted" id="pdfSyncMsg"></span></div>
    ${(()=>{const n=[...S.tools.values()].filter(t=>t.est!=='sucatado'&&!pdfUrl(t,'cortante')).length;return `<div class="row"><span class="small"><b>${n}</b> cortantes ativos sem PDF associado.</span>${n?'<button class="btn sm" id="pdfMissing">Ver lista no Armazém</button><button class="btn sm w-only" id="pdfMail">Enviar lista por email</button>':''}<span class="small muted">${S.pdfMail?.ts?'Último envio: '+fmtDT(S.pdfMail.ts)+' ('+S.pdfMail.n+')':''}</span></div>`})()}`;
  $('#pdfSync')&&($('#pdfSync').onclick=()=>pdfSync(true));
  $('#pdfMail')&&($('#pdfMail').onclick=()=>mailNoPdf(true));
  $('#pdfMissing')&&($('#pdfMissing').onclick=()=>{UI.acc='';$('#q').value='';$('#fLocal').value='';$('#fEst').value='ativos';$('#fPdf').value='sem';UI.page=0;go('armazem','lista')});
}
/* ---- leitura direta das pastas pelo Microsoft Graph (opcional; precisa de registo da app no Microsoft Entra) ---- */
const msCfg=()=>{const c=(window.PCV_CONFIG||{}).microsoft||{};return c.clientId?c:null};
let msalApp=null;
async function msToken(interactive,scopes){
  const c=msCfg();if(!c)throw new Error('Microsoft 365 não configurado');
  if(!window.msal)await new Promise((ok,ko)=>{const s=document.createElement('script');s.src=(window.PCV_VENDOR||'js/vendor/')+'msal-browser.min.js';s.onload=ok;s.onerror=()=>ko(new Error('não carregou o MSAL'));document.head.append(s)});
  if(!msalApp){msalApp=new msal.PublicClientApplication({auth:{clientId:c.clientId,authority:'https://login.microsoftonline.com/'+(c.tenantId||'organizations'),redirectUri:new URL('redirect.html',location.href).href},cache:{cacheLocation:'localStorage'}});await msalApp.initialize()}
  const req={scopes:scopes||['Files.Read.All'],account:msalApp.getAllAccounts()[0]};
  try{if(!req.account)throw 0;return (await msalApp.acquireTokenSilent(req)).accessToken}
  catch(e){if(!interactive)throw new Error('sessão Microsoft não iniciada');const all=[...new Set([...req.scopes,'Files.Read.All','Mail.Read','Mail.Read.Shared'])];await msalApp.acquireTokenPopup({scopes:all});return (await msalApp.acquireTokenSilent({scopes:req.scopes,account:msalApp.getAllAccounts()[0]})).accessToken}
}
async function graphList(tok,folderUrl){
  const url=decodeURI(folderUrl.replace(/\/$/,''));const id='u!'+btoa(unescape(encodeURIComponent(url))).replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-');
  let next=`https://graph.microsoft.com/v1.0/shares/${id}/driveItem/children?$select=name,file&$top=999`;const names=[];
  while(next){const r=await fetch(next,{headers:{Authorization:'Bearer '+tok}});if(!r.ok)throw new Error('Graph '+r.status+': '+(await r.text()).slice(0,140));const j=await r.json();
    for(const it of j.value||[])if(it.file&&/\.pdf$/i.test(it.name))names.push(it.name);next=j['@odata.nextLink']||null}
  return names.sort();
}
async function pdfSync(interactive){
  const msg=$('#pdfSyncMsg');const say=t=>{if(msg)msg.textContent=t};
  try{say('A ligar ao Microsoft 365…');const tok=await msToken(interactive);let tot=0;
    for(const [k,l] of PDF_KINDS){const f=folderOf(k);if(!f)continue;say('A ler '+l+'…');const names=await graphList(tok,f);tot+=names.length;await savePdfIdx(k,names,'Microsoft 365')}
    say(tot+' PDFs lidos do SharePoint.');return true}
  catch(e){say('');if(interactive)toast('SharePoint: '+e.message,1);return false}
}
/* atualização automática: quem tem sessão Microsoft (PCV/SUPV) atualiza o índice em segundo plano, no máximo 1 vez a cada 4 horas */
setTimeout(function autoSync(){
  try{if(!msCfg()||!S.db||!roleAtLeast('PCV')||S.pdfidx===undefined)return setTimeout(autoSync,15000);
    const last=Math.min(...PDF_KINDS.map(([k])=>Date.parse(S.pdfidx?.upd?.[k]||0)||0));
    if(Date.now()-last>4*36e5)pdfSync(false)}catch{}
},8000);

/* ============ lista de cortantes sem PDF por email (v26) ============
   Manual (botão) ou automática depois de cada atualização do índice, só se a lista mudou desde o último envio.
   O último envio fica em config/pdfmail = {sig, ts, n, by}. */
const PDF_TO_DEF=['americo.assuncao@graphicsleader.pt','david.malheiro@graphicsleader.pt'];
const pdfTo=()=>S.cl&&S.cl.pdfTo&&S.cl.pdfTo.length?S.cl.pdfTo:PDF_TO_DEF;
function noPdfTools(){return [...S.tools.values()].filter(t=>t.est!=='sucatado'&&!pdfUrl(t,'cortante')).sort((x,y)=>(!x.pos)-(!y.pos)||String(x.pos||'').localeCompare(String(y.pos||''),'pt',{numeric:true})||String(x.cod).localeCompare(String(y.cod)))}
async function mailNoPdf(manual){
  try{
    if(!S.db||!S.loaded.tools)return;
    if(!manual&&!(S.pdfidx&&PDF_KINDS.some(([k])=>(S.pdfidx[k]||[]).length)))return; // sem índice: não envia sozinho
    if(manual&&!needDb())return;
    const a=noPdfTools(),sig=a.map(t=>t.id).join('|');
    if(!manual){if(S.pdfMail&&S.pdfMail.sig===sig)return;if(!EJ())return}
    if(!EJ()){toast('Envio automático de emails não configurado (config.js › emailjs).',1);return}
    if(!a.length&&!manual)return;
    const MAX=500,lines=a.slice(0,MAX).map(t=>[t.pos||'(sem posição)',t.cod,t.cli||t.den||'',EST[t.est||'armazem']].join(' · '));
    const body=`Cortantes ativos sem PDF associado: ${a.length}\n(posição · código · cliente · estado)\n\n`+lines.join('\n')+(a.length>MAX?`\n\n… e mais ${a.length-MAX}. A lista completa está na app: Armazém › Cortantes › filtro "PDF do cortante: Sem PDF" › Exportar Excel.`:'')+
      `\n\nOs PDFs são ligados pelo código no nome do ficheiro (ex.: S1980B → S1980BM02_08EX.pdf), nas pastas 01 - CORTANTES, 00 - BRAILLES e 02 - RELEVOS do SharePoint.\n\nMensagem automática da app PCV Ferramentas.`;
    const b=$('#pdfMail');if(b)b.disabled=true;
    await sendMail(pdfTo(),`[PCV] ${a.length} ${a.length===1?'cortante':'cortantes'} sem PDF – ${fmtD(today())}`,body);
    const rec={sig,ts:nowIso(),n:a.length,by:S.me||''};S.pdfMail=rec;
    try{await S.db.doc('config/pdfmail').set(rec)}catch{}
    toast(`Lista de ${a.length} cortantes sem PDF enviada a ${pdfTo().join(', ')}.`);if(typeof renderPdfIdx==='function')renderPdfIdx();
  }catch(e){toast('Lista sem PDF não enviada: '+e.message,1);const b=$('#pdfMail');if(b)b.disabled=false}
}

/* ============ ligar Brailles e relevos pelo conteúdo dos PDFs (v28) ============
   Lê o texto dos PDFs escolhidos (pdf.js), procura códigos de cortante (S/T + 4 dígitos + letra) e guarda
   config/pdfcont = {braille:{ficheiro:[códigos]}, relevo:{…}, upd:{…}}. Junta ao que já existia. */
const CONT_RE=/(?<![A-Z0-9])([ST])(\d{4})([A-Z])(?!\d)/g;
async function pdfContRead(kind,files){
  const st=$('#pcStat');files=[...files].filter(f=>/\.pdf$/i.test(f.name));if(!files.length){toast('Escolhe ficheiros PDF.',1);return}
  if(!needDb())return;
  const found={},names=[];let n=0,withCode=0,err=0;
  for(const f of files){n++;if(n%5===1||n===files.length)st.innerHTML=`<div class="panel progress"><span class="spin"></span> A ler ${n} de ${files.length}: ${esc(f.name)}</div>`;
    names.push(f.name);
    try{await LIB.pdf();const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer(),isEvalSupported:false}).promise;let txt=f.name+' ';
      for(let p=1;p<=Math.min(pdf.numPages,3);p++){const c=await (await pdf.getPage(p)).getTextContent();txt+=c.items.map(i=>i.str).join(' ')+' '}
      try{pdf.destroy()}catch{}
      const cs=new Set();for(const m of txt.toUpperCase().matchAll(CONT_RE))cs.add(m[1]+m[2]+m[3]);
      if(cs.size){withCode++;found[f.name]=[...cs].slice(0,6)}
    }catch(e){err++}}
  const doc=JSON.parse(JSON.stringify(S.pdfcont||{}));doc[kind]=Object.assign(doc[kind]||{},found);doc.upd=Object.assign(doc.upd||{},{[kind]:nowIso()});
  try{await serial('config/pdfcont',()=>S.db.doc('config/pdfcont').set(doc));S.pdfcont=doc}catch(e){st.innerHTML='';toast(dbErr(e),1);return}
  // acrescenta ao índice os ficheiros que ainda lá não estavam (para o link funcionar)
  const cur=S.pdfidx?.[kind]||[],miss=names.filter(x=>!cur.includes(x));
  if(miss.length)await savePdfIdx(kind,[...cur,...miss],(S.pdfidx?.src?.[kind]||'lista')+' + PDFs');
  S.pdfMap=null;refreshAll();
  const codes=new Set(Object.values(found).flat()),tools=[...S.tools.values()].filter(t=>t.est!=='sucatado'&&toolKeys(t).some(k=>codes.has(k))).length;
  const sem=files.length-withCode-err;
  st.innerHTML=`<div class="panel"><b>${files.length}</b> PDFs lidos · <b>${withCode}</b> com código de cortante · <b>${tools}</b> cortantes ligados${sem?` · ${sem} sem código no texto (ligar à mão na ficha do cortante)`:''}${err?` · ${err} não abriram`:''}.</div>`;
  toast(`${tools} cortantes ligados a ${kind==='braille'?'Brailles':'relevos'}.`);
}
document.addEventListener('change',e=>{if(e.target.id==='pcFiles'&&e.target.files.length){pdfContRead($('#pcKind').value,e.target.files).finally(()=>{e.target.value=''})}});

/* ============ pedidos de compra lidos automaticamente do email (v29) ============
   O Desenho Técnico envia "[PEDIDO DE COMPRA] - 4220018075 - P-002998-04 - …" com o PDF 4220018075.pdf,
   com a caixa precortevinco@graphicsleader.pt em cópia. Com o Microsoft 365 configurado (Mail.Read + Mail.Read.Shared),
   a app lê essa caixa de 20 em 20 minutos (quando um PCV/SUPV tem a app aberta), lê o PDF e grava o pedido em Compras.
   Estado em config/mailsync = {mbx, last, ids:[…], log:[{ts,subj,num,n,err}]}. */
const MAIL_MBX_DEF='precortevinco@graphicsleader.pt';
const mailMbx=()=>S.mailsync?.mbx||MAIL_MBX_DEF;
async function graphGet(tok,url,bin){const r=await fetch(url.startsWith('http')?url:'https://graph.microsoft.com/v1.0'+url,{headers:{Authorization:'Bearer '+tok}});if(!r.ok)throw new Error('Graph '+r.status+': '+(await r.text()).slice(0,160));return bin?r.blob():r.json()}
let mailBusy=false;
async function mailSync(interactive){
  if(mailBusy||!msCfg()||!S.db||!S.loaded.orders)return;mailBusy=true;renderMailBox('A ler o email…');
  const st=JSON.parse(JSON.stringify(S.mailsync||{}));st.ids=st.ids||[];st.log=st.log||[];let novos=0,falhas=0;
  try{
    const tok=await msToken(interactive,['Mail.Read','Mail.Read.Shared']);
    const mbx=mailMbx(),base=mbx?'/users/'+encodeURIComponent(mbx):'/me';
    const since=st.last||new Date(Date.now()-14*864e5).toISOString();
    const q=`${base}/messages?$filter=${encodeURIComponent(`receivedDateTime ge ${since.replace(/\.\d+Z$/,'Z')} and hasAttachments eq true`)}&$select=id,subject,receivedDateTime&$orderby=receivedDateTime asc&$top=50`;
    const j=await graphGet(tok,q);let newest=st.last||since;
    for(const m of j.value||[]){
      if(m.receivedDateTime>newest)newest=m.receivedDateTime;
      if(!/PEDIDO\s+DE\s+COMPRA/i.test(m.subject||'')||st.ids.includes(m.id))continue;
      const num=((m.subject||'').match(/\b(4\d{9})\b/)||[])[1]||'';
      if(num&&S.orders.some(o=>o._id===safeId(num))){st.ids.push(m.id);continue}
      try{
        const at=await graphGet(tok,`${base}/messages/${m.id}/attachments?$select=id,name,contentType,size`);
        const pdfs=(at.value||[]).filter(a=>/\.pdf$/i.test(a.name||'')).sort((a,b)=>(b.name.includes(num)?1:0)-(a.name.includes(num)?1:0)||((/^4\d{9}\.pdf$/i.test(b.name))?1:0)-((/^4\d{9}\.pdf$/i.test(a.name))?1:0));
        let lines=null;
        for(const a of pdfs.slice(0,4)){const blob=await graphGet(tok,`${base}/messages/${m.id}/attachments/${a.id}/$value`,true);lines=parsePO(await pdfText(blob));if(lines)break}
        if(!lines)throw new Error('não encontrei o PDF do pedido no email');
        await saveOrderLines(lines,'email · '+(m.subject||'').slice(0,120),{emailId:m.id});
        novos++;st.log.unshift({ts:nowIso(),subj:(m.subject||'').slice(0,140),num:lines[0].num,n:lines.length});
      }catch(e){falhas++;st.log.unshift({ts:nowIso(),subj:(m.subject||'').slice(0,140),num,err:String(e.message||e).slice(0,160)})}
      st.ids.push(m.id);
    }
    st.ids=st.ids.slice(-300);st.log=st.log.slice(0,30);st.last=newest;st.mbx=mbx;st.ok=nowIso();
    try{await S.db.doc('config/mailsync').set(st);S.mailsync=st}catch{}
    if(novos)toast(`${novos} pedido(s) de compra lido(s) do email.`);
    if(falhas&&interactive)toast(`${falhas} email(s) de pedido não foram lidos – vê o registo em Compras.`,1);
  }catch(e){if(interactive)toast('Email: '+e.message,1);st.erro=String(e.message||e).slice(0,160)}
  finally{mailBusy=false;renderMailBox()}
}
function renderMailBox(busy){
  const el=$('#mailSyncBox');if(!el)return;
  if(!msCfg()){el.innerHTML='Leitura automática dos pedidos por email: falta a ligação ao Microsoft 365 (registo da app no Microsoft Entra, ver README). Até lá, arrasta o PDF do pedido (ex.: 4220018075.pdf) para a caixa acima.';return}
  const s=S.mailsync||{},log=(s.log||[]).slice(0,5);
  el.innerHTML=`<div class="row" style="gap:8px;flex-wrap:wrap"><span>📧 Pedidos lidos do email <b>${esc(mailMbx())}</b>${s.ok?' · última leitura '+fmtDT(s.ok):''}${busy?' · '+esc(busy):''}</span>${roleAtLeast('PCV')?'<button class="btn sm" id="mailNow">Ler agora</button>':''}</div>${log.length?'<div style="margin-top:4px">'+log.map(l=>`<div>${fmtDT(l.ts)} · ${l.err?'<span style="color:var(--nok)">✕ '+esc(l.subj)+' – '+esc(l.err)+'</span>':'✓ '+esc(l.num)+' ('+l.n+' linhas)'}</div>`).join('')+'</div>':''}`;
  $('#mailNow')&&($('#mailNow').onclick=()=>mailSync(true));
}
setTimeout(function mailLoop(){
  try{if(msCfg()&&S.db&&S.loaded.orders&&roleAtLeast('PCV')){const last=Date.parse(S.mailsync?.ok||0)||0;if(Date.now()-last>20*6e4)mailSync(false)}}catch{}
  setTimeout(mailLoop,5*6e4);
},20000);
