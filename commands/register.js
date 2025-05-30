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
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const albionName = interaction.options.getString('albion_name');
    const discordId = interaction.user.id;

    try {
      // Get the guild configuration for the current guild
      const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!config) {
        return interaction.editReply({
          content: '❌ No configuration found. Please ensure the bot is properly set up with the /setup command.',
          ephemeral: true
        });
      }

      // API call to fetch player info
      const playerInfo = await AlbionAPI.getPlayerInfo(albionName);
      if (!playerInfo || playerInfo.Name !== albionName) {
        return interaction.editReply({
          content: `Found a similar name: "${playerInfo?.Name || 'Unknown'}". Please use your exact character name.`,
          ephemeral: true
        });
      }

      // Check if the player is already registered
      const existing = await Player.findOne({ where: { discordId } });
      if (existing) {
        return interaction.editReply({
          content: `You're already registered as ${existing.albionName}`,
          ephemeral: true
        });
      }

      // Fetch the guild data for the player
      const guildData = playerInfo.GuildId ? await AlbionGuild.findOne({ 
        where: { 
          guildId: playerInfo.GuildId,
          discordGuildId: interaction.guild.id 
        }
      }) : null;

      let guildTag = '';
      let newNickname = '';
      let roleAdded = 'None';
      
      if (guildData?.guildTag) {
        guildTag = `[${guildData.guildTag}]`;
        newNickname = `${guildTag} ${playerInfo.Name}`.trim();
      }

      // Check if nickname edit is enabled in the configuration
      if (config.editNick && newNickname) {
        try {
          const member = await interaction.guild.members.fetch(discordId, { force: true });
          if (member) {
            await member.setNickname(newNickname);
          }
        } catch (error) {
          console.error('Error updating nickname:', error);
        }
      }

      // Fetch fresh member data with roles
      const member = await interaction.guild.members.fetch(discordId, { force: true });
      if (!member) {
        return interaction.editReply({ content: 'Member not found in the guild.', ephemeral: true });
      }

      // Role management
      try {
        // Remove allowed role if configured and present
        if (config.allowedRole) {
          const allowedRole = interaction.guild.roles.cache.get(config.allowedRole);
          if (allowedRole && member.roles.cache.has(allowedRole.id)) {
            await member.roles.remove(allowedRole);
          }
        }

        // Add guild role if available
        if (guildData?.guildRole) {
          const guildRole = interaction.guild.roles.cache.get(guildData.guildRole);
          if (guildRole && !member.roles.cache.has(guildRole.id)) {
            await member.roles.add(guildRole);
            roleAdded = `<@&${guildRole.id}>`;
          }
        }
      } catch (roleError) {
        console.error('Role management error:', roleError);
        return interaction.editReply({
          content: '❌ Failed to update roles. Please check bot permissions and role hierarchy.',
          ephemeral: true
        });
      }

      // Calculate total fame
      const totalFame = (playerInfo.KillFame || 0) + (playerInfo.DeathFame || 0);

      // Create a new player entry in the database
      await Player.create({
        discordId,
        albionName: playerInfo.Name,
        albionId: playerInfo.Id,
        guildId: playerInfo.GuildId,
        guildName: playerInfo.GuildName,
        killFame: playerInfo.KillFame || 0,
        deathFame: playerInfo.DeathFame || 0
      });

      // Construct the embed response
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Registration Complete')
        .setDescription(`Successfully registered ${playerInfo.Name}`)
        .addFields(
          { name: 'Albion Online Nickname', value: playerInfo.Name, inline: true },
          { name: 'Albion Online ID', value: playerInfo.Id || 'N/A', inline: true },
          { name: '\u200B', value: '\u200B' }, // Empty field for spacing
          { name: 'Guild', value: playerInfo.GuildName || 'None', inline: true },
          { name: 'Guild ID', value: playerInfo.GuildId || 'None', inline: true },
          { name: '\u200B', value: '\u200B' }, // Empty field for spacing
          { name: 'Role Added', value: roleAdded, inline: true },
          { name: 'New Nickname', value: newNickname || 'Not changed', inline: true },
          { name: '\u200B', value: '\u200B' }, // Empty field for spacing
          { name: 'Kill Fame', value: (playerInfo.KillFame || 0).toLocaleString(), inline: true },
          { name: 'Death Fame', value: (playerInfo.DeathFame || 0).toLocaleString(), inline: true },
          { name: 'Total Fame', value: totalFame.toLocaleString(), inline: true }
        )
        .setThumbnail('https://render.albiononline.com/v1/spell/' + (playerInfo.Avatar || 'T8_2H_NATURESTAFF'))
        .setTimestamp();

      // Send success response
      await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Registration error:', error);

      let errorMessage = 'An error occurred during registration.';
      if (error.message.includes('not found')) {
        errorMessage = `Character "${albionName}" not found. Check spelling and try again.`;
      } else if (error.message.includes('Missing Permissions')) {
        errorMessage = '❌ Bot lacks permissions to manage roles or nicknames.';
      }

      await interaction.editReply({
        content: errorMessage,
        ephemeral: true
      });
    }
  }
};