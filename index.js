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
  HEARTBEAT_URL = 'https://hashwear-announcement-bot.onrender.com/health',
} = process.env;

const PORT = Number(process.env.PORT || 10000);
const PREFIX = '.announce';
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;
const DISCORD_STARTUP_TIMEOUT_MS = 90 * 1000;

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
  ws: {
    shardCount: 1,
    shardIds: [0],
    fetchGatewayInformation: async () => ({
      url: 'wss://gateway.discord.gg/',
      shards: 1,
      session_start_limit: {
        total: 1000,
        remaining: 1,
        reset_after: 5000,
        max_concurrency: 1,
      },
    }),
  },
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
    heartbeat: true,
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

async function sendHeartbeat() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(HEARTBEAT_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Hashwear-Announcement-Bot-Heartbeat/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`Heartbeat OK: ${response.status}`);
  } catch (error) {
    console.warn('Heartbeat failed:', error?.message || error);
  } finally {
    clearTimeout(timeout);
  }
}

const firstHeartbeat = setTimeout(sendHeartbeat, 5000);
firstHeartbeat.unref();

const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
heartbeatTimer.unref();

console.log(`Free heartbeat enabled every ${HEARTBEAT_INTERVAL_MS / 60000} minutes.`);

function probeDiscordGateway() {
  if (typeof WebSocket !== 'function') {
    console.warn('Discord Gateway probe skipped: WebSocket is unavailable in this Node runtime.');
    return;
  }

  const socket = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
  const timeout = setTimeout(() => {
    console.warn('Discord Gateway probe timed out before receiving HELLO.');
    try { socket.close(); } catch {}
  }, 20000);
  timeout.unref();

  socket.addEventListener('open', () => {
    console.log('Discord Gateway probe WebSocket opened.');
  });

  socket.addEventListener('message', () => {
    clearTimeout(timeout);
    console.log('Discord Gateway probe received HELLO successfully.');
    try { socket.close(1000, 'probe complete'); } catch {}
  }, { once: true });

  socket.addEventListener('error', event => {
    clearTimeout(timeout);
    console.warn('Discord Gateway probe error:', event?.message || 'WebSocket connection error');
  });

  socket.addEventListener('close', event => {
    clearTimeout(timeout);
    console.log(`Discord Gateway probe closed with code ${event.code}.`);
  });
}

probeDiscordGateway();

const discordStartupWatchdog = setTimeout(() => {
  if (!client.isReady()) {
    console.error('Discord Gateway did not become ready within 90 seconds; restarting process.');
    process.exit(1);
  }
}, DISCORD_STARTUP_TIMEOUT_MS);
discordStartupWatchdog.unref();

client.login(DISCORD_BOT_TOKEN)
  .then(() => console.log('Discord login request accepted.'))
  .catch(error => {
    console.error('Discord login failed:', error);
    setTimeout(() => process.exit(1), 5000).unref();
  });

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  client.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
