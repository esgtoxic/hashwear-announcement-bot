require('dotenv').config();

const http = require('http');
const {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require('discord.js');

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID = '',
  ANNOUNCER_ROLE_IDS = '',
  BRAND_NAME = 'Hashwear',
} = process.env;

const PORT = Number(process.env.PORT || 10000);
const PREFIX = '.announce';

if (!DISCORD_BOT_TOKEN) {
  console.error('Missing required environment variable: DISCORD_BOT_TOKEN.');
  process.exit(1);
}

const announcerRoleIds = ANNOUNCER_ROLE_IDS
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function hasAnnouncementPermission(message) {
  if (
    message.member?.permissions.has(PermissionFlagsBits.Administrator) ||
    message.member?.permissions.has(PermissionFlagsBits.ManageMessages)
  ) {
    return true;
  }

  if (!announcerRoleIds.length) return false;

  return announcerRoleIds.some(roleId => message.member?.roles.cache.has(roleId));
}

async function removeOldSlashCommands() {
  if (!DISCORD_GUILD_ID.trim()) return;

  const guild = client.guilds.cache.get(DISCORD_GUILD_ID.trim());
  if (!guild) {
    console.warn('Configured DISCORD_GUILD_ID is not available in the bot cache.');
    return;
  }

  try {
    await guild.commands.set([]);
    console.log(`Removed old slash commands from guild ${guild.id}.`);
  } catch (error) {
    console.warn('Could not remove old slash commands:', error?.message || error);
  }
}

client.once(Events.ClientReady, readyClient => {
  console.log(`${BRAND_NAME} Announcement Bot online as ${readyClient.user.tag}`);
  console.log('Prefix command enabled: .announce <your text>');
  removeOldSlashCommands();
});

client.on(Events.MessageCreate, async message => {
  if (!message.inGuild() || message.author.bot) return;

  const content = message.content || '';
  const lower = content.toLowerCase();

  if (lower !== PREFIX && !lower.startsWith(PREFIX + ' ')) return;

  if (!hasAnnouncementPermission(message)) {
    const denied = await message.reply('You do not have permission to use .announce.').catch(() => null);
    if (denied) setTimeout(() => denied.delete().catch(() => {}), 5000).unref();
    return;
  }

  const announcement = content.slice(PREFIX.length).trim();

  if (!announcement) {
    const help = await message.reply('Use: `.announce Your announcement text`').catch(() => null);
    if (help) setTimeout(() => help.delete().catch(() => {}), 7000).unref();
    return;
  }

  try {
    const me = message.guild.members.me;
    const permissions = me ? message.channel.permissionsFor(me) : null;

    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.warn(`Missing Send Messages permission in channel ${message.channel.id}.`);
      return;
    }

    // Remove the command message when possible so only the clean announcement remains.
    if (permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.delete().catch(() => {});
    }

    await message.channel.send({
      content: announcement,
      allowedMentions: {
        parse: ['users', 'roles', 'everyone'],
      },
    });

    console.log(`Announcement posted by ${message.author.tag} in channel ${message.channel.id}.`);
  } catch (error) {
    console.error('Announcement error:', error);
    await message.channel
      .send('The announcement could not be posted. Please check the bot permissions.')
      .catch(() => {});
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
    command: '.announce',
    configuredGuildId: DISCORD_GUILD_ID || null,
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

let reconnecting = false;

async function connectDiscord() {
  if (reconnecting || client.isReady()) return;
  reconnecting = true;

  try {
    await client.login(DISCORD_BOT_TOKEN);
    console.log('Discord login request accepted.');
  } catch (error) {
    console.error('Discord login failed:', error);
  } finally {
    reconnecting = false;
  }
}

connectDiscord();

setInterval(async () => {
  if (client.isReady()) return;

  console.warn('Discord is not ready; resetting Gateway connection and retrying.');
  try {
    client.destroy();
  } catch {}

  await connectDiscord();
}, 30000).unref();

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  client.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
