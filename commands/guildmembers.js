const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ComponentType,
  PermissionFlagsBits
} = require('discord.js');
const AlbionAPI = require('../utils/api');
const { AlbionGuild, GuildConfig } = require('../models');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guildmembers')
    .setDescription('View members of a registered Albion Online guild')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
    if (!config) {
      return interaction.reply({
        content: 'Please run `/setup config` first to configure the bot.',
        ephemeral: true
      });
    }

    const member = interaction.member;
    const isAdmin = member.roles.cache.has(config.adminRole);
    const isMod = member.roles.cache.has(config.modRole);

    if (!isAdmin && !isMod) {
      return interaction.reply({
        content: '⛔ You must be an admin or mod to use this command.',
        ephemeral: true
      });
    }

    const guilds = await AlbionGuild.findAll({
      where: { discordGuildId: interaction.guild.id }
    });

    if (!guilds.length) {
      return interaction.reply({
        content: '❌ No guilds are registered for this server. Use `/guild add` first.',
        ephemeral: true
      });
    }

    if (guilds.length === 1) {
      return showGuildMembers(interaction, guilds[0]);
    }

    // Multiple guilds — show dropdown
    const options = guilds.map(g => ({
      label: g.guildTag || 'Unnamed Guild',
      description: `Guild ID: ${g.guildId}`,
      value: g.guildId
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_guild')
      .setPlaceholder('Select a guild to view members')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'Please select a guild:',
      components: [row],
      ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 15000,
      max: 1
    });

    collector.on('collect', async selectInteraction => {
      const selectedGuildId = selectInteraction.values[0];
      const selectedGuild = guilds.find(g => g.guildId === selectedGuildId);
      if (!selectedGuild) {
        return selectInteraction.reply({
          content: '❌ Guild not found.',
          ephemeral: true
        });
      }

      await showGuildMembers(selectInteraction, selectedGuild);
    });

    collector.on('end', collected => {
      if (!collected.size) {
        interaction.editReply({
          content: '⏰ No selection made. Try again.',
          components: []
        });
      }
    });
  }
};

async function showGuildMembers(interaction, guild) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const members = await AlbionAPI.getGuildMembers(guild.guildId);

    if (!members.length) {
      return interaction.editReply(`❌ No members found for guild \`${guild.guildTag}\`.`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle(`Members of ${guild.guildTag} (${members.length})`)
      .setDescription(members.slice(0, 20).map(m => `• ${m.Name}`).join('\n'))
      .setFooter({ text: 'Showing first 20 members' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching members:', error);
    await interaction.editReply('❌ Failed to fetch members from Albion API.');
  }
}
