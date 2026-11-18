"use strict";
/* ============ Requisições de material (v41) — só PCV e Supervisão ============
   Loja interna: categorias com foto, +/-, carrinho, envio por email com template SAP.
   Chapas 1mm precisam de autorização (código 12345678) do João Campos. */
const REQ_TO='diana.verissimo@graphicsleader.pt';
const REQ_CC='nelson.rodrigues@graphicsleader.pt';
const REQ_AUTH_TO='joao.campos@graphicsleader.pt';
const REQ_AUTH_CODE='12345678';
const REQ_CATS=[
  {id:'chapas',nome:'Chapas corte e vinco',img:'img/req/chapas.jpg',auth:true,itens:[
    {mm:'4000000670',d:'Chapa 1mm 40HRC 104'},{mm:'4000000720',d:'Chapa 1mm 40HRC 106'},{mm:'4000000802',d:'Chapa 1mm 40HRC 142'}]},
  {id:'fitas',nome:'Fitas de alceamento',img:'img/req/fitas.jpg',itens:[
    {mm:'4000000212',d:'Fita alceamento 0,04mm BSA1574000100'},{mm:'4000000210',d:'Fita alceamento Verm 3mm BSA1089070900'},{mm:'4000001017',d:'Fita alceamento Amar 3mm BSA1089070400'}]},
  {id:'tesa',nome:'Fita TESA 4964',img:'img/req/tesa.jpg',itens:[
    {mm:'4000000891',d:'TESA 4964 30MM*50M'},{mm:'4000000890',d:'TESA 4964 310MM*50M'}]},
  {id:'cola',nome:'Cola forte plus',img:'img/req/cola.jpg',itens:[
    {mm:'4000000521',d:'COLA FORTE PLUS - (50GR) CA2050'}]},
  {id:'cito',nome:'Cito / Matrizes',img:'img/req/cito.jpg',itens:[
    {mm:'4000000171',d:'MATRIZES (RY) VINCO 0.6 x 1.6 mm'},{mm:'4000000167',d:'MATRIZES (IK) VINCO 0.8 x 2.3 mm'},
    {mm:'4000000770',d:'MATRIZ CITO ULTIMATE 0.5X1.5'},{mm:'4000000169',d:'MATRIZES (IK) VINCO 0.8 x 2.7 mm'},
    {mm:'4000000593',d:'Matrizes (RY) Vinco 0.6*1.9 mm'},{mm:'4000000911',d:'MATRIZ CITO ULTIMATE 0.5X1.9'},
    {mm:'4000001172',d:'Matriz CITO ULTIMATE 2-3 PT. 0.8*1.9 MM'},{mm:'4000000930',d:'MATRIZ CITO ULTIMATE 0.5X2.1'},
    {mm:'4000000591',d:'Matrizes (RY) Vinco 0.6*1.6 mm'},{mm:'4000000052',d:'Matrizes (RY) Vinco 0.7*1.7 mm'},
    {mm:'4000000970',d:'Channel CITO ULTIMATE 2-3 PT 0.4*1.5 mm'},{mm:'4000000048',d:'Matrizes (RY) Vinco 0.7*2.1 mm'},
    {mm:'4000000514',d:'MATRIZES (IK) VINCO 0.6x 2.1 mm'},{mm:'4000000516',d:'MATRIZES (IK) VINCO 0.6 x 2.5 mm'},
    {mm:'4000000517',d:'MATRIZES (IK) VINCO 0.6 x 2.7 mm'},{mm:'4000000518',d:'MATRIZES (IK) VINCO 0.6 x 3.0 mm'},
    {mm:'4000000542',d:'MATRIZES (IK) VINCO 0.7 x 2.3 mm'},{mm:'4000000168',d:'MATRIZES (IK) VINCO 0.8 x 2.5 mm'},
    {mm:'4000000280',d:'Cris Sil 70'}]},
];
const REQ_ALLMM={};REQ_CATS.forEach(c=>c.itens.forEach(i=>REQ_ALLMM[i.mm]={...i,cat:c.id,auth:!!c.auth}));
let reqCart={};// mm -> qtd
const reqIsChapa1=mm=>REQ_ALLMM[mm]&&REQ_ALLMM[mm].auth;

function renderReq(){
  const el=$('#reqCats');if(!el)return;
  renderReqAuthBox();
  el.innerHTML=REQ_CATS.map(c=>`<div class="reqcat"><div class="reqcat-head"><img src="${c.img}" alt="${esc(c.nome)}"><h3>${esc(c.nome)}${c.auth?' <span class="pill p-reparacao">precisa autorização</span>':''}</h3></div>
    <div class="reqitems">${c.itens.map(i=>{const q=reqCart[i.mm]||0;return `<div class="reqitem"><div class="reqitem-info"><b>${esc(i.d)}</b><span class="mono small muted">${esc(i.mm)}</span></div>
      <div class="qtybox"><button class="qbtn" data-qdec="${i.mm}">−</button><input class="qin" data-qin="${i.mm}" value="${q}" inputmode="numeric"><button class="qbtn" data-qinc="${i.mm}">+</button></div></div>`}).join('')}</div></div>`).join('');
  updReqCartN();
}
function updReqCartN(){const n=Object.values(reqCart).reduce((a,b)=>a+(+b||0),0);if($('#reqCartN'))$('#reqCartN').textContent=n;}
function renderReqAuthBox(){
  const box=$('#reqAuthBox');if(!box)return;
  const pend=(S.reqAuth||[]).filter(r=>r.estado==='pendente');
  const canAuth=norm(getName()).includes('joao campos')||norm(getName()).includes('joão campos')||roleAtLeast('SUPV');
  if(!pend.length){box.innerHTML='';return}
  box.innerHTML=`<div class="panel" style="border-color:var(--warn);background:#fffaf0">
    <b>Autorizações pendentes de chapa 1&nbsp;mm (${pend.length})</b>
    ${pend.map(r=>`<div class="row" style="margin-top:6px;gap:8px;flex-wrap:wrap"><span class="grow">${fmtDT(r.ts)} · ${esc(r.by||'')} · ${r.itens.map(i=>esc(i.d)+' ×'+i.q).join(', ')}</span>
      ${canAuth?`<input type="password" class="reqcode" data-code="${r.id}" placeholder="Código" style="width:110px"><button class="btn sm pri" data-authok="${r.id}">Autorizar</button>`:'<span class="small muted">aguarda João Campos</span>'}</div>`).join('')}</div>`;
}
document.addEventListener('click',e=>{
  const inc=e.target.closest('[data-qinc]'),dec=e.target.closest('[data-qdec]');
  if(inc){reqCart[inc.dataset.qinc]=(+reqCart[inc.dataset.qinc]||0)+1;$(`[data-qin="${inc.dataset.qinc}"]`).value=reqCart[inc.dataset.qinc];updReqCartN()}
  if(dec){const mm=dec.dataset.qdec;reqCart[mm]=Math.max(0,(+reqCart[mm]||0)-1);$(`[data-qin="${mm}"]`).value=reqCart[mm];if(!reqCart[mm])delete reqCart[mm];updReqCartN()}
});
document.addEventListener('input',e=>{const i=e.target.closest('[data-qin]');if(i){const v=Math.max(0,parseInt(i.value)||0);if(v)reqCart[i.dataset.qin]=v;else delete reqCart[i.dataset.qin];updReqCartN()}});

// carrinho
$('#reqCartBtn')&&($('#reqCartBtn').onclick=openReqCart);
function openReqCart(){
  const items=Object.entries(reqCart).filter(([,q])=>q>0).map(([mm,q])=>({...REQ_ALLMM[mm],q}));
  if(!items.length){toast('O carrinho está vazio.',1);return}
  const ov=document.createElement('div');ov.className='ckmodal';ov.style.zIndex='95';
  const chapas=items.filter(i=>i.auth),normal=items.filter(i=>!i.auth);
  ov.innerHTML=`<div class="ckbox" style="max-width:620px"><div class="ckhead"><div class="grow"><h3>Carrinho de requisição</h3><p class="small muted">Vai para ${REQ_TO} (cc ${REQ_CC}), com o template SAP para copiar.</p></div><button class="btn sm" id="rcX">Fechar</button></div>
    <div class="tw"><table class="t"><thead><tr><th>MM</th><th>Descrição</th><th>Qtd</th></tr></thead><tbody>${items.map(i=>`<tr><td class="mono">${esc(i.mm)}</td><td>${esc(i.d)}${i.auth?' <span class="pill p-reparacao">1mm</span>':''}</td><td class="mono">${i.q}</td></tr>`).join('')}</tbody></table></div>
    ${chapas.length?`<p class="small" style="color:var(--warn);margin-top:8px">Inclui chapa 1&nbsp;mm: a requisição precisa de autorização do João Campos antes de seguir.</p>`:''}
    <div class="row" style="margin-top:12px"><button class="btn pri" id="rcSend">${chapas.length?'Pedir autorização e enviar':'Confirmar e enviar'}</button><button class="btn" id="rcNo">Cancelar</button></div></div>`;
  document.body.append(ov);
  ov.querySelector('#rcX').onclick=ov.querySelector('#rcNo').onclick=()=>ov.remove();
  ov.addEventListener('click',ev=>{if(ev.target===ov)ov.remove()});
  ov.querySelector('#rcSend').onclick=async()=>{await sendReq(items,chapas.length>0);ov.remove()};
}
function sapTemplate(items){
  // template para copy-paste no SAP: MM<TAB>Qtd por linha
  return items.map(i=>`${i.mm}\t${i.q}\t${i.d}`).join('\n');
}
async function sendReq(items,needsAuth){
  if(!needDb())return;
  const corpo=`Requisição de material — Pré-corte e vinco\nData: ${fmtD(today())}\nPedido por: ${getName()||''}\n\nMM\tQtd\tDescrição\n${sapTemplate(items)}\n\n(Template pronto a copiar para o SAP.)`;
  if(needsAuth){
    const id='RA'+uid();const rec={id,ts:nowIso(),by:getName()||'',itens:items.map(i=>({mm:i.mm,d:i.d,q:i.q})),estado:'pendente',corpo};
    const list=[...(S.reqAuth||[]),rec];
    try{await S.db.doc('config/reqauth').set({items:list});S.reqAuth=list}catch(e){toast(dbErr(e),1);return}
    // email a avisar o João Campos
    if(mailOn())try{await sendMail([REQ_AUTH_TO],`[Autorização] Requisição de chapa 1mm — ${fmtD(today())}`,`Há uma requisição de chapa 1mm à espera da tua autorização na app (Requisições).\n\n${corpo}\n\nAutoriza na app com o teu código.`)}catch{}
    toast('Pedido de autorização enviado ao João Campos. A requisição segue depois de autorizada.');
  }else{
    if(!mailOn()){toast('Envio de email não configurado (Outlook ou EmailJS).',1);return}
    try{await sendMail([REQ_TO],`Requisição de material — Pré-corte e vinco — ${fmtD(today())}`,corpo,{cc:REQ_CC});
      await logReq(items,'enviada');toast(`Requisição enviada a ${REQ_TO}.`);reqCart={};renderReq()}
    catch(e){toast('Não enviada: '+e.message,1)}
  }
}
async function logReq(items,estado){try{const list=[...(S.reqLog||[]),{ts:nowIso(),by:getName()||'',itens:items.map(i=>({mm:i.mm,q:i.q})),estado}];await S.db.doc('config/reqlog').set({items:list.slice(-200)});S.reqLog=list}catch{}}
// autorizar
document.addEventListener('click',async e=>{const b=e.target.closest('[data-authok]');if(!b)return;
  const id=b.dataset.authok,code=$(`[data-code="${id}"]`)?.value||'';
  if(code!==REQ_AUTH_CODE){toast('Código incorreto.',1);return}
  const r=(S.reqAuth||[]).find(x=>x.id===id);if(!r)return;
  if(!needDb())return;
  const list=(S.reqAuth||[]).map(x=>x.id===id?{...x,estado:'autorizada',authTs:nowIso(),authBy:getName()||''}:x);
  try{await S.db.doc('config/reqauth').set({items:list});S.reqAuth=list}catch(e){toast(dbErr(e),1);return}
  // agora envia a requisição a compras
  if(mailOn())try{await sendMail([REQ_TO],`Requisição de material (autorizada) — Pré-corte e vinco — ${fmtD(today())}`,r.corpo+`\n\nAutorizada por ${getName()||''} em ${fmtDT(nowIso())}.`,{cc:REQ_CC})}catch{}
  toast('Autorizada e enviada a compras.');renderReqAuthBox();
});
