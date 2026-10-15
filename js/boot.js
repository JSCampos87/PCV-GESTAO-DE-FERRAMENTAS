/* ============ arranque ============ */
$('#qData').value=today();$('#xData').value=today();$('#xOp').value=getName();renderExitList();fillMaqSelect();
const h=(location.hash||'').slice(1);go(['inicio','armazem','pedidos','qualidade','operador'].includes(h)?h:'inicio');
renderChecklist();renderEditor();
initDb().catch(e=>{toast('Erro ao ligar: '+(e.message||e.code),1)});
