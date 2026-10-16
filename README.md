# PCV Ferramentas

Aplicação web do setor de **Pré-corte e Vinco (PCV)** da Hinojosa / Graphicsleader para gerir as ferramentas de corte.

| Módulo | O que faz |
|---|---|
| **Início** | Contadores dos módulos, ferramentas pedidas e recebidas, alertas de vida dos cortantes, reparações pendentes, não conformidades em aberto, atividade recente. |
| **Armazém** | Pesquisa de cortantes com posição, cliente, Braille, relevo e PDF (SharePoint). Mudança de posição, saída para máquina, reparação, sucata, mapa de posições, **vista 3D das racks** (3 níveis: R/C, piso 1, piso 2), importação e exportação Excel/PDF, cópia de segurança. |
| **Compras** | Pedidos de compra a partir de Excel, PDF ou texto copiado do SAP. Receção com verificação (farpas nas madeiras, peças soltas, elementos danificados), relatório de não conformidade, histórico de receções e KPIs de não conformidades. |
| **Qualidade PCV** | Checklist PCM da equipa do PCV (OK / NOK / N/A), guardar e imprimir, histórico, indicadores e edição da checklist. |
| **Operador** | Verificação do cortante à saída da máquina (mesma checklist), registo das folhas cortadas, **vida acumulada do cortante com alerta acima de 800 000 folhas**, histórico e KPIs. |

A app é um site estático (HTML + JavaScript), sem servidor próprio.

---

## 1. Publicar no GitHub Pages

1. Criar um repositório no GitHub, por exemplo `pcv-ferramentas`.
   > **Importante:** `data/seed.js` tem a lista de cortantes com **nomes de clientes**. Num repositório **público**, qualquer pessoa os pode ver. Use um repositório **privado** (o GitHub Pages em repositórios privados exige um plano GitHub Team/Enterprise da empresa) **ou** apague `data/seed.js` antes de enviar e carregue a base pelo Excel dentro da app (Armazém › Importar / exportar).
2. Enviar todos os ficheiros desta pasta para o repositório (botão **Add file › Upload files**, ou `git push`).
3. Em **Settings › Pages**, escolher **Deploy from a branch**, ramo `main`, pasta `/ (root)` e guardar.
4. Ao fim de 1–2 minutos a app fica disponível em `https://<utilizador>.github.io/pcv-ferramentas/`.

Também funciona sem GitHub: basta abrir o `index.html` num browser (Chrome ou Edge), ou usar o ficheiro único `PCV_Ferramentas.html`.

---

## 2. Onde ficam os dados

### Modo local (por defeito)
Sem configuração, os dados ficam guardados **no browser de cada computador** (localStorage). No topo da app aparece *"Modo local · dados neste browser"*.
- Cada PC tem os seus próprios dados, que não são partilhados entre postos.
- Faça cópias de segurança regulares em **Armazém › Importar / exportar › Exportar cópia (JSON)**. A cópia pode ser reposta noutro computador.
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
8. Abrir a app. No topo deve aparecer *"Ligado · partilhado"*. Em **Armazém**, clicar em **Carregar base inicial** para gravar os 1544 cortantes na base partilhada (só da primeira vez). Para passar dados que já estejam em modo local para a base partilhada, use **Exportar cópia** no modo local e **Repor cópia** no modo partilhado.

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
js/rack3d.js        desenho 3D das racks (three.js)
js/boot.js          arranque
js/vendor/          bibliotecas (Excel, PDF, 3D, Firebase) – não apagar
data/seed.js        base inicial (CORTANTES PCV, 25/09/2024)
img/                logótipos e imagem da página inicial
firestore.rules     regras de segurança do Firestore
```

## 5. Resolução de problemas
- **"Modo local · dados neste browser"** no topo, em vez de "Ligado · partilhado": o `config.js` publicado não tem o Firebase, ou o login Anónimo/as regras não estão ativos. A app mostra um aviso amarelo "Verificar instalação" quando falta algum ficheiro.
- **Erro "Can't find variable: XLSX"** ou a vista 3D vazia: faltam ficheiros na pasta `js/vendor` ou `data` no repositório. Envie de novo a pasta completa.
- Abra a app no **Safari, Chrome ou Edge**, não no browser interno do WhatsApp/Teams: esses browsers podem bloquear o login e apagar os dados locais.
- Depois de enviar ficheiros novos para o GitHub, espere 1–2 minutos e recarregue a página (no iPhone: fechar o separador e voltar a abrir).
- Passe o rato pelo indicador do topo para ver a versão instalada.

## 6. Configuração dentro da app
- **Qualidade PCV › Editar checklist**: pontos da checklist PCM (usada também pelo operador), máquinas, **limite de vida do cortante** (800 000 folhas por defeito) e destinatários das não conformidades.
- **Armazém › Importar / exportar**: pastas do SharePoint com os PDFs, associação automática dos PDFs pelo código do cortante, importação Excel e cópias de segurança.

## 7. Vista 3D
A vista 3D é **esquemática**:
- Racks A–H com 3 níveis.
- Na rack A, os níveis seguem o campo *Local* (Piso 1 → R/C, Piso 2 → piso 1, Piso 3 → piso 2).
- Nas restantes racks, as posições são distribuídas pelos 3 níveis por ordem.
- Caixotes e outros locais aparecem como zonas no chão.
- A disposição real das racks no pavilhão pode ser ajustada em `js/rack3d.js` (função `buildModel`) quando houver a planta.

---
Hinojosa · Graphicsleader · Setor PCV
