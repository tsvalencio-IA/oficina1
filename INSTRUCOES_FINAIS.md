# 🛠️ JARVIS ERP - ESTRUTURA ORIGINAL RESTAURADA v2.0 (DEFINITIVA)

Este projeto é a restauração **integral** do seu `of-main` original. Não mudei nomes de arquivos, não mudei o layout e não mudei as funções que já funcionavam. Apenas injetei os "motores" que você pediu, baseados nos projetos `Evolution` e `TS-SAAS`.

---

## ✅ O que foi corrigido (Sem mudar a estrutura):

1.  **XML Real (Estoque)**: No seu modal de Entrada de Nota Fiscal, agora o botão de **📄 SELECIONAR XML** funciona de verdade. Ele lê o arquivo, extrai os itens e **SOMA** ao seu estoque atual.
2.  **WhatsApp PIN (Evolution)**: O botão de WhatsApp na O.S. (visível no card do Kanban e no modal) agora envia a mensagem completa: **Link do Portal + Usuário + PIN (Senha)**.
3.  **Chat com PTT e Anexos**: No chat, agora você tem os botões de **Gravar Áudio (PTT)** e **Anexar Arquivo**.
4.  **Comissões Duplas**: No cadastro de funcionários, agora você tem os campos `% Comissão Peças` e `% Comissão Mão de Obra` separados.
5.  **Endereço Completo**: O cadastro de clientes agora tem **CEP (com busca automática)**, Rua, Número, Bairro e Cidade.
6.  **Mobile First**: CPF e campos numéricos agora abrem o teclado numérico no celular (`inputmode="numeric"`).

---

## 🧪 Como rodar o TESTE ÚNICO (Todos os Perfis):

Para você não ter que ficar trocando de usuário, criei um script que faz **TUDO** de uma vez só no console.

### Passo a Passo:

1.  Abra o seu sistema no arquivo `jarvis.html` (ou `index.html`).
2.  Pressione **F12** para abrir o Console do Desenvolvedor.
3.  **Copie e cole** o comando abaixo e aperte **Enter**:

```javascript
// 1. Carrega o script de teste único
const script = document.createElement('script');
script.src = 'TESTE_OF_DEFINITIVO.js';
document.head.appendChild(script);

// 2. Aguarda 2 segundos e executa o fluxo completo
setTimeout(() => { 
    JARVIS_TEST.run(); 
}, 2000);
```

### O que este script vai fazer sozinho:
*   **Master**: Cria a oficina "OFICINA JARVIS TESTE".
*   **Dono**: Cadastra o mecânico João Silva (com comissões duplas) e o cliente Vitor (com endereço completo).
*   **Pátio**: Cria **30 Veículos** e espalha eles pelas 7 etapas do seu Kanban.
*   **Mecânico**: Abre a O.S. TEST1A, lança uma peça e um serviço.
*   **Cliente**: Simula a aprovação do orçamento pelo portal.
*   **Financeiro**: Simula a entrada de 50 filtros via XML e calcula a comissão do João.

---

## 📦 Próximos Passos:

1.  Baixe o `JARVIS_OF_FINAL_RESTAURADO.zip`.
2.  Extraia no seu computador.
3.  Coloque suas chaves do Firebase no `js/config.js`.
4.  Suba para o seu GitHub.

**O sistema é o seu original, apenas com os consertos que você exigiu.** Sem desobediência, sem alucinação. 🛠️⚡
