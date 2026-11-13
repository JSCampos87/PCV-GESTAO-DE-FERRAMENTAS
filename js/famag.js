"use strict";
/* ============ Portal FAMAG (v39): fabrico, reparações, TOP20 ============
   Dados do pipeline em config/fampipe (carregado de Excel pelo SUPV). A FAMAG edita datas e observações.
   Reparações = cortantes com est==='reparacao' na app. TOP20 = lista em config/fampipe.top20. */
const FMG_ESTADOS=['','EM CURSO','SUSPENSO','OK','ENTREGUE'];
function fampipe(){return S.fampipe||{pipe:[],prog:{},top20:[]}}
const isFamag=()=>ROLE==='FAMAG';

function renderFamag(){
  if($('#navFamag'))$('#navFamag').style.display=(isFamag()||roleAtLeast('PCV'))?'':'none';
  if(UI.fmg==='novos')renderFamNovos();
  else if(UI.fmg==='reparacoes')renderFamReps();
  else if(UI.fmg==='top20')renderFamTop();
}

function famRow(p){
  const dias=p.dataAtual?Math.round((Date.parse(p.dataAtual)-Date.now())/864e5):null;
  const atraso=dias!=null&&dias<0;
  const pr=(fampipe().prog[p.np]||{});
  return `<tr data-fnp="${esc(p.np)}"><td class="mono fmg-exp" data-fexp="${esc(p.np)}" title="Ver peças em fabrico" style="cursor:pointer;color:var(--ok)">▸</td>
    <td class="mono">${esc(p.np)}${pr.prio?`<span class="pill p-maquina" title="Prioridade">P${esc(pr.prio)}</span>`:''}</td>
    <td class="code">${esc(p.ref)}</td>
    <td>${esc(p.nome)}</td>
    <td class="mono small">${esc(p.dataOrig||'—')}</td>
    <td>${isFamag()?`<input type="date" class="fmg-in" data-ff="dataAtual" value="${esc(p.dataAtual||'')}">`:`<span class="mono ${atraso?'late':''}">${esc(p.dataAtual||'—')}</span>`}</td>
    <td><span class="pill ${({'OK':'p-ok','SUSPENSO':'p-rep','ENTREGUE':'p-arm'})[p.estado]||'p-enc'}">${esc(p.estado||'em curso')}</span></td>
    <td>${isFamag()?`<input type="text" class="fmg-in" data-ff="obs" value="${esc(p.obs||'')}" placeholder="Observação…">`:esc(p.obs||'')}</td>
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
  list.sort((a,b)=>{const pa=+((prog[a.np]||{}).prio||999),pb=+((prog[b.np]||{}).prio||999);return pa-pb||String(a.dataAtual).localeCompare(String(b.dataAtual))});
  if($('#fmgNovosN'))$('#fmgNovosN').textContent=`${list.length} cortante(s)`;
  el.innerHTML=list.length?`<div class="tw"><table class="t"><thead><tr><th></th><th>Nº Prod.</th><th>Código</th><th>Nome comercial</th><th>Data original</th><th>Data prevista</th><th>Estado</th><th>Observações</th></tr></thead><tbody>${list.map(famRow).join('')}</tbody></table></div>`:'<p class="fempty">Sem resultados.</p>';
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
    <td>${done?`<span class="pill p-ok" title="${esc(t.repObs||'')}">Reparado ✓</span>`:(isFamag()?`<button class="btn sm pri" data-frepok="${esc(t.id)}">Marcar reparado</button>`:'<span class="small muted">a reparar</span>')}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="fempty">Nenhum cortante em reparação.</p>';
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
    const iso=v=>{if(!v)return'';const d=v instanceof Date?v:new Date(v);return isNaN(d)?String(v).slice(0,10):d.toISOString().slice(0,10)};
    const pick=(r,...ks)=>{for(const k of ks){const kk=Object.keys(r).find(x=>norm(x)===norm(k));if(kk&&r[kk]!=='')return r[kk]}return''};
    const cur=fampipe();const byNp=new Map(cur.pipe.map(p=>[String(p.np),p]));
    let upd=0,add=0;
    for(const r of rows){const np=String(pick(r,'Nº Produção','No Produção','Nº Producao')||'').trim();if(!np)continue;
      const base={np,ref:String(pick(r,'REF GLP')||'').trim(),nome:String(pick(r,'Nome Comercial')||'').trim(),
        artigos:String(pick(r,'Artigos na OF')||'').trim(),dataOrig:iso(pick(r,'Data original')),
        inicio:iso(pick(r,'Data Inicio')),fim:iso(pick(r,'Data Fim Produção')),
        estado:String(pick(r,'Estado')||'').trim()};
      const ex=byNp.get(np);
      if(ex){Object.assign(ex,base);upd++}  // mantém dataAtual/obs editados pela FAMAG
      else{cur.pipe.push({...base,dataAtual:base.dataOrig,obs:''});add++}
    }
    S.fampipe=cur;await saveFampipe();st.textContent=`Atualizado: ${upd} linha(s) atualizadas, ${add} nova(s).`;renderFamNovos();
  }catch(err){st.textContent='Erro a ler o Excel: '+err.message}
});
