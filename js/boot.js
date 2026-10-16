/* ============ arranque ============ */
$('#qData').value=today();$('#xData').value=today();$('#xOp').value=getName();renderExitList();fillMaqSelect();
const h=(location.hash||'').slice(1);go(['inicio','armazem','pedidos','qualidade','operador'].includes(h)?h:'inicio');
renderChecklist();renderEditor();
if(window.PCV_DIAG&&PCV_DIAG.length){$('#banner').innerHTML='<div class="banner"><b>Verificar instalação:</b><br>'+PCV_DIAG.join('<br>')+'</div>'}
initDb().catch(e=>{toast('Erro ao ligar: '+(e.message||e.code),1)});

if(window.PCV_VERSAO){const s=$('#sync');if(s)s.title='Versão '+PCV_VERSAO}
