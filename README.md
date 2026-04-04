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
- `/enviar-ticket` com modal para configurar painel de abertura.
- Abertura de tickets privados com permissões por cargo.
- Painel de membro e painel de staff com ações por botões e modais.
- Sistema de assumir ticket (automático no primeiro staff message + botão manual).
- `/pix` e botão `Pagamento Confirmado` com prazo automático de 3 dias e renomeação diária.
- Fechamento com modal de status/observações e transcript `.txt` enviado no PV.
- Logs configuráveis em canal específico.
- `/config` para configurações gerais sem editar código.

## Persistência
- Dados em `data/config.json`.
- Countdown de prazo persiste após reinício via `paymentConfirmedAt` salvo.
