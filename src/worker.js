import { verifyKey } from 'discord-interactions';

const DISCORD_API = 'https://discord.com/api/v10';

const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
};

const EPHEMERAL = 1 << 6;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8' },
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
  });
}

function optionMap(interaction) {
  return Object.fromEntries(
    (interaction.data?.options || []).map((option) => [option.name, option.value]),
  );
}

function hasAnnouncementPermission(interaction, env) {
  const permissions = BigInt(interaction.member?.permissions || '0');
  const ADMINISTRATOR = 8n;
  const MANAGE_MESSAGES = 8192n;

  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return true;
  if ((permissions & MANAGE_MESSAGES) === MANAGE_MESSAGES) return true;

  const allowedRoles = String(env.ANNOUNCER_ROLE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!allowedRoles.length) return false;

  const memberRoles = interaction.member?.roles || [];
  return allowedRoles.some((roleId) => memberRoles.includes(roleId));
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

function parseColor(value, fallback) {
  const candidate = String(value || fallback || '#111111').trim();
  const normalized = candidate.startsWith('#') ? candidate.slice(1) : candidate;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
}

function safeFilename(name, index) {
  const cleaned = String(name || `image-${index}.png`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-90);

  return `${index}-${cleaned || `image-${index}.png`}`;
}

function commandDefinition() {
  return {
    name: 'announce',
    description: 'Post a Hashwear announcement in a selected channel',
    type: 1,
    options: [
      {
        type: 7,
        name: 'channel',
        description: 'Channel where the announcement will be posted',
        required: true,
        channel_types: [0, 5],
      },
      {
        type: 3,
        name: 'message',
        description: 'Announcement text. Discord markdown and links are supported.',
        required: true,
        max_length: 4000,
      },
      {
        type: 3,
        name: 'title',
        description: 'Optional announcement title',
        max_length: 256,
      },
      {
        type: 11,
        name: 'image1',
        description: 'First image',
      },
      {
        type: 11,
        name: 'image2',
        description: 'Second image',
      },
      {
        type: 11,
        name: 'image3',
        description: 'Third image',
      },
      {
        type: 11,
        name: 'image4',
        description: 'Fourth image',
      },
      {
        type: 3,
        name: 'image_url',
        description: 'Optional public image URL',
        max_length: 1000,
      },
      {
        type: 3,
        name: 'link1_text',
        description: 'Text for the first link button',
        max_length: 80,
      },
      {
        type: 3,
        name: 'link1_url',
        description: 'URL for the first link button',
        max_length: 1000,
      },
      {
        type: 3,
        name: 'link2_text',
        description: 'Text for the second link button',
        max_length: 80,
      },
      {
        type: 3,
        name: 'link2_url',
        description: 'URL for the second link button',
        max_length: 1000,
      },
      {
        type: 8,
        name: 'ping_role',
        description: 'Optional role to ping with the announcement',
      },
      {
        type: 5,
        name: 'ping_everyone',
        description: 'Ping @everyone with this announcement',
      },
      {
        type: 3,
        name: 'color',
        description: 'Embed color in hex, for example #FF5A5F',
        max_length: 7,
      },
      {
        type: 3,
        name: 'footer',
        description: 'Optional footer text',
        max_length: 2048,
      },
      {
        type: 3,
        name: 'thumbnail_url',
        description: 'Optional small thumbnail image URL',
        max_length: 1000,
      },
    ],
  };
}

async function registerCommand(env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_GUILD_ID || !env.DISCORD_BOT_TOKEN) {
    throw new Error(
      'Missing DISCORD_CLIENT_ID, DISCORD_GUILD_ID, or DISCORD_BOT_TOKEN.',
    );
  }

  const response = await fetch(
    `${DISCORD_API}/applications/${env.DISCORD_CLIENT_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([commandDefinition()]),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord command registration failed (HTTP ${response.status}): ${body}`);
  }

  return response.json();
}

async function fetchUploadedImages(interaction, options) {
  const resolved = interaction.data?.resolved?.attachments || {};

  const attachmentIds = ['image1', 'image2', 'image3', 'image4']
    .map((name) => options[name])
    .filter(Boolean);

  const attachments = attachmentIds
    .map((id) => resolved[id])
    .filter(Boolean);

  for (const attachment of attachments) {
    if (
      attachment.content_type &&
      !String(attachment.content_type).startsWith('image/')
    ) {
      throw new Error(`${attachment.filename || 'Uploaded file'} is not an image.`);
    }
  }

  return Promise.all(
    attachments.map(async (attachment, index) => {
      const response = await fetch(attachment.url);

      if (!response.ok) {
        throw new Error(
          `Could not download ${attachment.filename || 'an uploaded image'}.`,
        );
      }

      const blob = await response.blob();
      const filename = safeFilename(attachment.filename, index + 1);

      return {
        blob,
        filename,
        description: attachment.description || undefined,
      };
    }),
  );
}

async function sendChannelMessage(channelId, payload, files, env) {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;

  let response;

  if (files.length) {
    const form = new FormData();

    payload.attachments = files.map((file, index) => ({
      id: index,
      filename: file.filename,
      ...(file.description ? { description: file.description } : {}),
    }));

    form.append('payload_json', JSON.stringify(payload));

    files.forEach((file, index) => {
      form.append(`files[${index}]`, file.blob, file.filename);
    });

    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      },
      body: form,
    });
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord could not post the announcement (HTTP ${response.status}): ${body}`);
  }

  return response.json();
}

async function editInteractionResponse(interaction, content) {
  const url = `${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    console.error(
      'Could not update the private /announce response:',
      response.status,
      await response.text(),
    );
  }
}

async function handleAnnouncement(interaction, env) {
  try {
    const options = optionMap(interaction);
    const channelId = options.channel;
    const message = options.message;
    const title = options.title;
    const imageUrl = options.image_url;
    const thumbnailUrl = options.thumbnail_url;
    const footer = options.footer;
    const pingRole = options.ping_role;
    const pingEveryone = options.ping_everyone === true;

    const link1Text = options.link1_text;
    const link1Url = options.link1_url;
    const link2Text = options.link2_text;
    const link2Url = options.link2_url;

    if (!channelId || !message) {
      throw new Error('Channel and message are required.');
    }

    if (env.DISCORD_GUILD_ID && interaction.guild_id !== env.DISCORD_GUILD_ID) {
      throw new Error('This command can only be used in the configured Hashwear server.');
    }

    const color = parseColor(options.color, env.DEFAULT_EMBED_COLOR);
    if (color === null) {
      throw new Error('Invalid color. Use a 6-digit hex value such as #111111.');
    }

    for (const [label, url] of [
      [link1Text, link1Url],
      [link2Text, link2Url],
    ]) {
      if (label && !url) {
        throw new Error('A button label was provided without its URL.');
      }

      if (url && !isHttpUrl(url)) {
        throw new Error('Button URLs must start with http:// or https://');
      }
    }

    if (imageUrl && !isHttpUrl(imageUrl)) {
      throw new Error('image_url must be a valid http:// or https:// URL.');
    }

    if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) {
      throw new Error('thumbnail_url must be a valid http:// or https:// URL.');
    }

    const files = await fetchUploadedImages(interaction, options);

    const mainEmbed = {
      description: message,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: footer || env.BRAND_NAME || 'Hashwear',
      },
    };

    if (title) mainEmbed.title = title;
    if (thumbnailUrl) mainEmbed.thumbnail = { url: thumbnailUrl };

    if (files[0]) {
      mainEmbed.image = { url: `attachment://${files[0].filename}` };
    } else if (imageUrl) {
      mainEmbed.image = { url: imageUrl };
    }

    const embeds = [mainEmbed];

    for (let i = 1; i < files.length; i += 1) {
      embeds.push({
        color,
        image: { url: `attachment://${files[i].filename}` },
      });
    }

    if (files.length && imageUrl) {
      embeds.push({
        color,
        image: { url: imageUrl },
      });
    }

    const buttons = [];

    if (link1Url) {
      buttons.push({
        type: 2,
        style: 5,
        label: link1Text || 'Open Link',
        url: link1Url,
      });
    }

    if (link2Url) {
      buttons.push({
        type: 2,
        style: 5,
        label: link2Text || 'Open Link',
        url: link2Url,
      });
    }

    const components = buttons.length
      ? [{ type: 1, components: buttons }]
      : [];

    const pingParts = [];
    if (pingEveryone) pingParts.push('@everyone');
    if (pingRole) pingParts.push(`<@&${pingRole}>`);

    const payload = {
      embeds,
      components,
      allowed_mentions: {
        parse: pingEveryone ? ['everyone'] : [],
        roles: pingRole ? [pingRole] : [],
        users: [],
        replied_user: false,
      },
    };

    if (pingParts.length) payload.content = pingParts.join(' ');

    const sentMessage = await sendChannelMessage(channelId, payload, files, env);

    await editInteractionResponse(
      interaction,
      `✅ Announcement posted successfully. https://discord.com/channels/${interaction.guild_id}/${channelId}/${sentMessage.id}`,
    );
  } catch (error) {
    console.error('Announcement error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while posting the announcement.';

    await editInteractionResponse(interaction, `❌ ${message}`);
  }
}

async function handleInteractions(request, env, ctx) {
  if (!env.DISCORD_PUBLIC_KEY) {
    return textResponse('Missing DISCORD_PUBLIC_KEY.', 500);
  }

  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');

  if (!signature || !timestamp) {
    return textResponse('Missing Discord signature headers.', 401);
  }

  const rawBody = await request.arrayBuffer();

  const valid = await verifyKey(
    rawBody,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY,
  );

  if (!valid) {
    return textResponse('Bad request signature.', 401);
  }

  let interaction;

  try {
    interaction = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return textResponse('Invalid JSON.', 400);
  }

  if (interaction.type === InteractionType.PING) {
    return json({ type: InteractionResponseType.PONG });
  }

  if (
    interaction.type === InteractionType.APPLICATION_COMMAND &&
    interaction.data?.name === 'announce'
  ) {
    if (!interaction.guild_id) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'This command can only be used inside the Hashwear Discord server.',
          flags: EPHEMERAL,
        },
      });
    }

    if (!hasAnnouncementPermission(interaction, env)) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'You do not have permission to use the announcement bot.',
          flags: EPHEMERAL,
        },
      });
    }

    ctx.waitUntil(handleAnnouncement(interaction, env));

    return json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: EPHEMERAL,
      },
    });
  }

  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Unsupported interaction.',
      flags: EPHEMERAL,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return textResponse('Hashwear Announcement Bot is running on Cloudflare Workers.');
    }

    if (request.method === 'GET' && url.pathname === '/register') {
      if (!env.REGISTER_SECRET) {
        return textResponse('Command registration endpoint is disabled.', 404);
      }

      if (url.searchParams.get('key') !== env.REGISTER_SECRET) {
        return textResponse('Forbidden.', 403);
      }

      try {
        const commands = await registerCommand(env);
        return json({
          ok: true,
          message: '/announce registered successfully in the configured Discord server.',
          commands,
        });
      } catch (error) {
        console.error('Command registration error:', error);
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500,
        );
      }
    }

    if (request.method === 'POST' && url.pathname === '/interactions') {
      return handleInteractions(request, env, ctx);
    }

    return textResponse('Not found.', 404);
  },
};
