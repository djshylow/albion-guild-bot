const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const AlbionAPI = require('../utils/api');
const { Player, GuildConfig, AlbionGuild } = require('../models');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Albion Online character')
    .addStringOption(option =>
      option.setName('albion_name')
        .setDescription('Your exact Albion Online character name')
        .setRequired(true)
        .setMaxLength(30)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const albionName = interaction.options.getString('albion_name');
    const discordId = interaction.user.id;

    try {
      console.log(`Starting registration for ${albionName} (Discord ID: ${discordId})`);
      
      // Get guild config
      const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!config) {
        return interaction.editReply({
          content: '❌ No configuration found. Please ensure the bot is properly set up with the /setup command.',
        });
      }

      // Get player info from Albion API with enhanced search
      console.log(`Searching players: ${albionName}`);
      const players = await AlbionAPI.searchPlayers(albionName);
      
      // Find exact match (case-insensitive)
      const playerMatch = players.find(p => p.Name.toLowerCase() === albionName.toLowerCase());
      
      if (!playerMatch) {
        const similarPlayers = players
          .slice(0, 5)
          .map(p => `${p.Name}${p.GuildName ? ` [${p.GuildName}]` : ''}`);
        
        return interaction.editReply({
          content: similarPlayers.length > 0
            ? `Found similar names:\n${similarPlayers.join('\n')}\n\nPlease use your exact character name.`
            : `❌ No player found matching "${albionName}"`
        });
      }

      // Get full player details
      const playerInfo = await AlbionAPI.getPlayerById(playerMatch.Id);
      console.log(`Player info retrieved: ${playerInfo.Name} (${playerInfo.Id})`);

      // Enhanced guild verification
      let guildData = null;
      let guildNotice = '';
      let shouldNotifyMods = false;
      let shouldWelcome = false; // <-- Added this declaration

      if (playerInfo.GuildId) {
        console.log(`Checking guild registration: ${playerInfo.GuildName} (${playerInfo.GuildId})`);
        guildData = await AlbionGuild.findOne({
          where: {
            guildId: playerInfo.GuildId,
            discordGuildId: interaction.guild.id
          }
        });

        if (!guildData) {
          shouldNotifyMods = true;
          guildNotice = '\n\n⚠️ Your guild is not registered with this server.';
        } else {
          shouldWelcome = true; // <-- Only welcome if in our registered guild
        }
      } else {
        console.log('Player has no guild affiliation');
        shouldNotifyMods = true;
        guildNotice = '\n\nℹ️ You are not currently in an Albion guild.';
      }

      // Check for existing registrations
      console.log('Checking for existing registrations...');
      const [existingByDiscord, existingByAlbion] = await Promise.all([
        Player.findOne({ where: { discordId } }),
        Player.findOne({ where: { albionId: playerInfo.Id } })
      ]);

      // Handle duplicate registrations
      if (existingByAlbion && existingByAlbion.discordId !== discordId) {
        console.log('Duplicate Albion ID detected');
        return interaction.editReply({
          content: '❌ This Albion character is already registered to another user.',
          ephemeral: true
        });
      }

      if (existingByDiscord && existingByDiscord.albionId !== playerInfo.Id) {
        console.log('User already registered with different character');
        return interaction.editReply({
          content: `❌ You are already registered as ${existingByDiscord.albionName}.`,
          ephemeral: true
        });
      }

      // Handle nickname and roles
      let roleAdded = 'None';
      let newNickname = playerInfo.Name;
      const member = await interaction.guild.members.fetch(discordId).catch(() => null);

      if (!member) {
        return interaction.editReply({ content: '❌ Member not found in this server.' });
      }

      // Update nickname if configured
      if (config.editNick && member) {
        try {
          if (config.showGuildTag && guildData?.guildTag) {
            newNickname = `[${guildData.guildTag}] ${playerInfo.Name}`;
          }
          await member.setNickname(newNickname);
          console.log('Nickname updated');
        } catch (error) {
          console.error('Nickname update error:', error);
        }
      }

      // Handle role assignment
      try {
        console.log('Managing roles...');
        
        // Remove allowed role if configured
        if (config.allowedRole) {
          const allowedRole = interaction.guild.roles.cache.get(config.allowedRole);
          if (allowedRole && member.roles.cache.has(allowedRole.id)) {
            await member.roles.remove(allowedRole);
            console.log('Removed allowed role');
          }
        }

        // Add guild role if available
        if (guildData?.guildRole) {
          const guildRole = interaction.guild.roles.cache.get(guildData.guildRole);
          if (guildRole && !member.roles.cache.has(guildRole.id)) {
            await member.roles.add(guildRole);
            roleAdded = guildRole.name;
            console.log('Added guild role');
          }
        }
      } catch (roleError) {
        console.error('Role management error:', roleError);
      }

      // Send mod alert if needed (unregistered guild)
      if (shouldNotifyMods) {
        console.log('Sending mod notification...');
        const logChannel = interaction.guild.channels.cache.get('1378000555422646342');
        const modRoleId = '1378004212168003694';
        
        if (logChannel) {
          try {
            const guildAlertEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('🚨 Unregistered Guild Registration Attempt')
              .setDescription(`A user tried to register from a guild that is not registered.`)
              .addFields(
                { name: 'User', value: `<@${discordId}> (${interaction.user.tag})`, inline: true },
                { name: 'Albion Name', value: playerInfo.Name, inline: true },
                { name: 'Guild Name', value: playerInfo.GuildName || 'No Guild', inline: true },
                { name: 'Guild ID', value: playerInfo.GuildId || 'N/A', inline: true }
              )
              .setTimestamp();

            await logChannel.send({ 
              content: `<@&${modRoleId}>`,
              embeds: [guildAlertEmbed] 
            });
            console.log('Mod notification sent');
          } catch (error) {
            console.error('Failed to send notification:', error);
          }
        }
      }

      // Send welcome message only if shouldWelcome is true
      if (shouldWelcome) {
        const welcomeChannelId = '1376085914870222919';
        const welcomeChannel = interaction.guild.channels.cache.get(welcomeChannelId);

        if (welcomeChannel) {
          try {
            const adminMentions = [
              '1332768976282849360',
              '270443637865709570',
              '688009786276708415',
              '1290995422067949593'
            ].map(id => `<@${id}>`).join(', ');

            await welcomeChannel.send(`
Welcome to Vicarious, <@${discordId}>!

Please refer to channel <#1380027924173946881>. We recommend you follow the Mist Tutorial.

Please make sure to check channel <#1400474742607319172> as it contains details about alliance.

Any questions? Please type in this channel as our friendly community is there to support you. 
Do you need activity? Ask! We are all working people. Nobody is forced to do content.

Have fun! Enjoy!

Leadership: ${adminMentions}
            `);
            console.log('Welcome message sent');
          } catch (error) {
            console.error('Failed to send welcome message:', error);
          }
        }
      }

      // Save/update player in database
      console.log('Saving player data...');
      const totalFame = (playerInfo.KillFame || 0) + (playerInfo.DeathFame || 0);
      
      await Player.upsert({
        discordId,
        albionId: playerInfo.Id,
        albionName: playerInfo.Name,
        guildId: playerInfo.GuildId,
        guildName: playerInfo.GuildName,
        killFame: playerInfo.KillFame || 0,
        deathFame: playerInfo.DeathFame || 0
      });

      // Success response
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Registration Complete')
        .setDescription(`Successfully registered ${playerInfo.Name}${guildNotice}`)
        .addFields(
          { name: 'Albion Online Nickname', value: playerInfo.Name, inline: true },
          { name: 'Albion Online ID', value: playerInfo.Id || 'N/A', inline: true },
          { name: '\u200B', value: '\u200B' },
          { name: 'Guild', value: playerInfo.GuildName || 'None', inline: true },
          { name: 'Guild ID', value: playerInfo.GuildId || 'None', inline: true },
          { name: '\u200B', value: '\u200B' },
          { name: 'Role Added', value: roleAdded, inline: true },
          { name: 'New Nickname', value: newNickname || 'Not changed', inline: true },
          { name: '\u200B', value: '\u200B' },
          { name: 'Kill Fame', value: (playerInfo.KillFame || 0).toLocaleString(), inline: true },
          { name: 'Death Fame', value: (playerInfo.DeathFame || 0).toLocaleString(), inline: true },
          { name: 'Total Fame', value: totalFame.toLocaleString(), inline: true }
        )
        .setThumbnail('https://render.albiononline.com/v1/spell/' + (playerInfo.Avatar || 'T8_2H_NATURESTAFF'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      console.log('Registration completed successfully');

    } catch (error) {
      console.error('Registration error:', error);
      await interaction.editReply({
        content: '❌ An error occurred during registration. Please try again later.'
      });
    }
  }
};