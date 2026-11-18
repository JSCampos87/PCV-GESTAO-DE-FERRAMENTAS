/* ============ vista 3D ============ */
let r3Ready=null;
function sync3D(){
  if(UI.view!=='armazem'||!S.loaded.tools)return;
  if(!r3Ready){Rack3D.describe=p=>{const ts=occupied().get(p);return p+(ts?' · '+ts.map(t=>t.cod).join(', '):' · livre')};Rack3D.onPick=p=>{$('#r3info').textContent=Rack3D.describe(p)};r3Ready=Rack3D.mount($('#r3view'))}
  r3Ready.then(ok=>{if(!ok)return;Rack3D.setData(allPositions(),new Set(occupied().keys()));Rack3D.highlight(UI.hl3d||[]);
    const n=(UI.hl3d||[]).length;$('#r3info').textContent=n?(n===1?'Posição '+UI.hl3d[0]+' a amarelo':n+' posições a amarelo'):'Procura um cortante para o ver a amarelo'});
}
$('#r3reset').onclick=()=>Rack3D.reset();
$('#r3big').onclick=()=>{const c=$('#r3card');const big=c.classList.toggle('big');$('#r3big').textContent=big?'Fechar':'Ampliar'};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#r3card').classList.contains('big')){$('#r3card').classList.remove('big');$('#r3big').textContent='Ampliar'}});

/* ============ operador: saída de máquina ============ */
const X={tool:null,ans:{}};
function renderExitList(){
  const g=opGroups();
  $('#xList').innerHTML=g.map((gr,gi)=>`<div class="cl-group"><h4><span class="n">${gi+1}.</span> ${esc(gr.name)}</h4>${gr.items.map((it,ii)=>{const k=gi+'.'+ii,a=X.ans[k]||{};return `<div class="cl-item" data-k="${k}"><span>${esc(it)}</span><div class="tri" role="group" aria-label="${esc(it)}"><button class="o" aria-pressed="${a.r==='OK'}" data-r="OK">OK</button><button class="n" aria-pressed="${a.r==='NOK'}" data-r="NOK">NOK</button><button class="a" aria-pressed="${a.r==='NA'}" data-r="NA">N/A</button></div>${a.r==='NOK'?`<input class="cmt" type="text" data-c="${k}" value="${esc(a.c||'')}" placeholder="Descreve o problema (obrigatório)">`:''}</div>`}).join('')}</div>`).join('');
  exitVerdict();
}
function exitVerdict(){
  const g=opGroups();let tot=0,done=0,nok=0;g.forEach((gr,gi)=>gr.items.forEach((_,ii)=>{tot++;const a=X.ans[gi+'.'+ii];if(a?.r)done++;if(a?.r==='NOK')nok++}));
  $('#xVerdict').innerHTML=done<tot?`<div class="verdict pend">${done} de ${tot} pontos verificados</div>`:nok?`<div class="verdict nok">Cortante NOK · ${nok} ${nok===1?'ponto':'pontos'} com problema</div>`:`<div class="verdict ok">Cortante OK · todos os pontos conformes</div>`;
  $('#xRepWrap').hidden=!nok;return {tot,done,nok};
}
$('#xList').addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(!b)return;const k=b.closest('[data-k]').dataset.k;X.ans[k]={...(X.ans[k]||{}),r:b.dataset.r};renderExitList();if(b.dataset.r==='NOK')$(`#xList [data-c="${k}"]`)?.focus()});
$('#xList').addEventListener('input',e=>{const k=e.target.dataset.c;if(k)X.ans[k].c=e.target.value});
toolAc($('#xCod'),$('#xAc'),t=>{X.tool=t;$('#xCod').value=t.cod;renderExitTool()});
$('#xCod').addEventListener('input',()=>{X.tool=null;renderExitTool()});
$('#xFolhas').addEventListener('input',renderExitTool);$('#xMaq').addEventListener('change',renderExitTool);
function renderExitTool(){
  const t=X.tool||[...S.tools.values()].find(x=>x.cod===$('#xCod').value.trim().toUpperCase()&&x.est!=='sucatado');if(t&&!X.tool)X.tool=t;
  if(!t){$('#xTool').innerHTML='';return}
  if(t.est==='maquina'&&t.maq&&!$('#xMaq').value&&machines().includes(t.maq))$('#xMaq').value=t.maq;
  const n=Math.max(0,Math.round(+$('#xFolhas').value)||0),cur=+t.folhas||0,tot=cur+n,lim=vidaMax(t);
  const mq=$('#xMaq').value,pp=(t.param||{})[mq];
  $('#xTool').innerHTML=(mq?`<div class="sugg" style="margin-bottom:8px">Parâmetros ideais na <b>${esc(mq)}</b>: ${pp?`pressão <b class="mono">${esc(pp.p||'—')}</b> · velocidade <b class="mono">${esc(pp.v||'—')}</b>${pp.n?' · '+esc(pp.n):''}`:'ainda não registados para esta máquina (ficha do cortante › Editar)'}</div>`:'')+`<div class="row" style="gap:14px"><span><b class="mono">${esc(t.cod)}</b> · ${esc(t.cli||'')} · posição <b class="mono">${esc(t.pos||'—')}</b></span><span class="grow"></span><span>Vida atual <b class="mono">${fmtN(cur)}</b>${n?` → depois deste registo <b class="mono" style="color:${tot>=lim?'var(--nok)':'inherit'}">${fmtN(tot)}</b>`:''} / ${fmtN(lim)} folhas</span></div>${vidaBar({folhas:tot,vidaMax:t.vidaMax})}${tot>=lim?`<div class="banner" style="margin:8px 0 0;background:var(--nok-soft);color:var(--nok)">Atenção: com este registo o cortante ultrapassa ${fmtN(lim)} folhas. Avisar o PCV para avaliar a substituição.</div>`:''}`;
}
function exitCollect(){
  const g=opGroups(),v=exitVerdict();const cod=$('#xCod').value.trim().toUpperCase();const itens=[];
  g.forEach((gr,gi)=>gr.items.forEach((it,ii)=>{const a=X.ans[gi+'.'+ii]||{};itens.push({g:gr.name,t:it,r:a.r||'',c:a.c||''})}));
  const t=X.tool?.cod===cod?X.tool:null;const folhas=Math.max(0,Math.round(+$('#xFolhas').value)||0);
  return {kind:'saida',cod,toolId:t?.id||'',maq:$('#xMaq').value.trim(),data:$('#xData').value||today(),op:$('#xOp').value.trim(),folhas,total:(+t?.folhas||0)+folhas,obs:$('#xObs').value.trim(),itens,res:v.nok?'NOK':'OK',v};
}
let xLast=null;
$('#xSave').onclick=async()=>{
  const c=exitCollect();if(!c.cod){toast('Indica o código do cortante.',1);$('#xCod').focus();return}
  if(!c.toolId){toast('Escolhe o cortante da lista para somar as folhas à vida dele.',1);$('#xCod').focus();return}
  if(!c.maq){toast('Escolhe a máquina.',1);$('#xMaq').focus();return}
  if(!c.op){toast('Indica o nome do operador.',1);$('#xOp').focus();return}
  if(!(c.folhas>0)){toast('Indica o número de folhas cortadas.',1);$('#xFolhas').focus();return}
  if(c.v.done<c.v.tot){toast(`Faltam ${c.v.tot-c.v.done} pontos por verificar.`,1);return}
  if(c.itens.some(i=>i.r==='NOK'&&!i.c.trim())){toast('Descreve o problema em cada ponto NOK.',1);return}
  if(!needDb())return;setName(c.op);
  const rep=c.res==='NOK'&&$('#xRep').checked;const lim=vidaMax(S.tools.get(c.toolId));
  const doc={kind:'saida',ts:nowIso(),data:c.data,cod:c.cod,toolId:c.toolId,maq:c.maq,op:c.op,folhas:c.folhas,total:c.total,obs:c.obs,res:c.res,itens:c.itens.map(i=>{const o={g:i.g,t:i.t,r:i.r};if(i.c)o.c=i.c;return o}),by:S.me||'',nivel:(typeof ROLE!=='undefined'&&ROLE)||'',repar:!!rep};
  try{await S.db.collection('exits').doc(safeId(c.data+'_'+c.cod+'_'+uid())).set(doc);
    const t=S.tools.get(c.toolId);if(t){const n={...t,folhas:c.total,folhasUpd:today()};n.maq='';n.maqDesde='';n.maqUlt=c.maq;if(!rep){n.est='arrumar';n.arrDesde=nowIso();n.arrRes=c.res}if(rep){n.est='reparacao';n.repDesde=today();n.repMot=c.itens.filter(i=>i.r==='NOK').map(i=>i.g+': '+i.t+(i.c?' ('+i.c+')':'')).join('; ');n.repOrig='Saída de máquina'+(c.maq?' · '+c.maq:'')}
      addHist(n,`Saída de máquina${c.maq?' '+c.maq:''}: ${fmtN(c.folhas)} folhas (total ${fmtN(c.total)}) · ${c.res}`+(rep?' · enviado para reparação':' · aguarda arrumação no armazém'));await saveTools([n])}
    if(c.total>=lim&&(+t?.folhas||0)<lim)notifyAlert('vida',`Cortante ${c.cod} ultrapassou ${fmtN(lim)} folhas`,`O cortante ${c.cod} (posição ${t?.pos||'—'}) atingiu ${fmtN(c.total)} folhas cortadas, acima do limite de vida de ${fmtN(lim)}.\n\nÚltimo registo: ${fmtD(c.data)} · máquina ${c.maq} · operador ${c.op} · ${fmtN(c.folhas)} folhas.\n\nAvaliar substituição ou reparação.`);
    if(c.res==='NOK')notifyAlert('saida',`Saída NOK de máquina – cortante ${c.cod}`,`O cortante ${c.cod} foi marcado NOK à saída da máquina ${c.maq} por ${c.op} em ${fmtD(c.data)}${rep?' e enviado para reparação':''}.\n\nPontos NOK:\n`+c.itens.filter(i=>i.r==='NOK').map(i=>'- '+i.g+': '+i.t+(i.c?' ('+i.c+')':'')).join('\n'));
    xLast=doc;toast(c.total>=lim?`Registo guardado. ATENÇÃO: ${c.cod} tem ${fmtN(c.total)} folhas, acima do limite de ${fmtN(lim)}.`:'Registo guardado.',c.total>=lim);
    X.ans={};X.tool=null;['#xCod','#xObs','#xFolhas'].forEach(s=>$(s).value='');renderExitList();renderExitTool();
    ckDone('x');await inspPdf(doc,true);
  }catch(e){toast(dbErr(e),1)}
};
$('#xPdf').onclick=()=>{const c=exitCollect();if(c.cod)return inspPdf({...c,ts:''},true);if(xLast)return inspPdf(xLast,true);toast('Indica o código do cortante.',1)};
$('#xReset').onclick=()=>{X.ans={};X.tool=null;['#xCod','#xObs','#xFolhas'].forEach(s=>$(s).value='');fillOpSelect();$('#xData').value=today();renderExitList();renderExitTool()};
function filteredExits(){const q=norm($('#xq').value),r=$('#xRes').value;return S.exits.filter(i=>(!r||i.res===r)&&(!q||norm([i.cod,i.maq,i.op,i.obs].join(' ')).includes(q)))}
function renderExitHist(){const a=filteredExits();const lim=vidaMax();
  $('#xRows').innerHTML=!S.loaded.exits?`<tr><td colspan="8" class="empty">${S.db?'A carregar…':'Sem ligação à base de dados.'}</td></tr>`:a.length?a.slice(0,400).map(i=>`<tr class="click" data-exit="${esc(i._id)}"><td class="mono small">${fmtD(i.data)}</td><td class="code">${esc(i.cod)}</td><td>${esc(i.maq||'')}</td><td>${esc(i.op||'')}</td><td class="num">${fmtN(i.folhas)}</td><td class="num" style="${(+i.total||0)>=lim?'color:var(--nok);font-weight:600':''}">${fmtN(i.total)}</td><td><span class="pill ${i.res==='OK'?'p-ok':'p-nok'}">${i.res}</span>${i.repar?' <span class="tag">reparação</span>':''}</td><td class="small">${esc((i.itens||[]).filter(x=>x.r==='NOK').map(x=>x.g+': '+x.t).join('; '))}</td></tr>`).join(''):`<tr><td colspan="8" class="empty">${S.exits.length?'Nenhum registo corresponde ao filtro.':'Ainda não há registos de saída de máquina.'}</td></tr>`}
['#xq','#xRes'].forEach(s=>$(s).addEventListener('input',renderExitHist));
$('#xRows').addEventListener('click',e=>{const r=e.target.closest('[data-exit]');if(!r)return;const d=S.exits.find(i=>i._id===r.dataset.exit);if(!d)return;
  openDrawer(`<div class="dh"><div class="grow"><h3>${esc(d.cod)}</h3><p>Saída de máquina · ${fmtD(d.data)} · ${esc(d.maq||'')} · ${esc(d.op||'')}</p></div><button class="btn sm" data-close>Fechar</button></div>
  <div class="verdict ${d.res==='OK'?'ok':'nok'}">${d.res==='OK'?'Cortante OK':'Cortante NOK'}${d.repar?' · enviado para reparação':''}</div>
  <div class="panel"><div class="row"><span class="grow">Folhas cortadas</span><b class="mono">${fmtN(d.folhas)}</b></div><div class="row"><span class="grow">Vida acumulada após o registo</span><b class="mono">${fmtN(d.total)}</b></div>${vidaBar({folhas:d.total})}</div>
  <div class="tw"><table class="t"><thead><tr><th>Grupo</th><th>Ponto</th><th>Resultado</th></tr></thead><tbody>${(d.itens||[]).map(i=>`<tr><td>${esc(i.g)}</td><td>${esc(i.t)}${i.c?`<div class="small" style="color:var(--nok)">${esc(i.c)}</div>`:''}</td><td><span class="pill ${i.r==='OK'?'p-ok':i.r==='NOK'?'p-nok':'p-sucatado'}">${i.r==='NA'?'N/A':esc(i.r)}</span></td></tr>`).join('')}</tbody></table></div>
  ${d.obs?`<p>${esc(d.obs)}</p>`:''}<div class="row"><button class="btn" id="xdPdf">Imprimir / PDF</button></div>`);$('#xdPdf').onclick=()=>inspPdf(d,true)});
$('#xXls').onclick=()=>{const a=filteredExits();exportXlsx('Saidas_maquina_'+today()+'.xlsx',[['Saídas de máquina',[['Data','Cortante','Máquina','Operador','Folhas','Vida acumulada','Resultado','Pontos NOK','Comentários','Observações','Reparação'],...a.map(i=>[fmtD(i.data),i.cod,i.maq||'',i.op||'',i.folhas||0,i.total||0,i.res,(i.itens||[]).filter(x=>x.r==='NOK').map(x=>x.g+': '+x.t).join('; '),(i.itens||[]).filter(x=>x.c).map(x=>x.c).join('; '),i.obs||'',i.repar?'Sim':''])]]])};
function renderExitKpi(){
  const per=+$('#xkPer').value;const from=per?Date.now()-per*864e5:0;const a=S.exits.filter(i=>!from||new Date(i.data||i.ts)>=from);const lim=vidaMax();
  const nok=a.filter(i=>i.res==='NOK').length,fol=a.reduce((s,i)=>s+(+i.folhas||0),0);
  const over=[...S.tools.values()].filter(t=>t.est!=='sucatado'&&(+t.folhas||0)>=vidaMax(t)).length;
  $('#xkTiles').innerHTML=[[a.length,'Registos de saída'],[a.length?Math.round((a.length-nok)/a.length*100)+'%':'—','Cortantes OK'],[nok,'NOK à saída'],[fmtN(fol),'Folhas cortadas'],[over,'Acima de '+fmtN(lim)]].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
  const tc={};a.forEach(i=>{tc[i.cod]=(tc[i.cod]||0)+(+i.folhas||0)});
  bars($('#xkTools'),Object.entries(tc).sort((x,y)=>y[1]-x[1]).slice(0,10).map(([l,v])=>({l,v,t:fmtN(v)})),true);
  const mq={};a.forEach(i=>{const k=i.maq||'Sem máquina';mq[k]=(mq[k]||0)+(+i.folhas||0)});
  bars($('#xkMaq'),Object.entries(mq).sort((x,y)=>y[1]-x[1]).slice(0,10).map(([l,v])=>({l,v,t:fmtN(v)})),true);
  const it={};a.forEach(i=>(i.itens||[]).forEach(x=>{if(x.r==='NOK'){const k=x.g+' · '+x.t;it[k]=(it[k]||0)+1}}));
  bars($('#xkItems'),Object.entries(it).sort((x,y)=>y[1]-x[1]).slice(0,10).map(([l,v])=>({l,v,t:v+'×'})));
  const vt=[...S.tools.values()].filter(t=>t.est!=='sucatado'&&+t.folhas>0).sort((x,y)=>y.folhas-x.folhas).slice(0,10);
  $('#xkVida').innerHTML=vt.length?vt.map(t=>{const L=vidaMax(t),p=Math.min(100,t.folhas/L*100);return `<div class="bar"><span>${esc(t.cod)}</span><span class="tr"><span class="fl ${t.folhas>=L?'':'g'}" style="width:${Math.max(2,p)}%;display:block;${t.folhas<L&&t.folhas>=L*0.9?'background:var(--warn)':''}"></span></span><span class="v">${Math.round(t.folhas/1000)} mil</span></div>`}).join(''):'<p class="small muted" style="margin:0">Sem folhas registadas.</p>';
}
$('#xkPer').addEventListener('input',renderExitKpi);

/* ============ cópia de segurança e base inicial ============ */
const BK_COLS=['orders','inspections','ncs','receptions','exits'];
$('#bkExp').onclick=async()=>{
  const shards={};for(const[id,t]of S.tools){const sh=S.shardOf.get(id)||'s00';(shards[sh]=shards[sh]||{})[id]=t}
  const out={app:'PCV Ferramentas',versao:1,data:nowIso(),docs:{}};
  for(const[sh,items]of Object.entries(shards))out.docs['tools/'+sh]={items};
  out.docs['config/positions']={items:S.positions};if(S.cl)out.docs['config/checklist']=S.cl;if(S.links)out.docs['config/links']=S.links;if(S.pdfidx)out.docs['config/pdfidx']=S.pdfidx;
  const map={orders:S.orders,inspections:S.insp,ncs:S.ncs,receptions:S.recs,exits:S.exits};
  for(const c of BK_COLS)for(const d of map[c]||[]){const {_id,...rest}=d;out.docs[c+'/'+_id]=rest}
  await saveFile('PCV_copia_'+today()+'.json',new Blob([JSON.stringify(out)],{type:'application/json'}));
};
$('#bkImp').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const j=JSON.parse(await f.text());const docs=j.docs||{};const n=Object.keys(docs).length;if(!n)throw new Error('ficheiro sem dados');
    $('#bkPrev').innerHTML=`<div class="confirm"><span class="grow">Repor <b>${n}</b> registos da cópia de ${esc(fmtDT(j.data))}? Os registos com o mesmo identificador são substituídos.</span><button class="btn danger" id="bkGo">Repor cópia</button></div>`;
    $('#bkGo').onclick=async()=>{if(!needDb())return;$('#bkGo').disabled=true;let k=0;
      for(const[p,d]of Object.entries(docs)){const [c,id]=p.split('/');try{await S.db.collection(c).doc(id).set(d);k++;if(k%20===0)$('#bkPrev').innerHTML=`<div class="panel progress"><span class="spin"></span> A repor… ${k}/${n}</div>`}catch(err){toast(dbErr(err),1);break}}
      $('#bkPrev').innerHTML='';toast(k+' registos repostos.')};
  }catch(err){toast('Ficheiro inválido: '+err.message,1)}};
async function loadSeed(){
  const seed=window.PCV_SEED;if(!seed||!needDb())return;
  for(const[p,d]of Object.entries(seed)){const [c,id]=p.split('/');await S.db.collection(c).doc(id).set(d)}
  toast('Base inicial carregada.');
}
document.addEventListener('click',e=>{const b=e.target.closest('#seedGo');if(b){b.disabled=true;loadSeed().catch(err=>{b.disabled=false;toast(dbErr(err),1)})}});

/* ============ notificações por email (EmailJS) ============
   Funciona na versão GitHub/ficheiro (o claude.ai bloqueia ligações a serviços externos).
   Configuração em config.js → emailjs: {publicKey, serviceId, templateId}.
   O modelo no EmailJS deve usar: Para = {{to_email}}, Assunto = {{subject}}, Corpo = {{message}}. */
const EJ=()=>{const c=(window.PCV_CONFIG||{}).emailjs||{};return c.publicKey&&c.serviceId&&c.templateId?c:null};
const mailTo=tp=>{const k={nc:'ncTo',vida:'vidaTo',saida:'saidaTo'}[tp];const v=S.cl&&S.cl[k];return v&&v.length?v:ncTo()};
const autoMail=()=>S.cl?.autoMail!==false;
/* v54: envio por 3 vias, por esta ordem —
   1) Outlook da empresa (Microsoft Graph, sem limite mensal): quem tem sessão Microsoft na app envia
      a partir da caixa partilhada (config.js › microsoft.mailFrom) ou, se não puder, da sua própria caixa;
   2) EmailJS (plano gratuito: 200/mês);
   3) fila na base (config/mailq): o primeiro posto com sessão Microsoft envia-a mais tarde. */
const msOn=()=>typeof msCfg==='function'&&!!msCfg();
const mailOn=()=>!!(EJ()||msOn());
const mailFrom=()=>(msOn()&&msCfg().mailFrom)||'';
const splitMails=s=>(Array.isArray(s)?s:String(s||'').split(/[,;]\s*/)).map(x=>String(x).trim()).filter(Boolean);
async function graphSend(to,subject,message,opts){
  if(!msOn())throw new Error('Microsoft 365 não configurado');
  const rcp=a=>splitMails(a).map(address=>({emailAddress:{address}}));
  const message_={subject,body:{contentType:'Text',content:message},toRecipients:rcp(to)};
  if(opts&&opts.cc)message_.ccRecipients=rcp(opts.cc);
  const post=async(url,tok)=>{const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify({message:message_,saveToSentItems:true})});if(!r.ok)throw new Error('Outlook '+r.status+': '+(await r.text()).slice(0,140));};
  const from=mailFrom();
  if(from){try{await post('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(from)+'/sendMail',await msToken(false,['Mail.Send.Shared']));return 'outlook'}catch(e){/* sem permissão na caixa partilhada: usa a própria */}}
  await post('https://graph.microsoft.com/v1.0/me/sendMail',await msToken(false,['Mail.Send']));return 'outlook';
}
async function emailjsSend(to,subject,message,opts){
  const c=EJ();if(!c)throw new Error('EmailJS não configurado');
  const res=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({service_id:c.serviceId,template_id:c.templateId,user_id:c.publicKey,template_params:{to_email:splitMails(to).join(','),subject,message,reply_to:splitMails(to)[0]||'',cc:(opts&&opts.cc)||''}})});
  if(!res.ok)throw new Error('EmailJS '+res.status+': '+(await res.text()).slice(0,120));
  return 'emailjs';
}
/* devolve 'outlook' | 'emailjs' | 'fila'; lança erro só se não conseguir nem pôr em fila (ou com opts.noQueue) */
async function sendMail(to,subject,message,opts){
  opts=opts||{};const errs=[];
  if(msOn())try{return await graphSend(to,subject,message,opts)}catch(e){errs.push(e.message)}
  if(EJ()&&!opts.noEmailjs)try{return await emailjsSend(to,subject,message,opts)}catch(e){errs.push(e.message)}
  if(opts.noQueue||!S.db)throw new Error(errs.join(' · ')||'envio de email não configurado');
  const id='M'+uid();const item={to:splitMails(to),subject,message,cc:opts.cc||'',ts:nowIso(),by:(typeof getName==='function'&&getName())||S.me||'',err:errs.join(' · ').slice(0,200)};
  try{await S.db.doc('config/mailq').update({items:{[id]:item}})}
  catch{await S.db.doc('config/mailq').set({items:{...mailQItems(),[id]:item}})}
  toast('Email em fila: segue assim que um posto PCV/SUPV com sessão Microsoft abrir a app.');
  setTimeout(()=>flushMailQ(false),2000);
  return 'fila';
}
const mailQItems=()=>{const o={};for(const[k,v]of Object.entries(S.mailq?.items||{}))if(v)o[k]=v;return o};
let mailQBusy=false;
async function flushMailQ(manual){
  if(mailQBusy||!S.db||!msOn())return 0;const items=Object.entries(mailQItems());if(!items.length)return 0;
  try{await msToken(manual,['Mail.Send'])}catch(e){if(manual)toast('Inicia sessão Microsoft para enviar a fila: '+e.message,1);return 0}
  mailQBusy=true;let n=0;
  try{for(const[id,m]of items){
      if(m.lock&&Date.now()-Date.parse(m.lock)<5*60e3)continue;   // outro posto está a enviar
      await S.db.doc('config/mailq').update({items:{[id]:{...m,lock:nowIso()}}});
      try{await graphSend(m.to,m.subject,m.message+(m.ts?`\n\n(mensagem gerada na app em ${fmtDT(m.ts)}${m.by?' por '+m.by:''})`:''),{cc:m.cc});
        await S.db.doc('config/mailq').update({items:{[id]:null}});n++}
      catch(e){await S.db.doc('config/mailq').update({items:{[id]:{...m,lock:'',err:e.message.slice(0,200)}}})}}
  }finally{mailQBusy=false}
  if(n&&manual)toast(n+' email(s) da fila enviados.');if(typeof renderMail==='function')renderMail();
  return n;
}
setInterval(()=>{try{if(S.db&&roleAtLeast('PCV'))flushMailQ(false)}catch{}},5*60e3);
async function notifyNc(n,force){
  if(!mailOn()||(!autoMail()&&!force))return false;const m=ncText(n);
  try{const via=await sendMail(m.to,m.subj,m.body);if(via!=='fila')toast('Email enviado a '+m.to.join(', '));
    try{await S.db.doc('ncs/'+n._id).update({emailAuto:nowIso()})}catch{}return true
  }catch(e){toast('Não foi possível enviar o email automático: '+e.message+'. Usa “Copiar email”.',1);return false}
}
async function notifyAlert(topic,subject,message){
  if(!mailOn()||!autoMail())return;
  try{await sendMail(mailTo(topic),'[PCV] '+subject,message+'\n\nMensagem automática da app PCV Ferramentas.')}catch(e){toast('Alerta por email não enviado: '+e.message,1)}
}

/* Operador: consulta de parâmetros ideais por máquina (v34) */
function renderOpParam(){
  const sel=$('#opParMaq');if(!sel)return;
  const ms=machines();const cur=sel.value;
  sel.innerHTML='<option value="">Escolher máquina…</option>'+ms.map(m=>`<option${m===cur?' selected':''}>${esc(m)}</option>`).join('');
  if(!sel.dataset.b){sel.dataset.b='1';sel.addEventListener('change',renderOpParam)}
  const mq=sel.value,box=$('#opParList');if(!box)return;
  if(!mq){box.innerHTML='<p class="fempty">Escolhe uma máquina para ver os parâmetros.</p>';return}
  const list=[...S.tools.values()].filter(t=>t.est!=='sucatado'&&(t.param||{})[mq]&&((t.param[mq].p||'')||(t.param[mq].v||'')||(t.param[mq].n||'')))
    .sort((a,b)=>String(a.cod).localeCompare(String(b.cod)));
  box.innerHTML=list.length?`<div class="tw"><table class="t"><thead><tr><th>Cortante</th><th>Cliente</th><th>Pressão</th><th>Velocidade</th><th>Nota</th></tr></thead><tbody>${list.map(t=>{const p=t.param[mq];return `<tr><td class="code">${esc(t.cod)}</td><td>${esc((t.cli||'').slice(0,28))}</td><td class="mono">${esc(p.p||'—')}</td><td class="mono">${esc(p.v||'—')}</td><td>${esc(p.n||'')}</td></tr>`}).join('')}</tbody></table></div><p class="small muted" style="margin-top:6px">${list.length} cortante(s) com parâmetros guardados para ${esc(mq)}.</p>`:`<p class="fempty">Ainda não há parâmetros guardados para a máquina ${esc(mq)}.</p>`;
}
