require('dotenv').config();

const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hashwear Announcement Bot is running.');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);
});

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

const {
  DISCORD_BOT_TOKEN,
  ANNOUNCER_ROLE_IDS = '',
  BRAND_NAME = 'Hashwear',
  DEFAULT_EMBED_COLOR = '#111111',
} = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN in .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const announcerRoleIds = ANNOUNCER_ROLE_IDS
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

function hasAnnouncementPermission(interaction) {
  if (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
  ) {
    return true;
  }

  if (!announcerRoleIds.length) return false;

  const memberRoleIds = interaction.member?.roles?.cache
    ? [...interaction.member.roles.cache.keys()]
    : Array.isArray(interaction.member?.roles)
      ? interaction.member.roles
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
  const candidate = (value || DEFAULT_EMBED_COLOR || '#111111').trim();
  const normalized = candidate.startsWith('#') ? candidate.slice(1) : candidate;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return parseInt(normalized, 16);
}

function safeFilename(name, index) {
  const cleaned = String(name || `image-${index}.png`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-100);

  return cleaned || `image-${index}.png`;
}

client.once(Events.ClientReady, readyClient => {
  console.log(`${BRAND_NAME} Announcement Bot online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'announce') {
    return;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This command can only be used inside a Discord server.',
      ephemeral: true,
    });
    return;
  }

  if (!hasAnnouncementPermission(interaction)) {
    await interaction.reply({
      content: 'You do not have permission to use the announcement bot.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);
    const title = interaction.options.getString('title');
    const imageUrl = interaction.options.getString('image_url');
    const thumbnailUrl = interaction.options.getString('thumbnail_url');
    const footer = interaction.options.getString('footer');
    const colorInput = interaction.options.getString('color');
    const pingRole = interaction.options.getRole('ping_role');
    const pingEveryone = interaction.options.getBoolean('ping_everyone') ?? false;

    const link1Text = interaction.options.getString('link1_text');
    const link1Url = interaction.options.getString('link1_url');
    const link2Text = interaction.options.getString('link2_text');
    const link2Url = interaction.options.getString('link2_url');

    const color = parseColor(colorInput);
    if (color === null) {
      await interaction.editReply('Invalid color. Use a 6-digit hex value such as `#111111`.');
      return;
    }

    for (const [label, url] of [
      [link1Text, link1Url],
      [link2Text, link2Url],
    ]) {
      if (label && !url) {
        await interaction.editReply(`A button label was provided without its URL.`);
        return;
      }
      if (url && !isHttpUrl(url)) {
        await interaction.editReply(`Button URLs must start with http:// or https://`);
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
    const permissions = channel.permissionsFor(me);

    const required = [
      [PermissionFlagsBits.ViewChannel, 'View Channel'],
      [PermissionFlagsBits.SendMessages, 'Send Messages'],
      [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
    ];

    if (attachments.length) {
      required.push([PermissionFlagsBits.AttachFiles, 'Attach Files']);
    }

    if (pingEveryone) {
      required.push([PermissionFlagsBits.MentionEveryone, 'Mention @everyone']);
    }

    const missingPermissions = required
      .filter(([permission]) => !permissions?.has(permission))
      .map(([, label]) => label);

    if (missingPermissions.length) {
      await interaction.editReply(
        `I am missing these permissions in ${channel}: ${missingPermissions.join(', ')}.`
      );
      return;
    }

    const files = attachments.map((attachment, index) => {
      const name = safeFilename(attachment.name, index + 1);
      return {
        attachment: attachment.url,
        name,
      };
    });

    const embeds = [];

    const mainEmbed = new EmbedBuilder()
      .setColor(color)
      .setDescription(message)
      .setTimestamp();

    if (title) mainEmbed.setTitle(title);
    if (footer) mainEmbed.setFooter({ text: footer });
    else mainEmbed.setFooter({ text: BRAND_NAME });

    if (thumbnailUrl) mainEmbed.setThumbnail(thumbnailUrl);

    if (files[0]) {
      mainEmbed.setImage(`attachment://${files[0].name}`);
    } else if (imageUrl) {
      mainEmbed.setImage(imageUrl);
    }

    embeds.push(mainEmbed);

    // Uploaded images 2-4 become image-only embeds so all images display cleanly.
    for (let i = 1; i < files.length; i++) {
      embeds.push(
        new EmbedBuilder()
          .setColor(color)
          .setImage(`attachment://${files[i].name}`)
      );
    }

    // If there are uploaded images and an external image URL, show the URL image too.
    if (files.length && imageUrl) {
      embeds.push(
        new EmbedBuilder()
          .setColor(color)
          .setImage(imageUrl)
      );
    }

    const buttons = [];
    if (link1Url) {
      buttons.push(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(link1Text || 'Open Link')
          .setURL(link1Url)
      );
    }
    if (link2Url) {
      buttons.push(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(link2Text || 'Open Link')
          .setURL(link2Url)
      );
    }

    const components = buttons.length
      ? [new ActionRowBuilder().addComponents(buttons)]
      : [];

    const pingParts = [];
    if (pingEveryone) pingParts.push('@everyone');
    if (pingRole) pingParts.push(`<@&${pingRole.id}>`);

    const sent = await channel.send({
      content: pingParts.join(' ') || undefined,
      embeds,
      files,
      components,
      allowedMentions: {
        parse: pingEveryone ? ['everyone'] : [],
        roles: pingRole ? [pingRole.id] : [],
      },
    });

    await interaction.editReply(
      `Announcement posted successfully in ${channel}. [Open message](${sent.url})`
    );
  } catch (error) {
    console.error('Announcement error:', error);

    const message =
      error?.code === 50013
        ? 'Discord denied a required permission. Check the bot role and channel permissions.'
        : 'Something went wrong while posting the announcement. Check the bot logs for details.';

    await interaction.editReply(message).catch(() => {});
  }
});

client.on('error', error => {
  console.error('DISCORD CLIENT ERROR:', error);
});

client.on('shardError', error => {
  console.error('DISCORD SHARD ERROR:', error);
});

process.on('unhandledRejection', error => {
  console.error('UNHANDLED REJECTION:', error);
});

async function startDiscord() {
  console.log('Discord configuration check:');
  console.log('- Token present:', Boolean(DISCORD_BOT_TOKEN));
  console.log('- Token length:', DISCORD_BOT_TOKEN?.length || 0);
  console.log('- Client ID present:', Boolean(process.env.DISCORD_CLIENT_ID));
  console.log('- Guild ID present:', Boolean(process.env.DISCORD_GUILD_ID));
  console.log('Checking Discord bot token with Discord API...');

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`Discord REST preflight returned HTTP ${response.status}. Continuing to Gateway login anyway.`);
      console.warn(body.slice(0, 500));
    } else {
      const botUser = await response.json();
      console.log(`Discord token valid for bot: ${botUser.username} (${botUser.id})`);
    }
  } catch (error) {
    console.warn('Discord REST preflight failed. Continuing to Gateway login anyway:', error);
  }

  console.log('Attempting to connect to Discord Gateway...');

  try {
    await client.login(DISCORD_BOT_TOKEN);
    console.log('Discord login request accepted.');
  } catch (error) {
    console.error('DISCORD LOGIN FAILED:');
    console.error(error);
  }
}

startDiscord();
