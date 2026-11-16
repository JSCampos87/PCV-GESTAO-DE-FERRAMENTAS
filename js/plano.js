"use strict";
/* ============ Plano de produção (v44) — lê os PDFs do SAP e mostra a sequência por máquina ============
   O SUPV carrega os planos; a app extrai (máquina, sequência de cortantes com nº exemplares),
   agrupa consecutivos iguais e mostra o local atual de cada cortante, com cor por estado. */
function renderPlano(){
  const el=$('#planoBoard');if(!el)return;
  const plan=S.plano||null;
  if(!plan||!plan.maqs||!plan.maqs.length){el.innerHTML='<p class="fempty">Ainda não há planos carregados. '+(roleAtLeast('SUPV')?'Carrega os PDFs dos planos de produção.':'Pede ao responsável para carregar os planos.')+'</p>';return}
  // índice de cortantes por código base
  const byCod=new Map();for(const t of S.tools.values())for(const k of toolKeys(t))if(!byCod.has(k))byCod.set(k,t);
  const estInfo=t=>{if(!t)return{txt:'não encontrado',cls:'pl-unk'};
    return {maquina:{txt:'na máquina '+(t.maq||''),cls:'pl-maq'},armazem:{txt:t.pos||'em armazém',cls:'pl-arm'},arrumar:{txt:'no pré-corte',cls:'pl-pre'},reparacao:{txt:'em reparação',cls:'pl-rep'},sucatado:{txt:'sucatado',cls:'pl-unk'}}[t.est]||{txt:t.est,cls:'pl-arm'}};
  el.innerHTML=`<div class="plano-grid">${plan.maqs.map(m=>`<div class="plano-col"><div class="plano-colhead">${esc(m.maq)}<span class="small muted">${m.seq.length} cortantes</span></div>
    <div class="plano-list">${m.seq.map((s,i)=>{const t=byCod.get(normCod(s.cod));const e=estInfo(t);
      return `<div class="plano-card ${e.cls}"><div class="plano-ord">${i+1}</div><div class="plano-body"><b class="mono">${esc(s.cod)}</b><span class="plano-ex">${s.ex} ex.</span><span class="plano-loc">${esc(e.txt)}</span></div></div>`}).join('')}</div></div>`).join('')}</div>
    <p class="small muted" style="margin-top:8px">${plan.ts?'Planos carregados em '+fmtDT(plan.ts):''}${plan.by?' · '+esc(plan.by):''}</p>`;
}
function normCod(c){const m=String(c||'').toUpperCase().match(/[MST]\d{3,4}[A-Z]/);return m?m[0]:String(c||'').toUpperCase()}

// extrair plano de um PDF
function parsePlano(txt){
  const maq=(txt.match(/M[aá]quina:?\s*([A-Z0-9]+)/)||[])[1]||'';
  // percorrer o texto por blocos de ordem; em cada bloco, apanhar Nº Exemplares e o código do Desenho Técnico
  const seq=[];
  // dividir em segmentos por "Desenho Técnico"
  const re=/N[ºo]\s*Exemplares:?\s*(\d+)[\s\S]*?Desenho\s*T[eé]cnico\s*\d+\s*-\s*([MST]\d{3,4}[A-Z])/g;
  let m;while((m=re.exec(txt))){seq.push({ex:+m[1],cod:m[2]})}
  // agrupar consecutivos iguais (soma exemplares? não — mantém o maior/soma). Pedido: agrupar.
  const grouped=[];
  for(const s of seq){const last=grouped[grouped.length-1];
    if(last&&normCod(last.cod)===normCod(s.cod))last.ex=Math.max(last.ex,s.ex);  // mesmo cortante seguido: 1 entrada
    else grouped.push({...s})}
  return maq?{maq,seq:grouped}:null;
}
async function planoUpload(files){
  const st=$('#planoStat');files=[...files].filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
  if(!files.length){toast('Escolhe ficheiros PDF.',1);return}
  if(st)st.innerHTML='<span class="spin"></span> A abrir os planos…';
  const maqs=[];let n=0,erros=0;
  for(const f of files){n++;st.innerHTML=`<span class="spin"></span> A ler ${n}/${files.length}: ${esc(f.name)}`;
    try{const txt=await pdfText(f);const pl=parsePlano(txt);
      if(pl){const ex=maqs.find(x=>x.maq===pl.maq);if(ex)ex.seq=pl.seq;else maqs.push(pl)}
    }catch(e){erros++}}
  if(!maqs.length){if(st)st.innerHTML='';toast('Não consegui ler nenhum plano. Confirma que são os PDFs do SAP (Plano de Máquinas).',1);return}
  // ordenar as máquinas por nome
  maqs.sort((a,b)=>a.maq.localeCompare(b.maq));
  const doc={maqs,ts:nowIso(),by:getName()||''};
  S.plano=doc;if(st)st.textContent='';renderPlano();
  const tot=maqs.reduce((a,m)=>a+m.seq.length,0);
  toast(`Plano carregado: ${maqs.length} máquina(s), ${tot} cortantes${erros?' ('+erros+' ficheiro(s) ignorado(s))':''}.`);
  if(S.db){try{await S.db.doc('config/plano').set(doc)}catch(e){toast('Lido, mas não guardado na base: '+(e.message||e),1)}}
}
document.addEventListener('click',e=>{if(e.target.id==='planoBtn'){const inp=$('#planoFiles');if(inp){inp.value='';inp.click()}}});
document.addEventListener('change',e=>{if(e.target.id==='planoFiles'){const fs=[...e.target.files];e.target.value='';if(fs.length){planoUpload(fs)}else{toast('Nenhum ficheiro escolhido.',1)}}});
