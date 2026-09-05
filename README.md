# Hashwear Announcement Bot — Cloudflare Workers

This version uses Discord HTTP Interactions instead of a permanent Discord Gateway connection.

## What stays the same

- The **Hashwear Announcements** app/bot remains installed in the Discord server.
- Use `/announce` directly inside Discord.
- Choose any text or announcement channel.
- Title + formatted message.
- Up to 4 uploaded images.
- Optional external image URL and thumbnail.
- Up to 2 clickable link buttons.
- Optional role ping and @everyone.
- Custom embed color and footer.
- Staff permission checks using Administrator, Manage Messages, or `ANNOUNCER_ROLE_IDS`.

The app does **not** need to maintain a 24/7 Discord Gateway connection.

## Cloudflare secrets / variables

Set these in Cloudflare Workers > Settings > Variables and Secrets:

### Secrets

- `DISCORD_BOT_TOKEN` — Discord Developer Portal > Bot > Token
- `DISCORD_PUBLIC_KEY` — Discord Developer Portal > General Information > Public Key
- `REGISTER_SECRET` — choose your own temporary random password for the registration URL

### Variables / secrets

- `DISCORD_CLIENT_ID` — Discord Application ID
- `DISCORD_GUILD_ID` — Hashwear server ID
- `ANNOUNCER_ROLE_IDS` — comma-separated IDs of roles allowed to use `/announce`

The Wrangler file already provides:

- `BRAND_NAME=Hashwear`
- `DEFAULT_EMBED_COLOR=#111111`

## Deployment

Deploy this repository as a Cloudflare Worker using the GitHub integration or Wrangler.

After deployment Cloudflare gives you a URL similar to:

`https://hashwear-announcement-bot.<your-subdomain>.workers.dev`

## Discord Interactions Endpoint URL

In Discord Developer Portal:

1. Open **Hashwear Announcements**.
2. Go to **General Information**.
3. Find **Interactions Endpoint URL**.
4. Enter:

`https://YOUR-WORKER.workers.dev/interactions`

5. Save.

Discord will PING the Worker. The Worker verifies the Ed25519 signature and returns PONG automatically.

## Register /announce

After the Worker secrets have been added, visit:

`https://YOUR-WORKER.workers.dev/register?key=YOUR_REGISTER_SECRET`

You should receive:

`"/announce registered successfully in the configured Discord server."`

After registration, you can delete the `REGISTER_SECRET` variable from Cloudflare to disable the registration endpoint.

## Test

In the Hashwear Discord server type:

`/announce`

Required fields:

- channel
- message

All other fields are optional.

Example:

- channel: #announcements
- title: NEW DROP IS LIVE
- message: The latest Hashwear collection is now live.
- image1: upload banner
- link1_text: SHOP NOW
- link1_url: https://www.hashwear.in/
- ping_role: @Drops
- color: #111111

The command response is private to the staff member running it. The actual announcement is posted by the Hashwear bot in the selected channel.
