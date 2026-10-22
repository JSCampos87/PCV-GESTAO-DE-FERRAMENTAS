# PCV Ferramentas

Aplicação web do setor de **Pré-corte e Vinco (PCV)** da Hinojosa / Graphicsleader para gerir as ferramentas de corte.

| Módulo | O que faz |
|---|---|
| **Início** | Contadores dos módulos, ferramentas pedidas e recebidas, alertas de vida dos cortantes, reparações pendentes, não conformidades em aberto, atividade recente. |
| **Armazém** | Pesquisa de cortantes com posição, cliente, Braille, relevo e PDF (SharePoint). Mudança de posição, saída para máquina, reparação, sucata, mapa de posições, **vista 3D das racks** (3 níveis: R/C, piso 1, piso 2), importação e exportação Excel/PDF, cópia de segurança. |
| **Compras** | Pedidos de compra a partir de Excel, PDF ou texto copiado do SAP. Receção com verificação (farpas nas madeiras, peças soltas, elementos danificados), relatório de não conformidade, histórico de receções e KPIs de não conformidades. |
| **Qualidade PCV** | Checklist PCM da equipa do PCV (OK / NOK / N/A), guardar e imprimir, histórico e indicadores. |
| **Operador** | Verificação do cortante à saída da máquina (checklist própria), registo das folhas cortadas, **vida acumulada do cortante com alerta no limite** (geral ou próprio de cada cortante), histórico e KPIs. |
| **Fluxo** | Mapa gráfico com 4 zonas: Armazém, Pré-corte e vinco, Máquinas (uma caixa por máquina) e FAMAG (reparação, devoluções e encomendas). Mostra quantas ferramentas há em cada zona. Para mudar uma ferramenta de sítio, arrasta-se ou clica-se nela e depois no destino; a app pede sempre confirmação e propõe o controlo de qualidade adequado. |
| **Definições** | Toda a configuração num só sítio (só SUPV): checklists PCV e Operador, máquinas, operadores, limites de vida, listas de email por tema, dados/SharePoint e passwords. |

### Níveis de acesso
Ao abrir, a app pede a password do nível (maiúsculas ou minúsculas indiferente). O nível fica guardado no browser; para mudar, clicar no botão do nível no topo.

| Nível | Pode |
|---|---|
| **OP** – Operador | Ecrã inicial simples; consultar o armazém (posições, 3D, PDFs, ficha e histórico do cortante: entradas/saídas, reparações, NOK, quem fez o controlo de qualidade PCV); registar a saída de máquina (checklist e folhas). |
| **PCV** | Tudo o que o OP faz, mais movimentos no armazém, compras e receções, Qualidade PCV e KPIs. Não sucata, não importa/exporta e não altera definições. |
| **SUPV** – Supervisão | Tudo, incluindo sucata, eliminar registos, importar/exportar, cópias de segurança e Definições. |

As passwords iniciais são entregues à parte e mudam-se em **Definições › Acessos**. Servem para separar menus e evitar erros, não são uma proteção forte: quem souber ler o código da página pode contorná-las.

A app é um site estático (HTML + JavaScript), sem servidor próprio.

---

## 1. Publicar no GitHub Pages

1. Criar um repositório no GitHub, por exemplo `pcv-ferramentas`.
   > A lista de cortantes (com nomes de clientes) **não está no repositório**, por isso pode ser público. A base é carregada uma vez dentro da app (ver ponto 2).
2. Enviar todos os ficheiros desta pasta para o repositório (botão **Add file › Upload files**, ou `git push`).
3. Em **Settings › Pages**, escolher **Deploy from a branch**, ramo `main`, pasta `/ (root)` e guardar.
4. Ao fim de 1–2 minutos a app fica disponível em `https://<utilizador>.github.io/pcv-ferramentas/`.

Também funciona sem GitHub: basta abrir o `index.html` num browser (Chrome ou Edge), ou usar o ficheiro único `PCV_Ferramentas.html`.

---

## 2. Onde ficam os dados

### Modo local (por defeito)
Sem configuração, os dados ficam guardados **no browser de cada computador** (localStorage). No topo da app aparece *"Modo local · dados neste browser"*.
- Cada PC tem os seus próprios dados, que não são partilhados entre postos.
- Faça cópias de segurança regulares em **Definições › Dados e SharePoint › Exportar cópia (JSON)**. A cópia pode ser reposta noutro computador.
- Limpar os dados do browser apaga a informação da app.

### Modo partilhado (Firebase – recomendado para vários postos)
Para todos os postos (PCV, operadores, compras) verem os mesmos dados em tempo real:

1. Entrar em <https://console.firebase.google.com> com uma conta Google da empresa e criar um projeto (ex.: `pcv-ferramentas`). O plano gratuito (Spark) chega para este volume.
2. **Build › Firestore Database › Create database** (modo produção, região `europe-west`).
3. **Build › Authentication › Get started › Sign-in method › Anonymous › Enable**.
4. Em **Firestore › Rules**, colar o conteúdo de `firestore.rules` e publicar.
5. Em **Project settings › Your apps › Web (</>)**, registar a app e copiar o bloco `firebaseConfig`.
6. Colar esses valores em `config.js`, no campo `firebase: { ... }`, e enviar o ficheiro para o GitHub.
7. Em **Authentication › Settings › Authorized domains**, adicionar `<utilizador>.github.io`.
8. Abrir a app. No topo deve aparecer *"Ligado · partilhado"*. Entrar como SUPV e, em **Definições › Dados e SharePoint › Repor cópia…**,, escolher o ficheiro **`PCV_base_inicial.json`** (entregue à parte, não vai para o GitHub) para gravar os 1544 cortantes, as posições e as pastas do SharePoint na base partilhada (só da primeira vez). Para passar dados que já estejam em modo local para a base partilhada, use **Exportar cópia** no modo local e **Repor cópia** no modo partilhado.

> Segurança: com o login anónimo, quem tiver o endereço da app consegue usá-la. Para restringir o acesso a contas da empresa, pode ativar o login Microsoft no Firebase Authentication e ajustar as regras; esta parte fica para uma versão seguinte.

---

## 3. Funcionalidades que dependem do ambiente

| Funcionalidade | GitHub / ficheiro | claude.ai |
|---|---|---|
| Colar texto copiado do SAP, Excel, CSV | Sim | Sim |
| PDF de pedido com texto | Sim (leitura por regras) | Sim (leitura pelo Claude) |
| Print / imagem do SAP | Não: copiar as linhas com Ctrl+C | Sim (leitura pelo Claude) |
| Imprimir checklist | Abre o PDF com a janela de impressão | Descarrega o PDF com impressão automática |
| Envio de email das não conformidades | Copiar email / abrir no Outlook (manual) | Igual |
| Vista 3D, Excel, PDF | Bibliotecas incluídas em `js/vendor` (sem CDN) | Bibliotecas da internet (cdnjs) |

---

## 4. Estrutura

```
index.html          página da app
config.js           configuração (Firebase opcional)
css/app.css         estilos
js/store.js         camada de dados (modo local / Firebase)
js/app.js           armazém, compras, qualidade PCV
js/ops.js           vista 3D, operador, cópias de segurança
js/flow.js          mapa Fluxo (arrastar e largar)
js/defs.js          níveis de acesso, Definições, armazém intermédio, índice de PDFs
redirect.html       página de retorno do login Microsoft (Microsoft 365)
js/rack3d.js        desenho 3D das racks (three.js)
js/boot.js          arranque
js/vendor/          bibliotecas (Excel, PDF, 3D, Firebase) – não apagar
img/                logótipos e imagem da página inicial
firestore.rules     regras de segurança do Firestore
```

## 5. Emails automáticos (notificações)
A app envia emails automáticos através do **EmailJS** (gratuito até 200 emails/mês), sem servidor próprio:
- **Não conformidade na receção** → destinatários das não conformidades (Sandra Barros, Vitor Moreira, Mário David), com o relatório no corpo do email.
- **Cortante acima do limite de vida** → lista “Limite de vida atingido”.
- **Cortante NOK à saída da máquina** → lista “Saída NOK de máquina”.

As três listas editam-se em **Definições › Emails**.

Configuração (uma vez, cerca de 10 minutos):
1. Criar conta em <https://www.emailjs.com> (Sign Up).
2. **Email Services › Add New Service**: escolher **Outlook** (conta Microsoft/Office 365 da empresa) ou **Gmail** (por exemplo uma conta criada para a app) e ligar a conta que vai enviar os emails. Copiar o **Service ID**.
3. **Email Templates › Create New Template**, com:
   - *To Email*: `{{to_email}}`
   - *Subject*: `{{subject}}`
   - *Content*: `{{message}}`
   - *Reply To*: `{{reply_to}}`
   
   Guardar e copiar o **Template ID**.
4. **Account › General**: copiar a **Public Key**.
5. No `config.js`, preencher `emailjs: { publicKey: "...", serviceId: "...", templateId: "..." }` e enviar o ficheiro para o GitHub.
6. **Account › Security**: em *Allowed origins* indicar `https://jscampos87.github.io`, para impedir que outros sites usem a conta.
7. Na app, em **Definições › Emails**, clicar em **Enviar email de teste**.

Se a conta da empresa não deixar ligar o Outlook ao EmailJS (política de TI), usar uma conta Gmail só para a app.
O envio automático funciona na versão GitHub. Na versão claude.ai, os emails continuam a ser enviados com “Copiar email” / “Abrir no Outlook”.

## 5a. PDFs do SharePoint e ligação ao Microsoft 365
A app liga cada cortante aos PDFs das pastas **01 - CORTANTES**, **00 - BRAILLES** e **02 - RELEVOS** pelo código que aparece no nome do ficheiro. Por exemplo, S1980B → `S1980BM02_08EX.pdf`, e P00225309 → `P-002253-09+10_02EX.pdf`. Para isso, a app guarda um **índice** com os nomes dos ficheiros de cada pasta (Definições › Dados e SharePoint › Índice de PDFs). Os cortantes importados mais tarde encontram o seu PDF sem mais nenhum passo.

O índice pode ser atualizado de duas formas:
1. **Lista CSV (sem configuração):** no SharePoint, abrir a pasta › **Exportar › Exportar para CSV**. Depois, na app, escolher a pasta, carregar o CSV e clicar em **Guardar índice**. Repetir quando entrarem PDFs novos.
2. **Leitura direta, automática (recomendado):** a app lê as pastas pelo Microsoft Graph. Basta que um utilizador PCV/SUPV tenha sessão Microsoft iniciada na app; a partir daí, o índice atualiza-se sozinho no máximo a cada 4 horas. Configuração (uma vez, normalmente feita pela equipa de IT):
   - Em <https://entra.microsoft.com> › **Aplicações › Registos de aplicações › Novo registo**:
     - Nome: `PCV Ferramentas`.
     - Contas: só desta organização.
     - URI de redirecionamento: plataforma **Aplicação de página única (SPA)**, endereço `https://jscampos87.github.io/PCV-GESTAO-DE-FERRAMENTAS/redirect.html`.
   - Em **Permissões de API**, acrescentar **Microsoft Graph › Delegadas › Files.Read.All**. Se a política da empresa o exigir, pedir ao IT o consentimento de administrador.
   - Copiar o **ID da aplicação (cliente)** e o **ID do diretório (inquilino)** para o `config.js`: `microsoft: { clientId: "…", tenantId: "…" }`.
   - Na app, em **Definições › Dados e SharePoint**, clicar em **Atualizar agora do SharePoint** e entrar com a conta Microsoft da empresa (só da primeira vez).

A app só lê os nomes dos ficheiros; os PDFs abrem no SharePoint com a conta de cada pessoa.

**Pedidos de compra lidos do email (mesmo registo):** acrescentar também as permissões delegadas **Mail.Read** e **Mail.Read.Shared**. A app lê a caixa `precortevinco@graphicsleader.pt` (quem entra com a conta Microsoft tem de ter acesso a essa caixa) de 20 em 20 minutos, procura os emails "[PEDIDO DE COMPRA] - 42xxxxxxxx - …" do Desenho Técnico, lê o PDF do pedido (ex.: 4220018075.pdf) e grava-o em Compras. O registo das leituras aparece na vista Compras, com o botão "Ler agora".

## 5b. Resolução de problemas
- **"Modo local · dados neste browser"** no topo, em vez de "Ligado · partilhado": o `config.js` publicado não tem o Firebase, ou o login Anónimo/as regras não estão ativos. A app mostra um aviso amarelo "Verificar instalação" quando falta algum ficheiro.
- **Erro "Can't find variable: XLSX"**: falta a pasta `js/vendor` no repositório. Envie de novo a pasta `js` completa.
- **Vista 3D e tabela vazias**: a base ainda não foi carregada (passo 8).
- Abra a app no **Safari, Chrome ou Edge**, não no browser interno do WhatsApp/Teams: esses browsers podem bloquear o login e apagar os dados locais.
- Depois de enviar ficheiros novos para o GitHub, espere 1–2 minutos e recarregue a página (no iPhone: fechar o separador e voltar a abrir).
- Passe o rato pelo indicador do topo para ver a versão instalada.

## 6. Configuração dentro da app
Tudo em **Definições** (nível SUPV):
- **Checklists**: checklist PCV e checklist do Operador (separadas).
- **Máquinas e operadores**: adicionar e eliminar.
- **Vida dos cortantes**: limite geral (800 000 folhas por defeito) e limites próprios por cortante (ex.: 600 000 ou 1 500 000).
- **Emails**: listas de destinatários por tema e email de teste.
- **Dados e SharePoint**: importação Excel, cópias de segurança, exportações, pastas do SharePoint e associação dos PDFs.
- **Acessos**: passwords dos três níveis.

## 7. Vista 3D
A vista 3D é **esquemática**:
- Racks A–H com 3 níveis.
- Na rack A, os níveis seguem o campo *Local* (Piso 1 → R/C, Piso 2 → piso 1, Piso 3 → piso 2).
- Nas restantes racks, as posições são distribuídas pelos 3 níveis por ordem.
- Caixotes e outros locais aparecem como zonas no chão.
- A disposição real das racks no pavilhão pode ser ajustada em `js/rack3d.js` (função `buildModel`) quando houver a planta.

---
Hinojosa · Graphicsleader · Setor PCV
