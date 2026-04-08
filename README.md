# Discord Ticket Bot (Zero Code)

## Como rodar
1. Copie `.env.example` para `.env` e preencha os IDs.
2. Instale dependências:
   ```bash
   npm install
   ```
3. Rode o bot:
   ```bash
   npm start
   ```

## Recursos implementados
- `/enviar-ticket` com modal para configurar painel com embed mais visual.
- No campo de staff, aceita **ID de cargo ou ID de usuário** e múltiplos IDs separados por vírgula (ex.: `906914806186012712,1203062428263252021`).
- `/enviar-valores` para enviar embed de tabela de valores (com imagem) e botão **Abrir Ticket** redirecionando ao canal do painel.
- Resposta de abertura com embed de sucesso + botão **Ver Ticket**.
- Embed interno do ticket com `Aberto por` e `Assumido por` (atualiza ao assumir).
- Branding em embeds com autor **GUSTAVIN EDITS** + ícone do servidor.
- Botões no ticket: **Sair do Ticket**, **Painel Membro**, **Painel Staff**, **Pagamento Confirmado**.
- Auto-assume na primeira mensagem enviada por staff dentro do ticket.
- `/pix` com QR Code visível no embed e `Pagamento Confirmado`; configuração de preço/PIX via comando `/config-pix` (modal), com prazo automático 3d → 2d → 1d → entregar.
- `/pix` com botão **Copiar PIX** (resposta ephemera com a chave para mobile) e botão `Pagamento Confirmado`; configuração de preço/PIX via comando `/config-pix` (modal), com prazo automático 3d → 2d → 1d → entregar.
- Deleção pelo painel staff com transcript `.txt` enviado no privado do usuário e no canal de logs, com remoção em 10s.
- Logs configuráveis em canal específico.
- `/config` para configurações gerais sem editar código (incluindo o canal onde o bot abrirá os tickets como tópico privado).

## Persistência
- Dados em `data/config.json`.
- Countdown de prazo persiste após reinício via `paymentConfirmedAt` salvo.
