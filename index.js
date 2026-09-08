require('dotenv').config();

const http = require('http');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID = '',
  ANNOUNCER_ROLE_IDS = '',
  BRAND_NAME = 'Hashwear',
  DEFAULT_EMBED_COLOR = '#111111',
} = process.env;

const PORT = Number(process.env.PORT || 10000);

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Missing required environment variables: DISCORD_BOT_TOKEN and/or DISCORD_CLIENT_ID.');
  process.exit(1);
}

const announcerRoleIds = ANNOUNCER_ROLE_IDS
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const announceCommand = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Post an announcement in a selected channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Text channel, announcement channel, or thread to post in')
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
      )
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Announcement text; Discord markdown is supported')
      .setMaxLength(4000)
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('title')
      .setDescription('Optional title')
      .setMaxLength(256)
  )
  .addAttachmentOption(option => option.setName('image1').setDescription('First image'))
  .addAttachmentOption(option => option.setName('image2').setDescription('Second image'))
  .addAttachmentOption(option => option.setName('image3').setDescription('Third image'))
  .addAttachmentOption(option => option.setName('image4').setDescription('Fourth image'))
  .addStringOption(option =>
    option
      .setName('image_url')
      .setDescription('Optional public image URL')
      .setMaxLength(1000)
  )
  .addStringOption(option =>
    option
      .setName('thumbnail_url')
      .setDescription('Optional small thumbnail URL')
      .setMaxLength(1000)
  )
  .addStringOption(option =>
    option
      .setName('link1_text')
      .setDescription('First button label')
      .setMaxLength(80)
  )
  .addStringOption(option =>
    option
      .setName('link1_url')
      .setDescription('First button URL')
      .setMaxLength(1000)
  )
  .addStringOption(option =>
    option
      .setName('link2_text')
      .setDescription('Second button label')
      .setMaxLength(80)
  )
  .addStringOption(option =>
    option
      .setName('link2_url')
      .setDescription('Second button URL')
      .setMaxLength(1000)
  )
  .addRoleOption(option =>
    option
      .setName('ping_role')
      .setDescription('Optional role to ping')
  )
  .addBooleanOption(option =>
    option
      .setName('ping_everyone')
      .setDescription('Ping @everyone')
  )
  .addStringOption(option =>
    option
      .setName('color')
      .setDescription('Embed hex color, e.g. #111111')
      .setMaxLength(7)
  )
  .addStringOption(option =>
    option
      .setName('footer')
      .setDescription('Optional footer')
      .setMaxLength(2048)
  );

function hasAnnouncementPermission(interaction) {
  if (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
  ) {
    return true;
  }

  if (!announcerRoleIds.length) return false;

  const roles = interaction.member?.roles;
  const memberRoleIds = roles?.cache
    ? [...roles.cache.keys()]
    : Array.isArray(roles)
      ? roles
      : [];

  return announcerRoleIds.some(roleId => memberRoleIds.includes(roleId));
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseColor(value) {
  const candidate = String(value || DEFAULT_EMBED_COLOR || '#111111').trim();
  const normalized = candidate.startsWith('#') ? candidate.slice(1) : candidate;
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : null;
}

function safeFilename(name, index) {
  const cleaned = String(name || `image-${index}.png`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-100);
  return cleaned || `image-${index}.png`;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  const body = [announceCommand.toJSON()];

  if (DISCORD_GUILD_ID.trim()) {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID.trim()),
      { body },
    );
    console.log(`Registered /announce in guild ${DISCORD_GUILD_ID.trim()}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body });
  console.log('Registered /announce globally. Global command updates can take longer to appear.');
}

async function replyEphemeral(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content });
  } else {
    await interaction.reply({ content, ephemeral: true });
  }
}

client.once(Events.ClientReady, readyClient => {
  console.log(`${BRAND_NAME} Announcement Bot online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'announce') return;

  if (!interaction.inGuild()) {
    await replyEphemeral(interaction, 'This command can only be used inside a Discord server.');
    return;
  }

  if (!hasAnnouncementPermission(interaction)) {
    await replyEphemeral(
      interaction,
      'You do not have permission to use /announce. You need Administrator, Manage Messages, or an allowed announcer role.',
    );
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);
    const title = interaction.options.getString('title');
    const imageUrl = interaction.options.getString('image_url');
    const thumbnailUrl = interaction.options.getString('thumbnail_url');
    const link1Text = interaction.options.getString('link1_text');
    const link1Url = interaction.options.getString('link1_url');
    const link2Text = interaction.options.getString('link2_text');
    const link2Url = interaction.options.getString('link2_url');
    const pingRole = interaction.options.getRole('ping_role');
    const pingEveryone = interaction.options.getBoolean('ping_everyone') ?? false;
    const footer = interaction.options.getString('footer');
    const color = parseColor(interaction.options.getString('color'));

    if (color === null) {
      await interaction.editReply('Invalid color. Use a 6-digit hex value such as `#111111`.');
      return;
    }

    if (!channel.isTextBased() || typeof channel.send !== 'function') {
      await interaction.editReply('That channel cannot receive bot messages.');
      return;
    }

    for (const [label, url, number] of [
      [link1Text, link1Url, 1],
      [link2Text, link2Url, 2],
    ]) {
      if (label && !url) {
        await interaction.editReply(`Button ${number} has a label but no URL.`);
        return;
      }
      if (url && !isHttpUrl(url)) {
        await interaction.editReply(`Button ${number} URL must start with http:// or https://.`);
        return;
      }
    }

    if (imageUrl && !isHttpUrl(imageUrl)) {
      await interaction.editReply('`image_url` must be a valid http:// or https:// URL.');
      return;
    }

    if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) {
      await interaction.editReply('`thumbnail_url` must be a valid http:// or https:// URL.');
      return;
    }

    const attachments = ['image1', 'image2', 'image3', 'image4']
      .map(name => interaction.options.getAttachment(name))
      .filter(Boolean);

    for (const attachment of attachments) {
      if (attachment.contentType && !attachment.contentType.startsWith('image/')) {
        await interaction.editReply(`\`${attachment.name}\` is not an image.`);
        return;
      }
    }

    const me = interaction.guild.members.me;
    if (!me) {
      await interaction.editReply('I could not read my server membership. Try again in a moment.');
      return;
    }

    const permissions = channel.permissionsFor(me);
    const required = [
      [PermissionFlagsBits.ViewChannel, 'View Channel'],
      [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
    ];

    if (channel.isThread()) {
      required.push([PermissionFlagsBits.SendMessagesInThreads, 'Send Messages in Threads']);
    } else {
      required.push([PermissionFlagsBits.SendMessages, 'Send Messages']);
    }

    if (attachments.length) required.push([PermissionFlagsBits.AttachFiles, 'Attach Files']);
    if (pingEveryone || (pingRole && !pingRole.mentionable)) {
      required.push([PermissionFlagsBits.MentionEveryone, 'Mention @everyone, @here, and All Roles']);
    }

    const missing = required
      .filter(([permission]) => !permissions?.has(permission))
      .map(([, label]) => label);

    if (missing.length) {
      await interaction.editReply(`I am missing these permissions in ${channel}: ${missing.join(', ')}.`);
      return;
    }

    const files = attachments.map((attachment, index) => ({
      attachment: attachment.url,
      name: safeFilename(attachment.name, index + 1),
    }));

    const mainEmbed = new EmbedBuilder()
      .setColor(color)
      .setDescription(message)
      .setTimestamp()
      .setFooter({ text: footer || BRAND_NAME });

    if (title) mainEmbed.setTitle(title);
    if (thumbnailUrl) mainEmbed.setThumbnail(thumbnailUrl);

    if (files[0]) {
      mainEmbed.setImage(`attachment://${files[0].name}`);
    } else if (imageUrl) {
      mainEmbed.setImage(imageUrl);
    }

    const embeds = [mainEmbed];

    for (let i = 1; i < files.length; i += 1) {
      embeds.push(new EmbedBuilder().setColor(color).setImage(`attachment://${files[i].name}`));
    }

    if (files.length && imageUrl) {
      embeds.push(new EmbedBuilder().setColor(color).setImage(imageUrl));
    }

    const buttons = [];
    if (link1Url) {
      buttons.push(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(link1Text || 'Open Link')
          .setURL(link1Url),
      );
    }
    if (link2Url) {
      buttons.push(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(link2Text || 'Open Link')
          .setURL(link2Url),
      );
    }

    const pingParts = [];
    if (pingEveryone) pingParts.push('@everyone');
    if (pingRole) pingParts.push(`<@&${pingRole.id}>`);

    const sent = await channel.send({
      content: pingParts.join(' ') || undefined,
      embeds,
      files,
      components: buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : [],
      allowedMentions: {
        parse: pingEveryone ? ['everyone'] : [],
        roles: pingRole ? [pingRole.id] : [],
      },
    });

    await interaction.editReply(`Announcement posted in ${channel}. [Open message](${sent.url})`);
  } catch (error) {
    console.error('Announcement error:', error);

    const userMessage = error?.code === 50013
      ? 'Discord denied a required permission. Check the bot role and target-channel permissions.'
      : 'The announcement could not be posted. Check the Render logs for the detailed error.';

    await interaction.editReply(userMessage).catch(() => {});
  }
});

client.on('error', error => console.error('Discord client error:', error));
client.on('shardError', error => console.error('Discord shard error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

const server = http.createServer((req, res) => {
  const payload = JSON.stringify({
    ok: true,
    service: 'hashwear-announcement-bot',
    discordReady: client.isReady(),
    bot: client.user?.tag || null,
  });

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Health server listening on 0.0.0.0:${PORT}`);
});

function start() {
  client.login(DISCORD_BOT_TOKEN)
    .then(() => console.log('Discord login request accepted.'))
    .catch(error => console.error('Discord login failed:', error));

  registerCommands()
    .catch(error => console.warn(
      'Slash command registration failed; Discord login will continue:',
      error?.message || error,
    ));

  setTimeout(() => {
    if (!client.isReady()) {
      console.warn(
        'Discord Gateway is still not ready after 30 seconds. Render may be rate-limited or blocked by Discord.',
      );
    }
  }, 30000).unref();
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  client.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

start();
