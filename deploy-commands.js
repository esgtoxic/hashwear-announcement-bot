require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
} = require('discord.js');

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
} = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const command = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Post a Hashwear announcement in a selected channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel where the announcement will be posted')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Announcement text. Discord markdown and links are supported.')
      .setMaxLength(4000)
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('title')
      .setDescription('Optional announcement title')
      .setMaxLength(256)
  )
  .addAttachmentOption(option =>
    option.setName('image1').setDescription('First image')
  )
  .addAttachmentOption(option =>
    option.setName('image2').setDescription('Second image')
  )
  .addAttachmentOption(option =>
    option.setName('image3').setDescription('Third image')
  )
  .addAttachmentOption(option =>
    option.setName('image4').setDescription('Fourth image')
  )
  .addStringOption(option =>
    option
      .setName('image_url')
      .setDescription('Optional public image URL')
      .setMaxLength(1000)
  )
  .addStringOption(option =>
    option
      .setName('link1_text')
      .setDescription('Text for the first link button')
      .setMaxLength(80)
  )
  .addStringOption(option =>
    option
      .setName('link1_url')
      .setDescription('URL for the first link button')
      .setMaxLength(1000)
  )
  .addStringOption(option =>
    option
      .setName('link2_text')
      .setDescription('Text for the second link button')
      .setMaxLength(80)
  )
  .addStringOption(option =>
    option
      .setName('link2_url')
      .setDescription('URL for the second link button')
      .setMaxLength(1000)
  )
  .addRoleOption(option =>
    option
      .setName('ping_role')
      .setDescription('Optional role to ping with the announcement')
  )
  .addBooleanOption(option =>
    option
      .setName('ping_everyone')
      .setDescription('Ping @everyone with this announcement')
  )
  .addStringOption(option =>
    option
      .setName('color')
      .setDescription('Embed color in hex, for example #FF5A5F')
      .setMaxLength(7)
  )
  .addStringOption(option =>
    option
      .setName('footer')
      .setDescription('Optional footer text')
      .setMaxLength(2048)
  )
  .addStringOption(option =>
    option
      .setName('thumbnail_url')
      .setDescription('Optional small thumbnail image URL')
      .setMaxLength(1000)
  );

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

(async () => {
  try {
    const body = [command.toJSON()];

    if (DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body }
      );
      console.log(`Registered /announce in guild ${DISCORD_GUILD_ID}.`);
    } else {
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body }
      );
      console.log('Registered /announce globally.');
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
