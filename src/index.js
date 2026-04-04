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
  new SlashCommandBuilder().setName('config').setDescription('Abre painel de configurações internas')
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

function hasRole(member, roleId) {
  if (!roleId) return true;
  return member.roles.cache.has(roleId);
}

function isStaff(member, data) {
  return hasRole(member, data.config.ticketPanel.staffRoleId);
}

function ticketButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('member_panel').setLabel('Painel Membro').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_panel').setLabel('Painel Staff').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('leave_ticket').setLabel('Sair do Ticket').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('pay_confirmed').setLabel('Pagamento Confirmado').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('claim_ticket').setLabel('Assumir Ticket').setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function logAction(guild, text) {
  const data = readData();
  const logsId = data.config.ticket.logsChannelId;
  if (!logsId) return;
  const logs = await guild.channels.fetch(logsId).catch(() => null);
  if (!logs || !logs.isTextBased()) return;
  await logs.send({ content: `📝 ${text}` });
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
  if (!ticketMeta) return;
  if (ticketMeta.assumedBy) return;
  if (!isStaff(message.member, data)) return;

  updateData((d) => {
    d.tickets[message.channelId].assumedBy = message.author.id;
  });
  await message.channel.send(`Este ticket foi assumido por: ${message.author}.`);
  await logAction(message.guild, `${message.author.tag} assumiu o ticket ${message.channel.name}.`);
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
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.title)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(data.config.ticketPanel.description)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('category').setLabel('Categoria ID').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.categoryId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staffRole').setLabel('Cargo staff ID').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.staffRoleId || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('openRole').setLabel('Cargo pode abrir ID').setStyle(TextInputStyle.Short).setRequired(true).setValue(data.config.ticketPanel.openerRoleId || ''))
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
      await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pay_confirmed').setLabel('Pagamento Confirmado').setStyle(ButtonStyle.Success))] });
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'setup_ticket_panel') {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const categoryId = interaction.fields.getTextInputValue('category');
      const staffRoleId = interaction.fields.getTextInputValue('staffRole');
      const openerRoleId = interaction.fields.getTextInputValue('openRole');

      updateData((d) => {
        d.config.ticketPanel.title = title;
        d.config.ticketPanel.description = description;
        d.config.ticketPanel.categoryId = categoryId;
        d.config.ticketPanel.staffRoleId = staffRoleId;
        d.config.ticketPanel.openerRoleId = openerRoleId;
      });

      const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(readData().config.ticketPanel.color || '#2b2d31');
      await interaction.reply({ content: 'Painel enviado.', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('➡️ Abrir Ticket').setStyle(ButtonStyle.Primary))] });
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
        const feedbackButton = new ButtonBuilder().setLabel('Avaliar Atendimento').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guildId}/${data.config.feedbackChannelId || interaction.channelId}`);

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
          status: 'aberto'
        };
      });

      const embed = new EmbedBuilder().setTitle('Ticket aberto').setDescription(data.config.ticket.autoMessage).setColor(0x5865f2);
      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: ticketButtons() });
      await interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
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

    if (interaction.customId === 'claim_ticket') {
      const meta = data.tickets[interaction.channelId];
      if (!meta) return;
      if (!isStaff(interaction.member, data)) {
        await interaction.reply({ content: 'Somente staff.', ephemeral: true });
        return;
      }
      updateData((d) => {
        d.tickets[interaction.channelId].assumedBy = interaction.user.id;
      });
      await interaction.reply({ content: `Este ticket foi assumido por: ${interaction.user}.` });
      await logAction(interaction.guild, `${interaction.user.tag} assumiu manualmente ${interaction.channel.name}.`);
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

      updateData((d) => {
        d.tickets[interaction.channelId].paymentConfirmedAt = Date.now();
        d.tickets[interaction.channelId].deadlineStage = -1;
      });
      await renameDeadlineTicket(interaction.guild, { ...meta, paymentConfirmedAt: Date.now(), deadlineStage: -1 }, interaction.channelId);
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

  if (interaction.isModalSubmit() && interaction.customId === 'rename_modal') {
    const data = readData();
    if (!isStaff(interaction.member, data)) {
      await interaction.reply({ content: 'Somente staff.', ephemeral: true });
      return;
    }
    const newName = interaction.fields.getTextInputValue('newName').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90);
    await interaction.channel.setName(newName);
    await interaction.reply({ content: `Ticket renomeado para ${newName}.`, ephemeral: true });
    await logAction(interaction.guild, `${interaction.user.tag} renomeou ticket para ${newName}.`);
  }
});

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.login(token);
