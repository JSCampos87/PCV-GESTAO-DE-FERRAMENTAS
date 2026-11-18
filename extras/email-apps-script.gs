/* PCV Ferramentas – envio de emails por uma conta Google (alternativa ao EmailJS, sem limite mensal).
   Instalação (uma vez, ~5 minutos), com a conta Gmail que vai enviar:
   1. Abrir https://script.google.com › Novo projeto › colar este ficheiro todo › Guardar (nome: PCV Email).
   2. Escolher a função "teste" › Executar › Autorizar (envia um email de teste para a própria conta).
   3. Implementar › Nova implementação › tipo "Aplicação Web":
        Executar como: Eu  ·  Quem tem acesso: Qualquer pessoa  › Implementar.
   4. Copiar o URL (termina em /exec) para o config.js › google.scriptUrl e publicar.
   Proteções: só envia para os domínios da lista DOMINIOS, exige o TOKEN e tem um limite diário.
   Quota Google: ~100 destinatários/dia (Gmail gratuito) ou 1500/dia (Google Workspace). */

const TOKEN = '437e91a862a84d608bb4ce3dbf7daed3';           // igual ao config.js › google.token
const DOMINIOS = ['graphicsleader.pt', 'hinojosa.com', 'hinojosagroup.com'];
const NOME = 'PCV Ferramentas';
const RESPONDER_PARA = 'precortevinco@graphicsleader.pt';
const MAX_DIA = 90;                                          // emails por dia (proteção contra abusos)

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, err: 'token inválido' });
    const to = lista(d.to), cc = lista(d.cc);
    if (!to.length) return out({ ok: false, err: 'sem destinatários' });
    const fora = to.concat(cc).filter(a => !DOMINIOS.some(x => a.toLowerCase().endsWith('@' + x)));
    if (fora.length) return out({ ok: false, err: 'domínio não autorizado: ' + fora.join(', ') });
    const p = PropertiesService.getScriptProperties();
    const dia = Utilities.formatDate(new Date(), 'Europe/Lisbon', 'yyyy-MM-dd');
    const n = p.getProperty('dia') === dia ? +p.getProperty('n') : 0;
    if (n >= MAX_DIA) return out({ ok: false, err: 'limite diário de ' + MAX_DIA + ' emails atingido' });
    if (MailApp.getRemainingDailyQuota() < to.length + cc.length) return out({ ok: false, err: 'quota diária do Google esgotada' });
    const msg = { to: to.join(','), subject: String(d.subject || '').slice(0, 250), body: String(d.message || ''), name: NOME, replyTo: RESPONDER_PARA };
    if (cc.length) msg.cc = cc.join(',');
    MailApp.sendEmail(msg);
    p.setProperties({ dia: dia, n: String(n + 1) });
    return out({ ok: true, restante: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, err: String(err) });
  }
}
function doGet() { return out({ ok: true, servico: 'PCV Email', restante: MailApp.getRemainingDailyQuota() }); }
function lista(v) { return (Array.isArray(v) ? v : String(v || '').split(/[,;]\s*/)).map(s => String(s).trim()).filter(Boolean); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function teste() { MailApp.sendEmail(Session.getActiveUser().getEmail(), '[PCV] Teste do Apps Script', 'Se recebeste isto, o envio está a funcionar.'); }
