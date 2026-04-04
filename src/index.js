import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { readData, updateData } from './storage.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('Defina DISCORD_TOKEN, CLIENT_ID e GUILD_ID no .env');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder().setName('enviar-ticket').setDescription('Configura e envia o painel de ticket'),
  new SlashCommandBuilder().setName('pix').setDescription('Envia embed PIX no ticket atual'),
  new SlashCommandBuilder().setName('config').setDescription('Abre painel de configurações internas'),
  new SlashCommandBuilder().setName('assumir-ticket').setDescription('Assume o ticket atual (somente staff)')
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

const AUTO_MESSAGE = `:rokedazul: **Número 1. CLIPS!**
Na edit CLEAN 30seg = 10/12 clips SOMENTE!
Na edit CLEAN 45seg = 12/16 clips SOMENTE!
Na edit CLEAN 1min = 16/20 clips SOMENTE!

Na edit BÁSICA 30seg = 15/20 clips SOMENTE!
Na edit BÁSICA 45seg = 20/25 clips SOMENTE!
Na edit BÁSICA 1min = 25/30 clips SOMENTE!

Na edit AVANÇADA 30seg = 20/25 clips SOMENTE!
Na edit AVANÇADA 45seg = 25/30 clips SOMENTE!
Na edit AVANÇADA 1min = 30/35 clips SOMENTE!

Obrigatório ser a quantidade pedida, nada a MAIS nem a MENOS.

:rokedazul: **Número 2. MÚSICA!**
Escolha a música desejada, envie o link do YouTube.
Informe o trecho desejado. Exemplo: "COMEÇA EM 0:00".

:rokedazul: **Número 3. ENTREGA DO VÍDEO!**
A entrega acontece por ordem da fila.

Se ocorrer algum imprevisto, avisaremos em <#ANUNCIOS_CHANNEL_ID>.
Fique de olho nas notificações.`;

function hasRole(member, roleId) {
  if (!roleId) return true;
  return member.roles.cache.has(roleId);
}

function isStaff(member, data) {
  return hasRole(member, data.config.ticketPanel.staffRoleId);
}

function userTicketEmbed(user, meta) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Atendimento iniciado')
    .setDescription(`Olá, ${user}. Nossa equipe já foi avisada sobre a abertura do seu ticket.\n\nEnquanto aguarda um staff, descreva seu pedido com o máximo de detalhes.`)
    .addFields(
      { name: 'Aberto por', value: `${user}`, inline: true },
      { name: 'Assumido por', value: meta?.assumedBy ? `<@${meta.assumedBy}>` : 'Ninguém ainda', inline: true }
    )
    .setColor(0x5865f2);

  return embed;
}

function ticketButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('leave_ticket').setLabel('Sair do Ticket').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('member_panel').setLabel('Painel Membro').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_panel').setLabel('Painel Staff').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pay_confirmed').setLabel('Pagamento Confirmado').setStyle(ButtonStyle.Success)
    )
  ];
}

function ticketPanelEmbed(data) {
  const painel = data.config.ticketPanel;
  return new EmbedBuilder()
    .setTitle(painel.title || '🎬 Central de Pedidos')
    .setDescription(
      `${painel.description || 'Abra um ticket para iniciar seu atendimento.'}\n\n` +
      '✨ **Atendimento personalizado, edição premium e entrega ágil.**\n' +
      '🚀 **Garanta agora sua edição exclusiva e destaque seu conteúdo.**'
    )
    .setColor(painel.color || '#2b2d31');
}

async function logAction(guild, text) {
  const data = readData();
  const logsId = data.config.ticket.logsChannelId;
  if (!logsId) return;
  const logs = await guild.channels.fetch(logsId).catch(() => null);
  if (!logs || !logs.isTextBased()) return;
  await logs.send({ content: `📝 ${text}` });
}

async function updateTicketMainMessage(channelId) {
  const data = readData();
  const meta = data.tickets[channelId];
  if (!meta?.mainMessageId) return;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const msg = await channel.messages.fetch(meta.mainMessageId).catch(() => null);
  if (!msg) return;

  const opener = await guild.members.fetch(meta.openerId).catch(() => null);
  const user = opener?.user || { id: meta.openerId, toString: () => `<@${meta.openerId}>` };
  await msg.edit({ embeds: [userTicketEmbed(user, meta)], components: ticketButtons() });
}

async function setAssumed(channel, staffUser) {
  const data = readData();
  const meta = data.tickets[channel.id];
  if (!meta || meta.assumedBy) return false;

  updateData((d) => {
    if (d.tickets[channel.id]) d.tickets[channel.id].assumedBy = staffUser.id;
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ Ticket assumido')
    .setDescription(`Este ticket foi assumido por ${staffUser}.\n\nA partir deste momento, o atendimento e atualizações ficam sob responsabilidade dele(a).`)
    .setColor(0x2ecc71);

  await channel.send({ embeds: [embed] });
  await updateTicketMainMessage(channel.id);
  await logAction(channel.guild, `${staffUser.tag} assumiu o ticket ${channel.name}.`);
  return true;
}

async function renameDeadlineTicket(guild, ticketMeta, channelId) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  const now = Date.now();
  const elapsed = Math.floor((now - ticketMeta.paymentConfirmedAt) / (24 * 60 * 60 * 1000));
  const stage = Math.min(elapsed, 3);
  if (stage === ticketMeta.deadlineStage) return;

  const opener = await guild.members.fetch(ticketMeta.openerId).catch(() => null);
  const base = opener?.user?.username?.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'cliente';
  const suffix = ['3d', '2d', '1d', 'entregar'][stage];
  const newName = `prazo-${base}-${suffix}`.slice(0, 90);
  await channel.setName(newName).catch(() => null);

  updateData((d) => {
    if (d.tickets[channelId]) d.tickets[channelId].deadlineStage = stage;
  });
  await logAction(guild, `Ticket ${channelId} renomeado para ${newName}.`);
}

setInterval(async () => {
  const data = readData();
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  for (const [channelId, ticketMeta] of Object.entries(data.tickets)) {
    if (!ticketMeta.paymentConfirmedAt) continue;
    await renameDeadlineTicket(guild, ticketMeta, channelId);
  }
}, 60 * 60 * 1000);

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  const data = readData();
  const ticketMeta = data.tickets[message.channelId];
  if (!ticketMeta || ticketMeta.assumedBy) return;
  if (!isStaff(message.member, data)) return;

  await setAssumed(message.channel, message.author);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const data = readData();

    if (interaction.commandName === 'enviar-ticket') {
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      const modal = new ModalBuilder().setCustomId('setup_ticket_panel').setTitle('Configurar painel ticket');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.title || '🎬 Central de Pedidos')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(data.config.ticketPanel.description || 'Abra seu ticket para iniciar o atendimento.')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staffRole').setLabel('Cargo staff ID').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.staffRoleId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('openRole').setLabel('Cargo pode abrir ID').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.openerRoleId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Cor do embed (#5865F2)').setStyle(TextInputStyle.Short).setRequired(false).setValue(data.config.ticketPanel.color || '#5865F2'))
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.commandName === 'config') {
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      const modal = new ModalBuilder().setCustomId('setup_global').setTitle('Configuração geral');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('logs').setLabel('Canal logs ID').setStyle(TextInputStyle.Short).setRequired(false).setValue(data.config.ticket.logsChannelId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('closed').setLabel('Categoria fechados ID').setStyle(TextInputStyle.Short).setRequired(false).setValue(data.config.ticket.closedCategoryId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('delsec').setLabel('Deletar após fechar (segundos)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(data.config.ticket.deleteClosedAfterSeconds || 0))),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('Canal feedback ID').setStyle(TextInputStyle.Short).setRequired(false).setValue(data.config.feedbackChannelId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('transcript').setLabel('Transcript tipo: txt/html/embed').setStyle(TextInputStyle.Short).setRequired(false).setValue(data.config.transcript.type || 'txt'))
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.commandName === 'pix') {
      const ticketMeta = data.tickets[interaction.channelId];
      if (!ticketMeta) {
        await interaction.reply({ content: 'Use /pix dentro de um ticket.', ephemeral: true });
        return;
      }
      const pix = data.config.pix;
      const embed = new EmbedBuilder()
        .setTitle('Pagamento PIX')
        .setDescription(pix.message || 'Pague pelo PIX abaixo.')
        .addFields(
          { name: 'Recebedor', value: pix.receiverName || 'Não configurado' },
          { name: 'Chave PIX', value: pix.pixKey || 'Não configurado' },
          { name: 'Valor', value: pix.value || 'Não configurado' },
          { name: 'QR Code', value: pix.qrCode || 'Não configurado' }
        )
        .setColor(0x2ecc71);
      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pay_confirmed').setLabel('Pagamento Confirmado').setStyle(ButtonStyle.Success))]
      });
      return;
    }

    if (interaction.commandName === 'assumir-ticket') {
      const meta = data.tickets[interaction.channelId];
      if (!meta) {
        await interaction.reply({ content: 'Use este comando dentro de um ticket.', ephemeral: true });
        return;
      }
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      const changed = await setAssumed(interaction.channel, interaction.user);
      await interaction.reply({ content: changed ? 'Ticket assumido com sucesso.' : 'Este ticket já foi assumido.', ephemeral: true });
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'setup_ticket_panel') {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const staffRoleId = interaction.fields.getTextInputValue('staffRole');
      const openerRoleId = interaction.fields.getTextInputValue('openRole');
      const color = interaction.fields.getTextInputValue('color') || '#5865F2';

      updateData((d) => {
        d.config.ticketPanel.title = title;
        d.config.ticketPanel.description = description;
        d.config.ticketPanel.staffRoleId = staffRoleId;
        d.config.ticketPanel.openerRoleId = openerRoleId;
        d.config.ticketPanel.color = color;
      });

      await interaction.reply({ content: 'Painel enviado.', ephemeral: true });
      await interaction.channel.send({
        embeds: [ticketPanelEmbed(readData())],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('➡️ Abrir Ticket').setStyle(ButtonStyle.Primary))]
      });
      return;
    }

    if (interaction.customId === 'setup_global') {
      updateData((d) => {
        d.config.ticket.logsChannelId = interaction.fields.getTextInputValue('logs');
        d.config.ticket.closedCategoryId = interaction.fields.getTextInputValue('closed');
        d.config.ticket.deleteClosedAfterSeconds = Number(interaction.fields.getTextInputValue('delsec') || 0);
        d.config.feedbackChannelId = interaction.fields.getTextInputValue('feedback');
        d.config.transcript.type = interaction.fields.getTextInputValue('transcript') || 'txt';
      });
      await interaction.reply({ content: 'Configurações atualizadas.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'close_ticket_modal') {
      const data = readData();
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      const status = interaction.fields.getTextInputValue('status');
      const notes = interaction.fields.getTextInputValue('notes');
      const meta = data.tickets[interaction.channelId];
      if (!meta) {
        await interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });
        return;
      }

      const transcriptMessages = await interaction.channel.messages.fetch({ limit: 100 });
      const lines = [...transcriptMessages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '(sem texto)'}`)
        .join('\n');
      const transcriptContent = `Ticket: ${interaction.channel.name}\nStatus: ${status}\nObs: ${notes}\n\n${lines}`;

      const user = await client.users.fetch(meta.openerId).catch(() => null);
      if (user) {
        const summary = new EmbedBuilder()
          .setTitle('Resumo do Ticket')
          .addFields(
            { name: 'Aberto por', value: `<@${meta.openerId}>` },
            { name: 'Fechado por', value: `<@${interaction.user.id}>` },
            { name: 'Atendido por', value: meta.assumedBy ? `<@${meta.assumedBy}>` : 'Não assumido' },
            { name: 'Status final', value: status }
          )
          .setColor(0x3498db);

        const feedback = new EmbedBuilder().setTitle('Avaliação').setDescription('Avalie seu atendimento para nos ajudar.').setColor(0xf1c40f);
        const feedbackButton = new ButtonBuilder()
          .setLabel('Avaliar Atendimento')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${interaction.guildId}/${data.config.feedbackChannelId || interaction.channelId}`);

        await user.send({ embeds: [summary] }).catch(() => null);
        await user.send({ files: [{ attachment: Buffer.from(transcriptContent, 'utf8'), name: `transcript-${interaction.channelId}.txt` }] }).catch(() => null);
        await user.send({ embeds: [feedback], components: [new ActionRowBuilder().addComponents(feedbackButton)] }).catch(() => null);
      }

      await logAction(interaction.guild, `Ticket ${interaction.channel.name} fechado por ${interaction.user.tag}. Status: ${status}.`);
      await interaction.reply({ content: 'Ticket fechado com sucesso.', ephemeral: true });

      updateData((d) => {
        if (d.tickets[interaction.channelId]) {
          d.tickets[interaction.channelId].status = status;
          d.tickets[interaction.channelId].closedBy = interaction.user.id;
        }
      });

      if (data.config.ticket.closedCategoryId) {
        await interaction.channel.setParent(data.config.ticket.closedCategoryId).catch(() => null);
      }

      const secs = data.config.ticket.deleteClosedAfterSeconds;
      if (secs > 0) {
        setTimeout(() => interaction.channel.delete('Auto-delete pós fechamento').catch(() => null), secs * 1000);
      }
      return;
    }

    if (interaction.customId.startsWith('member_manage_')) {
      const mode = interaction.customId.replace('member_manage_', '');
      const userId = interaction.fields.getTextInputValue('userId').replace(/[<@!>]/g, '');
      await interaction.channel.permissionOverwrites.edit(userId, {
        ViewChannel: mode === 'add',
        SendMessages: mode === 'add',
        ReadMessageHistory: mode === 'add'
      });
      await interaction.reply({ content: `Usuário ${mode === 'add' ? 'adicionado' : 'removido'} no ticket.`, ephemeral: true });
      return;
    }

    if (interaction.customId === 'rename_modal') {
      const data = readData();
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      const newName = interaction.fields.getTextInputValue('newName').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90);
      await interaction.channel.setName(newName);
      await interaction.reply({ content: `Ticket renomeado para ${newName}.`, ephemeral: true });
      await logAction(interaction.guild, `${interaction.user.tag} renomeou ticket para ${newName}.`);
      return;
    }
  }

  if (interaction.isButton()) {
    const data = readData();

    if (interaction.customId === 'open_ticket') {
      if (!hasRole(interaction.member, data.config.ticketPanel.openerRoleId)) {
        await interaction.reply({ content: 'Você não pode abrir ticket.', ephemeral: true });
        return;
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90),
        type: ChannelType.GuildText,
        parent: data.config.ticketPanel.categoryId || null,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: data.config.ticketPanel.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
      });

      updateData((d) => {
        d.tickets[channel.id] = {
          openerId: interaction.user.id,
          createdAt: Date.now(),
          assumedBy: null,
          paymentConfirmedAt: null,
          deadlineStage: -1,
          status: 'aberto',
          mainMessageId: ''
        };
      });

      const ticketMsg = await channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [userTicketEmbed(interaction.user, readData().tickets[channel.id])],
        components: ticketButtons()
      });

      updateData((d) => {
        if (d.tickets[channel.id]) d.tickets[channel.id].mainMessageId = ticketMsg.id;
      });

      const autoText = AUTO_MESSAGE.replace('ANUNCIOS_CHANNEL_ID', data.config.feedbackChannelId || channel.id);
      await channel.send({ content: autoText });

      const confirm = new EmbedBuilder()
        .setTitle('✅ Ticket aberto com sucesso')
        .setDescription('Seu ticket foi aberto com sucesso. Clique no botão abaixo para acompanhar seu atendimento.')
        .setColor(0x57f287);

      await interaction.reply({
        embeds: [confirm],
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Ver Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guildId}/${channel.id}`)
          )
        ]
      });

      await logAction(interaction.guild, `${interaction.user.tag} abriu o ticket ${channel.name}.`);
      return;
    }

    if (interaction.customId === 'member_panel') {
      await interaction.reply({
        content: 'Painel Membro: escolha uma ação.',
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('member_add').setLabel('Adicionar membro').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('member_remove').setLabel('Remover membro').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('member_notify').setLabel('Notificar staff').setStyle(ButtonStyle.Primary)
          )
        ]
      });
      return;
    }

    if (interaction.customId === 'staff_panel') {
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      await interaction.reply({
        content: 'Painel Staff: escolha uma ação.',
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('staff_add').setLabel('Adicionar usuário').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('staff_remove').setLabel('Remover usuário').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('staff_rename').setLabel('Renomear').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('staff_close').setLabel('Fechar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('staff_delete').setLabel('Deletar').setStyle(ButtonStyle.Danger)
          )
        ]
      });
      return;
    }

    if (interaction.customId === 'pay_confirmed') {
      const meta = data.tickets[interaction.channelId];
      if (!meta) {
        await interaction.reply({ content: 'Este canal não é ticket.', ephemeral: true });
        return;
      }
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }

      const now = Date.now();
      updateData((d) => {
        d.tickets[interaction.channelId].paymentConfirmedAt = now;
        d.tickets[interaction.channelId].deadlineStage = -1;
      });
      await renameDeadlineTicket(interaction.guild, { ...meta, paymentConfirmedAt: now, deadlineStage: -1 }, interaction.channelId);
      await interaction.reply({ content: 'Pagamento confirmado pela staff.' });
      await logAction(interaction.guild, `${interaction.user.tag} confirmou pagamento em ${interaction.channel.name}.`);
      return;
    }

    if (interaction.customId === 'leave_ticket') {
      await interaction.reply({
        content: 'Confirmar saída do ticket?',
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('leave_confirm').setLabel('Confirmar saída').setStyle(ButtonStyle.Danger))]
      });
      return;
    }

    if (interaction.customId === 'leave_confirm') {
      const meta = data.tickets[interaction.channelId];
      if (!meta) return;
      if (interaction.user.id === meta.openerId) {
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: false, SendMessages: false });
        await interaction.reply({ content: 'Você saiu do ticket.', ephemeral: true });
      } else if (isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Staff pode usar fechar ticket no painel.', ephemeral: true });
      }
      return;
    }

    if (interaction.customId === 'member_notify') {
      await interaction.reply({ content: 'Staff foi notificada neste ticket.' });
      if (data.config.ticketPanel.staffRoleId) {
        await interaction.channel.send(`<@&${data.config.ticketPanel.staffRoleId}> notificação solicitada por ${interaction.user}.`);
      }
      return;
    }

    if (['member_add', 'staff_add', 'member_remove', 'staff_remove'].includes(interaction.customId)) {
      const add = interaction.customId.includes('add');
      const modal = new ModalBuilder().setCustomId(`member_manage_${add ? 'add' : 'remove'}`).setTitle(add ? 'Adicionar usuário' : 'Remover usuário');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('userId').setLabel('ID ou menção do usuário').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === 'staff_rename') {
      const modal = new ModalBuilder().setCustomId('rename_modal').setTitle('Renomear ticket');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('newName').setLabel('Novo nome').setStyle(TextInputStyle.Short).setRequired(true)));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === 'staff_delete') {
      await interaction.reply({ content: 'Ticket será deletado em 5 segundos.' });
      setTimeout(() => interaction.channel.delete('Deletado pela staff').catch(() => null), 5000);
      return;
    }

    if (interaction.customId === 'staff_close') {
      const modal = new ModalBuilder().setCustomId('close_ticket_modal').setTitle('Fechar ticket');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('status').setLabel('Status: resolvido/nao resolvido/cancelado/entregue').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('notes').setLabel('Observações rápidas').setStyle(TextInputStyle.Paragraph).setRequired(false))
      );
      await interaction.showModal(modal);
      return;
    }
  }
});

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.login(token);
