"use strict";
/* ============ Portal FAMAG (v39): fabrico, reparações, TOP20 ============
   Dados do pipeline em config/fampipe (carregado de Excel pelo SUPV). A FAMAG edita datas e observações.
   Reparações = cortantes com est==='reparacao' na app. TOP20 = lista em config/fampipe.top20. */
const FMG_ESTADOS=['','EM CURSO','SUSPENSO','OK','ENTREGUE'];
function fampipe(){return S.fampipe||{pipe:[],prog:{},top20:[]}}
const isFamag=()=>ROLE==='FAMAG';

function renderFamag(){
  if($('#navFamag'))$('#navFamag').style.display=(isFamag()||roleAtLeast('PCV'))?'':'none';
  if(typeof renderFamAlertsBanner==='function')renderFamAlertsBanner();
  if(UI.fmg==='novos')renderFamNovos();
  else if(UI.fmg==='reparacoes')renderFamReps();
  else if(UI.fmg==='top20')renderFamTop();
}

function famRow(p){
  const dias=p.dataAtual?Math.round((Date.parse(p.dataAtual)-Date.now())/864e5):null;
  const atraso=dias!=null&&dias<0&&(p.estado||'')!=='OK'&&(p.estado||'')!=='ENTREGUE';
  const pr=(fampipe().prog[p.np]||{});
  const canPrio=isFamag()||roleAtLeast('SUPV'); // FAMAG e Supervisão marcam prioridades; PCV só vê
  const prioCell=pr.prio
    ? `<span class="prio-badge${canPrio?' click':''}" ${canPrio?`data-prio="${esc(p.np)}" title="Clicar para tirar a prioridade"`:''}>P${esc(pr.prio)}</span>`
    : (canPrio?`<button class="btn sm prio-add" data-prio="${esc(p.np)}" title="Dar prioridade">+ prioridade</button>`:'<span class="muted">—</span>');
  return `<tr data-fnp="${esc(p.np)}"><td class="mono fmg-exp" data-fexp="${esc(p.np)}" title="Ver peças em fabrico" style="cursor:pointer;color:var(--ok)">▸</td>
    <td>${prioCell}</td>
    <td class="mono">${esc(p.np)}</td>
    <td class="code">${esc(p.ref)}</td>
    <td>${esc(p.nome)}</td>
    <td class="mono small">${esc(p.inicio||'—')}</td>
    <td>${isFamag()?`<input type="date" class="fmg-in" data-ff="dataAtual" value="${esc(p.dataAtual||'')}">`:`<span class="mono ${atraso?'late':''}">${esc(p.dataAtual||'—')}</span>`}</td>
    <td><span class="pill ${({'OK':'p-ok','SUSPENSO':'p-rep','ENTREGUE':'p-arm'})[p.estado]||'p-enc'}">${esc(p.estado||'em curso')}</span></td>
    <td>${isFamag()?`<input type="text" class="fmg-in" data-ff="obs" value="${esc(p.obs||'')}" placeholder="Observação…"><button class="btn sm faflag-btn" style="margin-top:4px" data-faflag="${esc(p.np)}" data-fakind="fabrico" data-falabel="Em fabrico ${esc(p.ref)} (nº ${esc(p.np)})">⚠ Referência errada?</button>`:esc(p.obs||'')}</td>
  </tr>`;
}
function renderFamNovos(){
  const el=$('#fmgNovos');if(!el)return;
  if($('#fmgUploadBox'))$('#fmgUploadBox').hidden=!isFamag();
  const q=norm($('#fmgQ')?.value||''),fe=$('#fmgFEst')?.value||'',fatr=$('#fmgFAtraso')?.checked,ftop=$('#fmgFTop')?.checked;
  const top=new Set((fampipe().top20||[]).map(c=>norm((String(c).match(/[STM]\d{4}[A-Z]/)||[c])[0])));
  const prog=fampipe().prog;
  let list=fampipe().pipe.slice();
  // linhas com Data Fim Produção = entregues: marcar estado e esconder por omissão
  list.forEach(p=>{if(p.fim&&!['ENTREGUE'].includes(p.estado))p._entregue=true});
  if(!$('#fmgFEst')?.value&&!$('#fmgFEntregues')?.checked)list=list.filter(p=>!p.fim);
  if(q)list=list.filter(p=>norm([p.np,p.ref,p.nome,p.artigos].join(' ')).includes(q));
  if(fe)list=list.filter(p=>(p.estado||'em curso').toUpperCase()===fe.toUpperCase()||(fe==='em curso'&&!p.estado));
  if(fatr)list=list.filter(p=>p.dataAtual&&Date.parse(p.dataAtual)<Date.now()&&(p.estado||'')!=='OK'&&(p.estado||'')!=='ENTREGUE');
  if(ftop)list=list.filter(p=>top.has(norm((p.ref.match(/[STM]\d{4}[A-Z]/)||[p.ref])[0])));
  list.sort((a,b)=>{const pa=+((prog[a.np]||{}).prio||9999),pb=+((prog[b.np]||{}).prio||9999);if(pa!==pb)return pa-pb;return (a.dataAtual||'9999').localeCompare(b.dataAtual||'9999')});
  if($('#fmgNovosN'))$('#fmgNovosN').textContent=`${list.length} cortante(s)`;
  el.innerHTML=list.length?`<div class="tw"><table class="t"><thead><tr><th></th><th>Prio.</th><th>Nº Prod.</th><th>Código</th><th>Nome comercial</th><th>Início</th><th>Data prevista</th><th>Estado</th><th>Observações</th></tr></thead><tbody>${list.map(famRow).join('')}</tbody></table></div>`:'<p class="fempty">Sem resultados.</p>';
}
// guardar edições da FAMAG (data/obs)
let fmgT=null;
document.addEventListener('input',e=>{const i=e.target.closest('.fmg-in');if(!i||!isFamag())return;
  const np=i.closest('[data-fnp]').dataset.fnp,f=i.dataset.ff,v=i.value;
  const p=fampipe().pipe.find(x=>x.np===np);if(p){p[f]=v;clearTimeout(fmgT);fmgT=setTimeout(saveFampipe,900)}});
async function saveFampipe(){if(!needDb())return;try{await S.db.doc('config/fampipe').set(fampipe());toast('Guardado.')}catch(e){toast(dbErr(e),1)}}

function renderFamReps(){
  const el=$('#fmgReps');if(!el)return;
  const reps=[...S.tools.values()].filter(t=>t.est==='reparacao'&&(t.repEnt||'FAMAG')==='FAMAG');
  el.innerHTML=reps.length?`<div class="tw"><table class="t"><thead><tr><th>Cortante</th><th>Cliente</th><th>Enviado</th><th>Vida (batidas)</th><th>Motivo</th><th></th></tr></thead><tbody>${reps.map(t=>{
    const bat=t.folhas||0,done=t.repFeito;
    return `<tr data-frep="${esc(t.id)}"><td class="code">${esc(t.cod)}</td><td>${esc((t.cli||'').slice(0,26))}</td><td class="mono small">${t.repDesde?fmtD(t.repDesde):'—'}</td><td class="mono">${bat.toLocaleString('pt-PT')}</td><td>${esc(t.repMot||'—')}</td>
    <td>${done?`<span class="pill p-ok" title="${esc(t.repObs||'')}">Reparado ✓</span>`:(isFamag()?`<button class="btn sm pri" data-frepok="${esc(t.id)}">Marcar reparado</button> <button class="btn sm faflag-btn" data-faflag="${esc(t.id)}" data-fakind="reparacao" data-falabel="Reparação ${esc(t.cod)}">⚠ Problema</button>`:'<span class="small muted">a reparar</span>')}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="fempty">Nenhum cortante em reparação.</p>';
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-frepok]');if(!b||!isFamag())return;
  const t=S.tools.get(b.dataset.frepok);if(!t)return;
  const obs=prompt('O que foi reparado? (breve descrição)','');if(obs===null)return;
  if(!needDb())return;
  const n={...t,repFeito:true,repObs:obs,repFeitoTs:nowIso()};addHist(n,'FAMAG marcou reparado: '+(obs||'—'));
  b.disabled=true;if(await saveTools([n])){toast('Marcado como reparado. A Hinojosa vai confirmar a receção.');renderFamReps()}});

function renderFamTop(){
  const el=$('#fmgTop');if(!el)return;
  const codes=fampipe().top20||[];
  const byref=new Map();for(const t of S.tools.values())for(const k of toolKeys(t))byref.set(k,t);
  el.innerHTML=codes.length?`<div class="tw"><table class="t"><thead><tr><th>Código</th><th>Estado na app</th><th>Vida (batidas)</th></tr></thead><tbody>${codes.map(c=>{
    const key=(c.match(/[STM]\d{4}[A-Z]/)||[c])[0];const t=byref.get(key);
    return `<tr><td class="code">${esc(c)}</td><td>${t?esc(({armazem:'em armazém',maquina:'na máquina '+(t.maq||''),reparacao:'em reparação',arrumar:'no pré-corte'})[t.est]||t.est):'<span class="muted">—</span>'}</td><td class="mono">${t?(t.folhas||0).toLocaleString('pt-PT'):'—'}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="fempty">Sem cortantes TOP 20 definidos.</p>';
}
// pesquisa reage
['fmgQ','fmgFEst','fmgFAtraso','fmgFTop','fmgFEntregues'].forEach(id=>{document.addEventListener('input',e=>{if(e.target.id===id)renderFamNovos()});document.addEventListener('change',e=>{if(e.target.id===id)renderFamNovos()})});
// detalhe de peças ao clicar
document.addEventListener('click',e=>{const b=e.target.closest('[data-fexp]');if(!b)return;
  const np=b.dataset.fexp,tr=b.closest('tr');
  const next=tr.nextElementSibling;
  if(next&&next.classList.contains('fmg-detail')){next.remove();b.textContent='▸';return}
  b.textContent='▾';
  const arts=(fampipe().artigos||{})[np]||[];
  const p=fampipe().pipe.find(x=>x.np===np)||{};
  const pecasTxt=p.artigos||arts.join(' · ')||'—';
  const row=document.createElement('tr');row.className='fmg-detail';
  row.innerHTML=`<td></td><td colspan="6"><div class="fmg-detail-box"><b>Ferramentas em fabrico para ${esc(p.ref||np)}:</b> ${esc(pecasTxt)}${arts.length?'<div class="small muted" style="margin-top:4px">Notas: '+arts.map(esc).join(' · ')+'</div>':''}</div></td>`;
  tr.after(row);
});
// upload do Excel do ERP (FAMAG)
document.addEventListener('change',async e=>{if(e.target.id!=='fmgXls'||!isFamag())return;
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const st=$('#fmgXlsStat');st.textContent='A ler o Excel…';
  try{if(!window.XLSX){st.textContent="Biblioteca XLSX não carregou.";return}const data=new Uint8Array(await f.arrayBuffer());const wb=XLSX.read(data,{type:'array',cellDates:true});
    const ws=wb.Sheets[wb.SheetNames.find(n=>/pipeline/i.test(n))||wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    /* data local (sem passar por UTC, que no verão recuava um dia); aceita Date, nº de série do Excel ou texto dd/mm/aaaa */
    const p2=n=>String(n).padStart(2,'0');
    const iso=v=>{if(v===''||v==null)return'';if(v instanceof Date)return isNaN(v)?'':`${v.getFullYear()}-${p2(v.getMonth()+1)}-${p2(v.getDate())}`;
      if(typeof v==='number'){const d=new Date(Math.round((v-25569)*864e5));return `${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())}`}
      const s=String(v).trim(),m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s);if(m)return `${m[3]}-${p2(m[2])}-${p2(m[1])}`;
      const d=new Date(s);return isNaN(d)?s.slice(0,10):iso(d)};
    const pick=(r,...ks)=>{for(const k of ks){const kk=Object.keys(r).find(x=>norm(x)===norm(k));if(kk&&r[kk]!=='')return r[kk]}return''};
    const est=v=>String(v||'').trim().toUpperCase();
    /* folha "Revisão de datas e observações" (onde a FAMAG retifica datas, observações e estado): lida diretamente,
       para não depender das fórmulas da folha Pipeline estarem recalculadas */
    const rev=new Map();const wsR=wb.Sheets[wb.SheetNames.find(n=>/revis/i.test(n))];
    if(wsR)for(const r of XLSX.utils.sheet_to_json(wsR,{defval:''})){const np=String(pick(r,'Nº Produção','No Produção','Nº Producao')||'').trim();if(!np)continue;
      const ds=[pick(r,'3ª revisão'),pick(r,'2ª revisão'),pick(r,'1ª revisão'),pick(r,'Data original')].map(iso).filter(Boolean);
      rev.set(np,{data:ds[0]||'',estado:est(pick(r,'Estado')),obs:String(pick(r,'Observações')||'').trim()})}
    const cur=fampipe();const byNp=new Map(cur.pipe.map(p=>[String(p.np),p]));
    let upd=0,add=0,nDatas=0,nEst=0;
    for(const r of rows){const np=String(pick(r,'Nº Produção','No Produção','Nº Producao')||'').trim();if(!np)continue;
      const rv=rev.get(np)||{};
      /* data prevista = "Data Atual" do Excel (já com as revisões); senão a última revisão; senão a data original */
      const revs=[pick(r,'3ª revisão'),pick(r,'2ª revisão'),pick(r,'1ª revisão')].map(iso).filter(Boolean);
      const dataOrig=iso(pick(r,'Data original'));
      const dataAtual=rv.data&&rv.data!==dataOrig?rv.data:(iso(pick(r,'Data Atual','Data Prevista','Data Termo'))||revs[0]||dataOrig);
      const base={np,ref:String(pick(r,'REF GLP')||'').trim(),nome:String(pick(r,'Nome Comercial')||'').trim(),
        artigos:String(pick(r,'Artigos na OF')||'').trim(),dataOrig,
        inicio:iso(pick(r,'Data Inicio')),fim:iso(pick(r,'Data Fim Produção')),
        estado:rv.estado||est(pick(r,'Estado'))};
      const obsX=rv.obs||String(pick(r,'Observações')||'').trim();
      const ex=byNp.get(np);
      if(ex){
        if(dataAtual&&ex.dataAtual!==dataAtual){ex.dataAtual=dataAtual;nDatas++}   // o Excel da FAMAG manda na data prevista
        if((ex.estado||'')!==base.estado)nEst++;
        if(obsX)ex.obs=obsX;                                                      // observação do Excel substitui; vazia mantém a da página
        Object.assign(ex,base);upd++}
      else{cur.pipe.push({...base,dataAtual,obs:obsX});add++}
    }
    S.fampipe=cur;await saveFampipe();st.textContent=`Atualizado: ${upd} linha(s) (${nDatas} data(s) e ${nEst} estado(s) alterados), ${add} nova(s).`;renderFamNovos();
  }catch(err){st.textContent='Erro a ler o Excel: '+err.message}
});

// prioridades: a GLP (Hinojosa) clica para dar/tirar
document.addEventListener('click',async e=>{const b=e.target.closest('[data-prio]');if(!b)return;
  if(!isFamag()&&!roleAtLeast('SUPV'))return;
  if(!needDb())return;
  const np=b.dataset.prio,cur=fampipe();cur.prog=cur.prog||{};
  const has=cur.prog[np]&&cur.prog[np].prio;
  if(has){const old=+cur.prog[np].prio;delete cur.prog[np].prio;if(!Object.keys(cur.prog[np]).length)delete cur.prog[np];
    // reordenar as que vinham depois
    for(const k in cur.prog){if(cur.prog[k].prio&&+cur.prog[k].prio>old)cur.prog[k].prio=+cur.prog[k].prio-1}}
  else{const max=Math.max(0,...Object.values(cur.prog).map(x=>+x.prio||0));cur.prog[np]=cur.prog[np]||{};cur.prog[np].prio=max+1}
  S.fampipe=cur;renderFamNovos();
  try{await S.db.doc('config/fampipe').set(cur)}catch(err){toast(dbErr(err),1)}
});
/* ============ FAMAG assinala problema → alerta na app da GLP (v47) ============ */
function famAlert(kind,id,label){
  const ov=document.createElement('div');ov.className='ckmodal';ov.style.zIndex='95';
  ov.innerHTML=`<div class="ckbox" style="max-width:480px"><div class="ckhead"><div class="grow"><h3>Assinalar problema</h3><p class="small muted">${esc(label)}</p></div><button class="btn sm" id="faX">Fechar</button></div>
    <label class="f"><span>O que está errado? (ex.: referência trocada, cortante não é este…)</span><textarea id="faMsg" rows="3" placeholder="Descreve o problema para a GLP corrigir"></textarea></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" id="faOk">Enviar à GLP</button><button class="btn" id="faNo">Cancelar</button></div></div>`;
  document.body.append(ov);const close=()=>ov.remove();
  ov.querySelector('#faX').onclick=ov.querySelector('#faNo').onclick=close;
  ov.addEventListener('click',e=>{if(e.target===ov)close()});
  ov.querySelector('#faMsg').focus();
  ov.querySelector('#faOk').onclick=async()=>{
    const msg=ov.querySelector('#faMsg').value.trim();if(!msg){ov.querySelector('#faMsg').focus();return}
    if(!needDb()){close();return}
    const rec={id:'FA'+uid(),ts:nowIso(),by:getName()||'FAMAG',kind,ref:id,label,msg,estado:'aberto'};
    const list=[...(S.famAlerts||[]),rec];
    try{await S.db.doc('config/famalerts').set({items:list});S.famAlerts=list}catch(e){toast(dbErr(e),1);return}
    if(mailOn())try{await sendMail(['joao.campos@graphicsleader.pt','precortevinco@graphicsleader.pt'],`[FAMAG] Problema assinalado: ${label}`,`A FAMAG assinalou um problema:\n\n${label}\n\n"${msg}"\n\nVer na app (alerta pendente).`)}catch{}
    toast('Problema enviado à GLP. Obrigado pelo aviso.');close();if(typeof renderFamag==='function')renderFamag();
  };
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-faflag]');if(!b)return;
  famAlert(b.dataset.fakind,b.dataset.faflag,b.dataset.falabel||b.dataset.faflag)});

/* alerta na app da GLP (PCV+): banner com os problemas abertos */
function renderFamAlertsBanner(){
  const host=$('#famAlertHost');if(!host)return;
  if(isFamag()){host.innerHTML='';return}
  const open=(S.famAlerts||[]).filter(a=>a.estado==='aberto');
  if(!open.length){host.innerHTML='';return}
  host.innerHTML=`<div class="panel" style="border-color:var(--nok);background:#fdf0ee">
    <b>⚠ ${open.length} problema(s) assinalado(s) pela FAMAG</b>
    ${open.map(a=>`<div class="row" style="margin-top:6px;gap:8px;flex-wrap:wrap"><span class="grow"><b>${esc(a.label)}</b> — "${esc(a.msg)}" <span class="small muted">· ${fmtDT(a.ts)}</span></span><button class="btn sm" data-faresolve="${esc(a.id)}">Resolvido</button></div>`).join('')}</div>`;
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-faresolve]');if(!b)return;
  if(isFamag()||!needDb())return;
  const list=(S.famAlerts||[]).map(a=>a.id===b.dataset.faresolve?{...a,estado:'resolvido',resTs:nowIso()}:a);
  try{await S.db.doc('config/famalerts').set({items:list});S.famAlerts=list;renderFamAlertsBanner()}catch(err){toast(dbErr(err),1)}
});
