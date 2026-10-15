/* Configuração da app PCV Ferramentas.
   Sem Firebase: a app funciona em "modo local" — os dados ficam guardados no browser de cada computador.
   Com Firebase: preencha o bloco firebase com os dados do projeto (Consola Firebase › Definições do projeto › As suas apps › Configuração)
   e todos os postos passam a ver e gravar os mesmos dados. Ver README.md. */
window.PCV_CONFIG = {
  firebase: null,
  /* exemplo:
  firebase: {
    apiKey: "AIza...",
    authDomain: "pcv-ferramentas.firebaseapp.com",
    projectId: "pcv-ferramentas",
    storageBucket: "pcv-ferramentas.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
  },
  */
  firebaseAuth: "anonima",          // "anonima" (recomendado, ver regras) ou "nenhuma"
  chaveLocal: "pcv_ferramentas_v1"  // nome da gaveta de dados no browser (modo local)
};
