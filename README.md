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
- Botões no ticket: **Fechar Ticket**, **Painel Membro**, **Painel Staff**, **Pagamento Confirmado**.
- `/assumir-ticket` + auto-assume na primeira mensagem da staff.
- Mensagem automática detalhada enviada após abrir ticket.
- `/pix` e `Pagamento Confirmado` com prazo automático 3d → 2d → 1d → entregar.
- Fechamento/deleção com transcript `.txt` enviado no privado do usuário e no canal de logs, com remoção em 10s.
- Logs configuráveis em canal específico.
- `/config` para configurações gerais sem editar código.

## Persistência
- Dados em `data/config.json`.
- Countdown de prazo persiste após reinício via `paymentConfirmedAt` salvo.
