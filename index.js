require('dotenv').config();
const { Client, IntentsBitField, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const sequelize = require('./services/database');
// At the top of index.js

const { verifyRegisteredPlayers } = require('./tasks/verifyPlayers');
const fs = require('fs');
const path = require('path');

// Initialize models through sequelize
const { Player, AlbionGuild, GuildConfig } = require('./models'); // This will import all models

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      
      if (!command.data?.name || !command.execute) {
        console.log(`[WARNING] Command ${file} is missing required properties. Skipping...`);
        continue;
      }
      
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    } catch (error) {
      console.error(`Error loading command ${file}:`, error);
    }
  }
}

async function registerCommands() {
  try {
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('Refreshing application (/) commands...');
    
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    
    console.log(`Successfully reloaded ${commands.length} commands.`);
  } catch (error) {
    console.error('Command registration error:', error);
  }
}

function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    try {
      const event = require(path.join(eventsPath, file));
      
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      console.log(`Loaded event: ${event.name}`);
    } catch (error) {
      console.error(`Error loading event ${file}:`, error);
    }
  }
}

async function startBot() {
  try {
    // Database sync - only sync here to avoid duplicate syncing
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully');

    // Load components
    await loadCommands();
    loadEvents();

    // Register commands
    if (process.env.NODE_ENV !== 'production' || process.env.REGISTER_COMMANDS === 'true') {
      await registerCommands();
    }

    // Login
    await client.login(process.env.DISCORD_TOKEN);

    client.once('ready', () => {
      console.log(`Logged in as ${client.user.tag}`);
      setInterval(() => verifyRegisteredPlayers(client), 24 * 60 * 60 * 1000);
      console.log('Scheduled tasks initialized');
    });

  } catch (error) {
    console.error('Bot startup failed:', error);
    process.exit(1);
  }
}

startBot();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Command error [${interaction.commandName}]:`, error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Error')
      .setDescription('There was an error executing this command!')
      .setFooter({ text: 'Please try again later' });
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});