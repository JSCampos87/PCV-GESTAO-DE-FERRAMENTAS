/* Configuração da app PCV Ferramentas.
   Sem Firebase: a app funciona em "modo local" — os dados ficam guardados no browser de cada computador.
   Com Firebase: preencha o bloco firebase com os dados do projeto (Consola Firebase › Definições do projeto › As suas apps › Configuração)
   e todos os postos passam a ver e gravar os mesmos dados. Ver README.md. */
window.PCV_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDXbQYTg5b3oEY9LD1l0uX-yWzha5h7uQ0",
    authDomain: "pcv-ferramentas.firebaseapp.com",
    projectId: "pcv-ferramentas",
    storageBucket: "pcv-ferramentas.firebasestorage.app",
    messagingSenderId: "894420989495",
    appId: "1:894420989495:web:3f3953ef08d870b3b1f1b2"
  },
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
