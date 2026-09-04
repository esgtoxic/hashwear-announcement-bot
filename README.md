# Hashwear Announcement Bot

A Discord slash-command bot for posting branded announcements to any text or announcement channel the bot can access.

## Features

- `/announce`
- Select the destination channel
- Title + long announcement text
- Discord markdown and clickable links inside the message
- Up to 4 uploaded images
- Optional external image URL
- Optional thumbnail
- Up to 2 clickable link buttons
- Custom embed color
- Optional footer
- Optional role ping
- Optional `@everyone` ping
- Permission checks so normal members cannot broadcast
- Private success/error response to the staff member who ran the command

## 1. Requirements

- Node.js 18 or newer
- A Discord application/bot
- Bot token
- Application/Client ID
- Your server/Guild ID for fast command registration while testing

## 2. Install

```bash
npm install
```

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_server_id
ANNOUNCER_ROLE_IDS=role_id_1,role_id_2
BRAND_NAME=Hashwear
DEFAULT_EMBED_COLOR=#111111
```

Do **not** commit `.env` to GitHub.

## 3. Register the slash command

```bash
npm run deploy
```

When `DISCORD_GUILD_ID` is present, `/announce` is registered only in that server and normally becomes available quickly.

If you later remove `DISCORD_GUILD_ID` and run the deploy command again, the command is registered globally.

## 4. Start the bot

```bash
npm start
```

## 5. Bot permissions

When inviting the bot, give it:

- View Channels
- Send Messages
- Embed Links
- Attach Files
- Use Application Commands

Only give **Mention @everyone, @here, and All Roles** if you want the `ping_everyone` option to work.

The bot does not need Administrator.

## 6. Who can announce?

A user can use `/announce` if they have:

- Administrator, or
- Manage Messages, or
- A role whose ID is included in `ANNOUNCER_ROLE_IDS`

## Example

Run `/announce` and choose:

- `channel`: `#announcements`
- `title`: `NEW DROP IS LIVE`
- `message`: `The latest Hashwear drop is live now. [Shop the collection](https://www.hashwear.in/)`
- `image1`: upload the campaign creative
- `link1_text`: `SHOP NOW`
- `link1_url`: `https://www.hashwear.in/`
- `ping_role`: your Updates role
- `color`: `#111111`

The command response is private; only the final announcement appears in the selected channel.

## Deploying on a host

Use:

- Build command: `npm install`
- Start command: `npm start`

Add the same environment variables from `.env` to your hosting platform's Variables/Environment section.

Run `npm run deploy` once from your computer (or your host's shell) whenever you change the slash-command options.

## Discord Developer Portal setup

1. Create/open the Hashwear bot application.
2. Go to **Bot** and copy/reset the bot token.
3. Go to **OAuth2 > URL Generator**.
4. Select scopes:
   - `bot`
   - `applications.commands`
5. Select the bot permissions listed above.
6. Open the generated invite URL and add the bot to your server.

### IDs

Enable Discord Developer Mode under **User Settings > Advanced > Developer Mode**.

Then:
- Server/Guild ID: right-click the server -> **Copy Server ID**
- Role ID: Server Settings -> Roles -> right-click role -> **Copy Role ID**
- Client ID: Discord Developer Portal -> application -> **General Information** -> **Application ID**
