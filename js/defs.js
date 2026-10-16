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
  lstSaida:{key:'saidaTo',get:()=>mailTo('saida'),ph:'email@graphicsleader.pt',mail:true,what:'email',fb:true}};
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
  checkRoleCfg();
  Object.keys(LISTS).forEach(renderList);renderEdOp();renderVida();renderMail();
}

/* histórico da ficha visível também para o operador: saídas de máquina */
function exitsPanel(t){
  const a=(S.exits||[]).filter(i=>i.toolId===t.id||i.cod===t.cod).slice(0,10);
  return `<div class="panel"><h4 style="margin-bottom:6px">Saídas de máquina (operador)</h4>${a.length?`<ul class="hist">${a.map(i=>`<li><time>${fmtD(i.data)}</time><span>${esc(i.maq||'')} · ${esc(i.op||'')} · ${fmtN(i.folhas)} folhas</span><span class="grow"></span><span class="pill ${i.res==='OK'?'p-ok':'p-nok'}">${i.res}</span></li>`).join('')}</ul>`:'<p class="small muted" style="margin:0">Sem saídas de máquina registadas.</p>'}</div>`;
}
