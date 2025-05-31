const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits} = require('discord.js');
const { AlbionGuild } = require('../models');
const { GuildConfig } = require('../models');
const AlbionAPI = require('../utils/api'); // Correct path to api.js

const MAX_TAG_LENGTH = 5; // Set your desired max length here

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Admin-only Manage Albion Online guilds')
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add an Albion Online guild to the database')
        .addStringOption(option =>
          option.setName('guild_id')
            .setDescription('The Albion Online guild ID')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('guild_role')
            .setDescription('The Discord role for this guild')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('guild_tag')
            .setDescription(`The guild tag to use in nicknames (max ${MAX_TAG_LENGTH} chars)`)
            .setRequired(true)
            .setMaxLength(MAX_TAG_LENGTH)
        )
    ),

  async execute(interaction) {
    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
    if (!config) {
      return interaction.reply({
        content: 'Please run `/setup config` first to configure the bot.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    const member = interaction.member;
    const isAdmin = member.roles.cache.has(config.adminRole);
    const isMod = member.roles.cache.has(config.modRole);

    if (!isAdmin && !isMod) {
      return interaction.reply({
        content: '⛔ You must be an admin or mod to use this command.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    const subCommand = interaction.options.getSubcommand();
    
    if (subCommand === 'add') {
      const guildId = interaction.options.getString('guild_id');
      const guildRole = interaction.options.getRole('guild_role');
      const guildTag = interaction.options.getString('guild_tag');

      if (guildTag.length > MAX_TAG_LENGTH) {
        return interaction.reply({
          content: `❌ Guild tag cannot exceed ${MAX_TAG_LENGTH} characters.`,
          flags: 1 << 6
        });
      }

      try {
        // Use AlbionAPI to check if the guild exists
        const guildData = await AlbionAPI.getGuildInfo(guildId); // Fetch guild info
        if (!guildData) {
          return interaction.reply({
            content: '❌ Guild not found. Please check the guild ID and try again.',
            flags: 1 << 6
          });
        }

        const existingGuild = await AlbionGuild.findOne({ where: { guildId } });
        if (existingGuild) {
          return interaction.reply({
            content: '⚠️ This guild is already registered in the database.',
            flags: 1 << 6
          });
        }

        await AlbionGuild.create({
          guildId,
          guildRole: guildRole.id,
          guildTag,
          discordGuildId: interaction.guild.id,
        });

        const embed = new EmbedBuilder()
          .setTitle('✅ Guild Added Successfully')
          .setColor(0x00ff00)
          .addFields(
            { name: 'Guild Name', value: guildData.Name || 'No name provided', inline: true },
            { name: 'Guild ID', value: guildId, inline: true },
            { name: 'Discord Role', value: `<@&${guildRole.id}>`, inline: true },
            { name: 'Guild Tag', value: guildTag, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error adding guild:', error);
        await interaction.reply({
          content: '❌ There was an error adding the guild to the database.',
          flags: 1 << 6
        });
      }
    }
  }
};
