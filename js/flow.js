/* ============ Fluxo: mapa gráfico Armazém · Pré-corte e vinco · Máquinas · FAMAG (arrastar e largar) ============ */
const FORN_REP=()=>(S.cl&&S.cl.fornRep)||'FAMAG';
const ZN={A:'Armazém',P:'Pré-corte e vinco',M:'Máquinas',F:FORN_REP()};
const zoneName=z=>z==='F'?FORN_REP():ZN[z];
UI.flowQ='';UI.flowSel=null;
/* em que zona está cada coisa */
function toolZone(t){const e=t.est||'armazem';return e==='maquina'?'M':e==='arrumar'?'P':e==='reparacao'?'F':e==='sucatado'?null:'A'}
function flowData(){
  const z={A:[],P:[],M:{},F:[]};machines().forEach(m=>z.M[m]=[]);
  for(const t of S.tools.values()){const k=toolZone(t);if(!k)continue;if(k==='M'){const m=t.maq||'?';(z.M[m]=z.M[m]||[]).push(t)}else z[k].push(t)}
  const lines={P:[],Fret:[],Fenc:[]};
  for(const o of S.orders||[]){if(o.estado==='Cancelado')continue;(o.linhas||[]).forEach((l,i)=>{
    if(l.rec&&!l.ent){(l.loc==='famag'?lines.Fret:lines.P).push({o,i,l})}
    else if(!l.rec)lines.Fenc.push({o,i,l})})}
  return {z,lines};
}
const toolCard=(t,z)=>`<div class="fcard${UI.flowSel?.id===t.id?' sel':''}" draggable="true" data-ft="${esc(t.id)}" data-fz="${z}" title="Arrasta para outra zona, ou clica e depois clica na zona de destino">
  <b class="mono">${esc(t.cod)}</b><span>${esc((t.cli||t.den||'').slice(0,34))}</span>
  <small>${z==='A'||z==='P'?'Posição <b class="mono">'+esc(t.pos||'—')+'</b>':''}${z==='P'&&t.maqUlt?' · veio de '+esc(t.maqUlt)+(t.arrRes==='NOK'?' <span class="pill p-nok">NOK</span>':''):''}${z==='F'?esc((t.repMot||'reparação').slice(0,40)):''}${z==='M'&&t.maqDesde?'desde '+fmtD(t.maqDesde):''}</small></div>`;
const lineCard=(x,kind)=>{const k=x.o._id+'|'+x.i,sel=UI.flowSel?.k===k;return `<div class="fcard line${sel?' sel':''}" draggable="true" data-fl="${esc(k)}" data-fk="${kind}" title="Linha do pedido ${esc(x.o.num)}">
  <b class="mono">${esc(x.l.cod||x.l.mat||'?')}</b><span>${esc((x.l.desc||'').slice(0,34))}</span>
  <small>${kind==='enc'?'Encomendado · pedido '+esc(x.o.num)+(x.l.entrega?' · entrega '+fmtD(x.l.entrega):''):kind==='ret'?'<span class="pill p-nok">NOK</span> devolvido ao fornecedor':'Recebido '+fmtD(x.l.rec)+(x.l.rq?.res==='NOK'?' <span class="pill p-nok">NOK</span>':'')+' · pedido '+esc(x.o.num)}</small></div>`};
function renderFlow(){
  const el=$('#flowMap');if(!el)return;ZN.F=FORN_REP();
  const {z,lines}=flowData(),nM=Object.values(z.M).reduce((s,a)=>s+a.length,0);
  const q=norm(UI.flowQ||'');const aList=q.length>=2?z.A.filter(t=>norm(t.cod+' '+(t.pos||'')+' '+(t.cli||'')).includes(q)).slice(0,30):[];
  const can=roleAtLeast('PCV');
  $('#flowSum').innerHTML=[['A',z.A.length],['P',z.P.length+lines.P.length],['M',nM],['F',z.F.length+lines.Fret.length]].map(([k,n])=>`<div class="fsum z${k}"><b>${n}</b><span>${zoneName(k)}</span></div>`).join('')+`<div class="fsum zE"><b>${lines.Fenc.length}</b><span>encomendados</span></div>`;
  el.innerHTML=`
  <section class="fzone fzP" data-drop="P"><header><span class="fdot">${z.P.length+lines.P.length}</span><div><h3>Pré-corte e vinco</h3><p>Por arrumar: regressados das máquinas e receções</p></div></header>
    <div class="flist">${z.P.map(t=>toolCard(t,'P')).join('')}${lines.P.map(x=>lineCard(x,'rec')).join('')||''}${!z.P.length&&!lines.P.length?'<p class="fempty">Nada por arrumar.</p>':''}</div></section>
  <section class="fzone fzF" data-drop="F"><header><span class="fdot">${z.F.length+lines.Fret.length}</span><div><h3>${esc(FORN_REP())}</h3><p>Em reparação, devolvidos e encomendas a caminho</p></div></header>
    <div class="flist">${z.F.map(t=>toolCard(t,'F')).join('')}${lines.Fret.map(x=>lineCard(x,'ret')).join('')}${!z.F.length&&!lines.Fret.length?'<p class="fempty">Nenhuma ferramenta no fornecedor.</p>':''}
    ${lines.Fenc.length?`<details class="fenc"><summary>${lines.Fenc.length} encomendados (arrasta para o PCV quando chegarem)</summary>${lines.Fenc.slice(0,60).map(x=>lineCard(x,'enc')).join('')}</details>`:''}</div></section>
  <div class="ftri" aria-hidden="true"><svg viewBox="0 0 200 120"><defs><marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9fb3a7"/></marker></defs>
    <path d="M100 12 L28 104" stroke="#9fb3a7" stroke-width="2" fill="none" marker-end="url(#fa)" stroke-dasharray="5 4"/><path d="M40 112 H160" stroke="#9fb3a7" stroke-width="2" fill="none" marker-end="url(#fa)" stroke-dasharray="5 4"/><path d="M172 104 L104 14" stroke="#9fb3a7" stroke-width="2" fill="none" marker-end="url(#fa)" stroke-dasharray="5 4"/></svg>
    <p class="small muted">Armazém → Máquina → Pré-corte e vinco → Armazém</p></div>
  <section class="fzone fzA" data-drop="A"><header><span class="fdot">${z.A.length}</span><div><h3>Armazém (racks)</h3><p>Procura o cortante para o arrastar</p></div></header>
    <input type="search" id="flowQ" placeholder="Código, posição ou cliente (ex.: S2664)" value="${esc(UI.flowQ||'')}" autocomplete="off">
    <div class="flist">${aList.map(t=>toolCard(t,'A')).join('')||`<p class="fempty">${q.length>=2?'Nenhum cortante em armazém com esse texto.':'Escreve pelo menos 2 caracteres.'}</p>`}</div></section>
  <section class="fzone fzM" data-drop="M"><header><span class="fdot">${nM}</span><div><h3>Máquinas</h3><p>Larga o cortante na máquina que vai abastecer</p></div></header>
    <div class="fmaqs">${Object.entries(z.M).map(([m,ts])=>`<div class="fmaq" data-drop="M" data-maq="${esc(m)}"><div class="row"><b>${esc(m)}</b><span class="grow"></span><span class="pill p-maquina">${ts.length}</span></div>${ts.map(t=>toolCard(t,'M')).join('')||'<p class="fempty">vazia</p>'}</div>`).join('')}</div></section>`;
  const fq=$('#flowQ');fq.oninput=()=>{UI.flowQ=fq.value;const p=fq.selectionStart;renderFlow();const n=$('#flowQ');n.focus();n.setSelectionRange(p,p)};
  $('#flowHint').innerHTML=UI.flowSel?`<b class="mono">${esc(UI.flowSel.label)}</b> selecionado · clica na zona de destino ou <button class="btn sm" id="flowCancel">Cancelar</button>`:(can?'Arrasta um cortante para outra zona (ou clica nele e depois na zona de destino).':'Nível OP: podes registar a saída da máquina arrastando o cortante da máquina para o Pré-corte e vinco.');
  $('#flowCancel')&&($('#flowCancel').onclick=()=>{UI.flowSel=null;renderFlow()});
  document.body.classList.toggle('flow-picking',!!UI.flowSel);
}
/* seleção: arrastar ou clicar */
function selOf(el){
  if(el.dataset.ft){const t=S.tools.get(el.dataset.ft);return t&&{kind:'tool',id:t.id,from:el.dataset.fz,label:t.cod}}
  const [oid,i]=el.dataset.fl.split('|');const o=(S.orders||[]).find(x=>x._id===oid);const l=o?.linhas?.[+i];
  return l&&{kind:'line',k:el.dataset.fl,oid,i:+i,lk:el.dataset.fk,from:el.dataset.fk==='rec'?'P':'F',label:l.cod||l.mat||'linha'};
}
$('#flowMap').addEventListener('dragstart',e=>{const c=e.target.closest('.fcard');if(!c)return;UI.flowSel=selOf(c);e.dataTransfer.setData('text/plain',c.dataset.ft||c.dataset.fl);e.dataTransfer.effectAllowed='move';c.classList.add('drag')});
$('#flowMap').addEventListener('dragend',()=>$$('.fdrop').forEach(x=>x.classList.remove('fdrop')));
$('#flowMap').addEventListener('dragover',e=>{const d=e.target.closest('[data-drop]');if(!d||!UI.flowSel)return;e.preventDefault();$$('.fdrop').forEach(x=>x!==d&&x.classList.remove('fdrop'));d.classList.add('fdrop')});
$('#flowMap').addEventListener('drop',e=>{const d=e.target.closest('[data-drop]');if(!d||!UI.flowSel)return;e.preventDefault();d.classList.remove('fdrop');const s=UI.flowSel;UI.flowSel=null;flowMove(s,d.dataset.drop,d.dataset.maq||'')});
$('#flowMap').addEventListener('click',e=>{
  const c=e.target.closest('.fcard');
  if(c&&!UI.flowSel){UI.flowSel=selOf(c);renderFlow();return}
  if(c&&UI.flowSel&&(c.dataset.ft===UI.flowSel.id||c.dataset.fl===UI.flowSel.k)){UI.flowSel=null;renderFlow();return}
  const d=e.target.closest('[data-drop]');if(d&&UI.flowSel&&!e.target.closest('input,details>summary')){const s=UI.flowSel;UI.flowSel=null;renderFlow();flowMove(s,d.dataset.drop,d.dataset.maq||'')}
});
$('#flowMap').addEventListener('dblclick',e=>{const c=e.target.closest('[data-ft]');if(c){UI.flowSel=null;openTool(c.dataset.ft)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI.flowSel){UI.flowSel=null;renderFlow()}});

/* janela de confirmação (centro do ecrã) */
function flowAsk(title,body,buttons){
  let m=$('#fmodal');if(!m){m=document.createElement('div');m.id='fmodal';m.className='fmodal';document.body.append(m)}
  m.innerHTML=`<div class="fbox" role="dialog" aria-modal="true"><h3>${title}</h3><div class="stack">${body}</div><div class="fbtns">${buttons.map((b,i)=>`<button class="btn${b.pri?' pri':''}${b.danger?' danger':''}" data-fb="${i}">${b.label}</button>`).join('')}<button class="btn" data-fb="x">Cancelar</button></div></div>`;
  m.hidden=false;setTimeout(()=>($('input,select,textarea',m)||$('[data-fb="0"]',m))?.focus(),30);
  m.onclick=async e=>{const b=e.target.closest('[data-fb]');if(!b&&e.target!==m)return;if(!b||b.dataset.fb==='x'){m.hidden=true;return}
    const fn=buttons[+b.dataset.fb].fn;b.disabled=true;const r=await fn(m);if(r!==false)m.hidden=true;else b.disabled=false};
}
const maqSelect=cur=>`<label class="f"><span>Máquina</span><select id="fmMaq">${machines().map(m=>`<option ${m===cur?'selected':''}>${esc(m)}</option>`).join('')}</select></label>`;
async function setTool(t,ch,hist){const n={...t,...ch};addHist(n,hist);const ok=await saveTools([n]);if(ok){toast(hist);renderFlow()}return ok}

function flowMove(s,to,maq){
  if(!S.db){toast('Sem ligação à base de dados.',1);return}
  if(s.from===to&&!(to==='M'&&maq)){renderFlow();return}
  if(!roleAtLeast('PCV')&&!(s.kind==='tool'&&s.from==='M'&&to==='P')){toast('No nível OP só podes registar a saída da máquina (Máquina → Pré-corte e vinco).',1);renderFlow();return}
  if(s.kind==='line')return flowMoveLine(s,to,maq);
  const t=S.tools.get(s.id);if(!t)return;const c=`<b class="mono">${esc(t.cod)}</b>`;
  const toMaq=m=>flowAsk(`${esc(t.cod)} → máquina`,`<p>Abastecer a máquina com o cortante ${c}. A posição <b class="mono">${esc(t.pos||'—')}</b> fica reservada.</p>${maqSelect(m||t.maq)}`,[
    {label:'Fazer controlo de qualidade PCV',pri:true,fn:mm=>{const m2=$('#fmMaq',mm).value;flowGoQual(t,m2)}},
    {label:'Só registar a ida para a máquina',fn:mm=>{const m2=$('#fmMaq',mm).value;return setTool(t,{est:'maquina',maq:m2,maqDesde:nowIso(),arrDesde:'',arrRes:''},`Enviado para a máquina ${m2} (sem controlo PCV registado)`)}}]);
  const toRep=()=>flowAsk(`${esc(t.cod)} → ${esc(FORN_REP())}`,`<p>Enviar ${c} para reparação no fornecedor <b>${esc(FORN_REP())}</b>. A posição fica reservada.</p><label class="f"><span>Motivo *</span><input type="text" id="fmMot" placeholder="ex.: lâmina partida, borrachas gastas"></label>`,[
    {label:'Enviar para reparação',pri:true,fn:mm=>{const mot=$('#fmMot',mm).value.trim();if(!mot){toast('Indica o motivo.',1);return false}return setTool(t,{est:'reparacao',repDesde:today(),repMot:mot,repOrig:'Fluxo · '+zoneName(s.from),repForn:FORN_REP(),maq:'',maqDesde:''},`Enviado para reparação na ${FORN_REP()}: ${mot}`)}}]);
  const toArm=()=>{if(!t.pos){openTool(t.id);$('#dMove')&&$('#dMove').click();return}
    return flowAsk(`${esc(t.cod)} → armazém`,`<p>Arrumar ${c} na sua posição fixa <b class="mono" style="font-size:20px">${esc(t.pos)}</b>${t.local?' · '+esc(t.local):''}.</p>${s.from==='M'?'<p class="small" style="color:var(--warn)">Normalmente o cortante passa primeiro pelo Pré-corte e vinco (controlo de saída).</p>':''}`,[
    {label:`Arrumar em ${esc(t.pos)}`,pri:true,fn:()=>setTool(t,{est:'armazem',maq:'',maqDesde:'',arrDesde:'',arrRes:''},`Arrumado na posição ${t.pos}`+(s.from==='F'?` (regressou da ${FORN_REP()})`:''))}])};
  const toPcv=()=>{
    if(s.from==='M')return flowAsk(`${esc(t.cod)} saiu da máquina ${esc(t.maq||'')}`,`<p>O cortante ${c} sai da máquina e fica no Pré-corte e vinco à espera de ser arrumado.</p>`,[
      {label:'Fazer controlo de saída (operador)',pri:true,fn:()=>flowGoExit(t)},
      ...(roleAtLeast('PCV')?[{label:'Só mover (sem controlo)',fn:()=>setTool(t,{est:'arrumar',arrDesde:nowIso(),arrRes:'',maqUlt:t.maq||'',maq:'',maqDesde:''},`Saiu da máquina ${t.maq||''} para o PCV (sem controlo de saída)`)}]:[])]);
    if(s.from==='F')return flowAsk(`${esc(t.cod)} regressou da ${esc(FORN_REP())}`,`<p>O cortante ${c} voltou da reparação e fica no Pré-corte e vinco para ser verificado e arrumado.</p>`,[
      {label:'Confirmar regresso',pri:true,fn:()=>setTool(t,{est:'arrumar',arrDesde:nowIso(),arrRes:'',repDesde:'',repMot:'',repOrig:''},`Regressou da reparação (${FORN_REP()}) · no PCV`)}]);
    return flowAsk(`${esc(t.cod)} → Pré-corte e vinco`,`<p>Retirar ${c} da posição <b class="mono">${esc(t.pos||'—')}</b> para o Pré-corte e vinco (a posição fica reservada).</p>`,[
      {label:'Retirar para o PCV',pri:true,fn:()=>setTool(t,{est:'arrumar',arrDesde:nowIso(),arrRes:''},'Retirado do armazém para o PCV')}]);
  };
  if(to==='M')return toMaq(maq);if(to==='F')return toRep();if(to==='A')return toArm();if(to==='P')return toPcv();
}
function flowMoveLine(s,to,maq){
  const o=(S.orders||[]).find(x=>x._id===s.oid);if(!o)return;const l=o.linhas[s.i];const c=`<b class="mono">${esc(l.cod||l.mat||'')}</b> (pedido ${esc(o.num)})`;
  const setLoc=async(loc,msg)=>{const ls=o.linhas.map(x=>({...x}));if(loc)ls[s.i].loc=loc;else ls[s.i].loc='';const ok=await setOrderLines(o,ls);if(ok){toast(msg);renderFlow()}return ok};
  if(s.lk==='enc'){
    if(to!=='P'){toast('Uma encomenda tem de ser recebida primeiro: arrasta-a para o Pré-corte e vinco.',1);return}
    return flowAsk('Chegou material',`<p>Registar a chegada de ${c}. Abre a verificação da receção (3 pontos).</p>`,[{label:'Confirmar chegada',pri:true,fn:()=>{openReception(o,s.i,ls=>setOrderLines(o,ls))}}]);
  }
  if(to==='F'){if(s.lk==='ret')return;return flowAsk(`Devolver ao fornecedor`,`<p>${c} volta para o fornecedor (${esc(o.forn||FORN_REP())}). Deixa de contar como por arrumar.</p>`,[{label:'Devolver',pri:true,danger:true,fn:()=>setLoc('famag','Ferramenta devolvida ao fornecedor.')}])}
  if(to==='P'){if(s.lk==='ret')return flowAsk('Voltou do fornecedor',`<p>${c} voltou e fica no Pré-corte e vinco por arrumar.</p>`,[{label:'Confirmar',pri:true,fn:()=>setLoc('','Ferramenta de volta ao PCV.')}]);return}
  if(to==='A')return flowAsk('Dar entrada no armazém',`<p>Registar ${c} como cortante e escolher a posição nas racks.</p>`,[{label:'Escolher posição',pri:true,fn:()=>{arrumar(o,s.i)}}]);
  if(to==='M')return flowAsk('Entrada direta na máquina',`<p>Registar ${c} como cortante (com a posição que vai ficar reservada nas racks) e enviá-lo já para a máquina.</p>${maqSelect(maq)}`,[{label:'Registar e enviar',pri:true,fn:mm=>{const m2=$('#fmMaq',mm).value;arrumarMaq(o,s.i,m2)}}]);
}
function arrumarMaq(o,i,maq){const l=o.linhas[i];
  openToolForm(null,{cod:l.cod||'',mat:l.mat||'',den:l.desc||'',ult:today(),notas:'Pedido '+o.num,onSaved:async t=>{const cur=S.orders.find(x=>x._id===o._id)||o;const ls=cur.linhas.map(x=>({...x}));ls[i].ent=today();ls[i].entPos=t.pos||'';await setOrderLines(cur,ls);
    const n={...S.tools.get(t.id),est:'maquina',maq,maqDesde:nowIso()};addHist(n,'Enviado diretamente para a máquina '+maq);await saveTools([n]);renderPend()}})}
/* atalhos para os controlos de qualidade, já preenchidos */
function flowGoQual(t,maq){UI.qual='nova';go('qualidade');Q.tool=t;$('#qCod').value=t.cod;renderToolInfo();const s=$('#qMaq');if(s&&maq)s.value=maq;toast('Faz a checklist; ao gravar OK o cortante fica na máquina '+maq+'.')}
function flowGoExit(t){UI.op='nova';go('operador');X.tool=t;$('#xCod').value=t.cod;if(t.maq&&machines().includes(t.maq))$('#xMaq').value=t.maq;renderExitTool();toast('Faz a checklist de saída e indica as folhas cortadas.')}
/* receção NOK: perguntar onde fica a ferramenta (não assumir) */
function askNcLocation(o,i){
  const cur=()=>S.orders.find(x=>x._id===o._id)||o;const l=cur().linhas[i];const c=`<b class="mono">${esc(l.cod||l.mat||'')}</b>`;
  setTimeout(()=>flowAsk('Onde fica esta ferramenta?',`<p>A receção de ${c} ficou <b style="color:var(--nok)">não conforme</b>. Para onde a queres transferir?</p>`,[
    {label:`Devolver à ${esc(FORN_REP())}`,danger:true,fn:async()=>{const x=cur();const ls=x.linhas.map(y=>({...y}));ls[i].loc='famag';await setOrderLines(x,ls);toast('Ferramenta na '+FORN_REP()+'.')}},
    {label:'Fica no Pré-corte e vinco',fn:()=>toast('Fica no PCV, por arrumar.')},
    {label:'Armazém (escolher posição)',fn:()=>{closeDrawer();arrumar(cur(),i)}},
    {label:'Máquina',fn:mm=>{flowAsk('Máquina',`<p>Enviar ${c} para a máquina:</p>${maqSelect('')}`,[{label:'Registar e enviar',pri:true,fn:m2=>{closeDrawer();arrumarMaq(cur(),i,$('#fmMaq',m2).value)}}]);return false}}]),400);
}
function renderHomeFlow(){const el=$('#homeFlow');if(!el||!S.loaded.tools)return;const {z,lines}=flowData(),nM=Object.values(z.M).reduce((s,a)=>s+a.length,0);
  el.innerHTML=[['A',z.A.length],['P',z.P.length+lines.P.length],['M',nM],['F',z.F.length+lines.Fret.length]].map(([k,n])=>`<div class="fsum z${k}"><b>${n}</b><span>${zoneName(k)}</span></div>`).join('')+'<span class="small muted" style="align-self:center">› ver fluxo</span>'}
{const _ra=refreshAll;refreshAll=function(){_ra();if(UI.view==='fluxo')renderFlow();if(UI.view==='inicio')renderHomeFlow()}}
