const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the guild registration bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Makes command admin-only in UI
    .addSubcommand(subcommand => 
      subcommand
        .setName('config')
        .setDescription('Configure the bot settings')
        .addRoleOption(option => 
          option.setName('admin_role')
            .setDescription('Select the admin role')
            .setRequired(true)
        )
        .addRoleOption(option => 
          option.setName('mod_role')
            .setDescription('Select the mod role')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('purge_users_on_leave')
            .setDescription('Purge users when they leave?')
            .setRequired(true)
            .addChoices(
              { name: 'Yes', value: 'yes' },
              { name: 'No', value: 'no' }
            )
        )
        .addStringOption(option =>
          option.setName('edit_nick')
            .setDescription('Edit user nicknames?')
            .setRequired(true)
            .addChoices(
              { name: 'Yes', value: 'yes' },
              { name: 'No', value: 'no' }
            )
        )
        .addStringOption(option =>
          option.setName('guild_tag_visibility')
            .setDescription('Should the guild tag be visible during registration?')
            .setRequired(true)
            .addChoices(
              { name: 'Yes', value: 'yes' },
              { name: 'No', value: 'no' }
            )
        )
        .addRoleOption(option => 
          option.setName('allowed_role')
            .setDescription('Select the allowed role (optional)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    // First check Discord administrator permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ You must have **Administrator** permissions to use this command.',
        flags: 1 << 6
      });
    }

    const subCommand = interaction.options.getSubcommand();
    if (subCommand === 'config') {
      const adminRole = interaction.options.getRole('admin_role');
      const modRole = interaction.options.getRole('mod_role');
      const allowedRole = interaction.options.getRole('allowed_role');
      const purgeUsersOnLeave = interaction.options.getString('purge_users_on_leave') === 'yes';
      const editNick = interaction.options.getString('edit_nick') === 'yes';
      const guildTagVisibility = interaction.options.getString('guild_tag_visibility') === 'yes';

      try {
        const [config] = await GuildConfig.upsert({
          guildId: interaction.guild.id,
          adminRole: adminRole.id,
          modRole: modRole.id,
          allowedRole: allowedRole?.id || null,
          purgeUsersOnLeave,
          editNick,
          showGuildTag: guildTagVisibility,
        });

        const embed = new EmbedBuilder()
          .setTitle('⚙️ Bot Configuration Updated')
          .setColor(0x00ff00)
          .addFields(
            { name: 'Admin Role', value: `<@&${adminRole.id}>`, inline: true },
            { name: 'Mod Role', value: `<@&${modRole.id}>`, inline: true },
            { name: 'Allowed Role', value: allowedRole ? `<@&${allowedRole.id}>` : 'None', inline: true },
            { name: 'Purge Users on Leave', value: purgeUsersOnLeave ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Edit Nicknames', value: editNick ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Guild Tag Visible', value: guildTagVisibility ? '✅ Yes' : '❌ No', inline: true }
          )
          .setFooter({ text: 'You can update these settings anytime by running /setup config again' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error saving guild config:', error);
        await interaction.reply({
          content: '❌ There was an error saving the configuration. Please check the inputs and try again.',
          flags: 1 << 6
        });
      }
    }
  }
};
