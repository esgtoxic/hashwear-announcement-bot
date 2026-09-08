# Hashwear Announcement Bot

Discord announcement bot built with Node.js + discord.js and deployed as a free Render Web Service using a Render Blueprint (`render.yaml`).

## Features

- `/announce` slash command
- Post in any selectable text channel, announcement channel, public thread, private thread, or announcement thread the bot can access
- Title + formatted message
- Up to 4 uploaded images
- Optional external image URL and thumbnail
- Up to 2 clickable link buttons
- Optional role ping and `@everyone`
- Custom embed color and footer
- Staff access via Administrator, Manage Messages, or configured announcer role IDs
- Private success/error response to the staff member
- Automatic slash-command registration on startup
- `/health` endpoint for Render

## Discord bot permissions

Give the bot these permissions in channels where it should announce:

- View Channel
- Send Messages
- Send Messages in Threads (for threads)
- Embed Links
- Attach Files
- Mention @everyone, @here, and All Roles only if you want role/@everyone pings

The invite should include both `bot` and `applications.commands` scopes.

## Render Blueprint deployment

1. Open Render Dashboard.
2. Choose **New > Blueprint**.
3. Connect `esgtoxic/hashwear-announcement-bot`.
4. Render reads `render.yaml` from the repository root.
5. Enter the secret environment values when prompted:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
   - `ANNOUNCER_ROLE_IDS` (optional; can be blank)
6. Apply the Blueprint.

The service uses the Free plan and starts with `npm start`.

## Command example

Use `/announce` and choose:

- `channel`: `#announcements`
- `title`: `NEW DROP IS LIVE`
- `message`: `The latest Hashwear collection is now live.`
- `image1`: upload a banner
- `link1_text`: `SHOP NOW`
- `link1_url`: `https://www.hashwear.in/`
- `ping_role`: a server role
- `color`: `#111111`

Only `channel` and `message` are required.

## Free Render note

Render's Free web services can spin down after a period with no qualifying inbound traffic, so the free tier is best treated as hobby/testing hosting rather than guaranteed 24/7 production hosting.
