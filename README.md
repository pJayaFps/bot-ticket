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
- Resposta de abertura com embed de sucesso + botão **Ver Ticket**.
- Embed interno do ticket com `Aberto por` e `Assumido por` (atualiza ao assumir).
- Branding em embeds com autor **GUSTAVIN EDITS** + ícone do servidor.
- Botões no ticket: **Sair do Ticket**, **Painel Membro**, **Painel Staff**, **Pagamento Confirmado**.
- Auto-assume na primeira mensagem enviada por staff dentro do ticket.
- `/pix` com QR Code visível no embed e `Pagamento Confirmado`; configuração de preço/PIX via comando `/config-pix` (modal), com prazo automático 3d → 2d → 1d → entregar.
- Deleção pelo painel staff com transcript `.txt` enviado no privado do usuário e no canal de logs, com remoção em 10s.
- Logs configuráveis em canal específico.
- `/config` para configurações gerais sem editar código (incluindo categoria onde novos tickets serão abertos).

## Persistência
- Dados em `data/config.json`.
- Countdown de prazo persiste após reinício via `paymentConfirmedAt` salvo.
