# ✅ PROMPT FINAL — BOT DISCORD 100% CONFIGURÁVEL (ZERO CODE) + PRAZO AUTOMÁTICO

## 🎯 Objetivo
Crie um bot de Discord **isolado, profissional e totalmente independente**, sem integração com outros bots, APIs externas ou sistemas de vendas já existentes.

O bot deve ser **100% configurável dentro do Discord**, sem editar código, usando apenas:
- Botões
- Menus/Selects
- Modals
- Embeds
- Painéis internos de configuração
- (Opcional) painel web complementar

---

## 🔒 Requisitos Gerais Obrigatórios
1. **Zero Code para o dono**: nenhuma configuração pode depender de abrir arquivos do projeto.
2. **Permissões por cargo**: cada ação/botão deve validar cargos permitidos.
3. **Múltiplos tickets simultâneos**: funcionamento estável sem travar/duplicar.
4. **Logs completos**: registrar ações de usuários e staff.
5. **Interface 100% Discord**: configuração e operação por UI interativa.

---

## 1) Comando `/enviar-ticket`
Crie um comando administrativo `/enviar-ticket` que abre um modal com os campos:
- Título do embed
- Descrição
- Categoria onde tickets serão criados
- Cargo da staff com acesso
- Cargo autorizado a abrir ticket
- Cor do embed

Ao confirmar, o bot publica o painel com botão:
- **➡️ Abrir Ticket**

Tudo deve ficar salvo e editável pelo sistema de configurações.

---

## 2) Abertura de Ticket
Ao clicar em **Abrir Ticket**:
- Criar canal privado com nome `ticket-[usuario]`
- Permissões: apenas usuário do ticket + staff + bot
- Enviar embed inicial com botões:
  - Painel Membro
  - Painel Staff
  - Sair do Ticket
  - Pagamento Confirmado
- Enviar mensagem automática configurável

---

## 3) Painel Membro (apenas dentro do ticket)
Opções:
- Adicionar membro ao ticket
- Remover membro do ticket
- Notificar staff

---

## 4) Painel Staff (somente staff visualiza/usa)
Opções:
- Adicionar usuário ao ticket
- Remover usuário
- Renomear ticket
- Fechar ticket
- Deletar ticket
- Notificar usuário
- Marcar como resolvido

Todas as ações por botões/menus/modals.

---

## 5) Sistema de “Assumir Ticket”
Escolha a implementação mais estável:
- Automático: ao primeiro envio de mensagem por staff, marcar como assumido
- Ou botão “Assumir Ticket”

Ao assumir, o bot envia:
- `Este ticket foi assumido por: STAFF-NAME.`

Registrar em log.

---

## 6) Sair do Ticket
Ao clicar:
- Abrir confirmação
- Se confirmar: remover usuário do ticket **ou** fechar ticket (conforme permissões/regras)
- Registrar em log

---

## 7) Sistema PIX + Prazo Automático (CRÍTICO)
Comando `/pix` envia embed com:
- QR Code PIX
- Nome do recebedor
- Chave PIX (se configurada)
- Valor
- Mensagem/descrição configurável
- Botão: **Pagamento Confirmado**

Quando staff clicar em **Pagamento Confirmado**:
1. Enviar mensagem: `Pagamento confirmado pela staff.`
2. Registrar log
3. **Ativar prazo automático de entrega de 3 dias fixos**

### Regras do prazo automático
- Sempre começa em **3 dias** no momento do clique em Pagamento Confirmado.
- Renomear o ticket para:
  - `prazo-[nome-do-cliente]-3d`
- Após 24h, renomear para:
  - `prazo-[nome-do-cliente]-2d`
- Após mais 24h, renomear para:
  - `prazo-[nome-do-cliente]-1d`
- Após mais 24h, renomear para:
  - `prazo-[nome-do-cliente]-entregar`

### Requisitos técnicos do countdown
- Persistir timestamp no banco/armazenamento.
- Continuar correto mesmo após reiniciar o bot.
- Cada atualização de nome deve gerar log no canal configurado.

---

## 8) Transcript Automático (MUITO IMPORTANTE)
Ao staff clicar em **Fechar Ticket**:
1. Abrir modal obrigatório com:
   - Status final: `resolvido | nao resolvido | cancelado | entregue`
   - Observações rápidas
2. Antes de mover/deletar o canal, gerar transcript em formato configurável:
   - `.html` **ou** `.txt` **ou** `embed + link`
3. Enviar no PV do usuário:

### Embed 1 — Resumo
- Aberto por
- Fechado por
- Atendido por (staff que assumiu)
- Status final
- Transcript anexado ou link

### Embed 2 — Avaliação
Texto de avaliação + botão:
- **Avaliar Atendimento**
- Botão redireciona ao canal configurado de feedback

Registrar tudo em log.

---

## 9) Fechamento Final
Após envio do resumo/transcript ao usuário:
- Enviar log para staff
- Mover ticket para categoria **Tickets Fechados**
  - **ou** deletar automaticamente após X segundos
- Essa política deve ser configurável no painel

---

## 10) Painel de Configuração Interno (100% Zero Code)
Criar painel de configuração completo, por botões/selects/modals, incluindo:

### Tickets
- Categoria dos tickets
- Cargo da staff
- Cargo autorizado a abrir ticket
- Mensagem automática ao abrir
- Canal de logs
- Categoria de tickets fechados
- Tempo para deletar ticket após fechamento
- Cores de embeds

### PIX
- QR Code
- Chave PIX
- Nome do recebedor
- Valor
- Textos/mensagens do embed
- Confirmação manual por botão

### Transcript
- Tipo (`.html`, `.txt`, `embed + link`)
- Canal para armazenar transcript (opcional)

Tudo editável sem tocar no código.

---

## 11) Regras Finais Obrigatórias
- Bot totalmente isolado e independente
- Permissões protegidas por cargo em toda interação
- Suporte real a múltiplos tickets simultâneos
- Logs claros e automáticos de todas as ações
- Nada pode depender de edição manual de código
- Interface operacional e administrativa 100% dentro do Discord
