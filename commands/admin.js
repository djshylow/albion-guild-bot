const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, GuildConfig, AlbionGuild } = require('../models');
const AlbionAPI = require('../utils/api');

const MOD_ROLE_ID = '1378004212168003694'; // Your mod role ID

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin-only manual registration/removal of players')
    .addSubcommand(sub =>
      sub.setName('register')
        .setDescription('Manually register a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Discord user to register')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('albion_name')
            .setDescription('Exact Albion character name')
            .setRequired(true)
            .setMaxLength(30)
        )
    )
    .addSubcommand(sub =>
      sub.setName('unregister')
        .setDescription('Manually unregister a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Discord user to unregister')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);

    // Get Mod role object
    const modRole = guild.roles.cache.get(MOD_ROLE_ID);
    if (!modRole) {
      return interaction.reply({
        content: '⚠️ Mod role not found in the server. Please check configuration.',
        ephemeral: true
      });
    }

    // Check if user's highest role is >= modRole
    if (member.roles.highest.position < modRole.position) {
      return interaction.reply({
        content: '⛔ You must have the Mod role or higher to use this command.',
        ephemeral: true
      });
    }

    const config = await GuildConfig.findOne({ where: { guildId: guild.id } });
    if (!config) {
      return interaction.reply({
        content: '❌ Bot not configured. Run `/setup config` first.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: false });

    // ✅ REGISTER
    if (sub === 'register') {
      const user = interaction.options.getUser('user');
      const albionName = interaction.options.getString('albion_name');

      try {
        const playerInfo = await AlbionAPI.getPlayerInfo(albionName);
        if (!playerInfo || playerInfo.Name !== albionName) {
          return interaction.editReply({ content: `❌ Exact match for "${albionName}" not found.` });
        }

        const existing = await Player.findOne({ where: { discordId: user.id } });
        if (existing) {
          return interaction.editReply({ content: `⚠️ ${user.username} is already registered.` });
        }

        const targetMember = await guild.members.fetch(user.id);
		const guildData = await AlbionGuild.findOne({
		  where: {
			guildId: playerInfo.GuildId || '', // Handle null guild IDs
			discordGuildId: interaction.guild.id
		  }
		});		

		let newNickname = playerInfo.Name;
		let roleAdded = 'None';

		if (config.editNick) {
		  if (config.showGuildTag && guildData?.guildTag) {
			newNickname = `[${guildData.guildTag}] ${playerInfo.Name}`;
		  }

		  await targetMember.setNickname(newNickname).catch(() => {});
		}


        if (config.allowedRole) {
          const allowedRole = guild.roles.cache.get(config.allowedRole);
          if (allowedRole && targetMember.roles.cache.has(allowedRole.id)) {
            await targetMember.roles.remove(allowedRole).catch(() => {});
          }
        }

        if (guildData?.guildRole) {
          const role = guild.roles.cache.get(guildData.guildRole);
          if (role && !targetMember.roles.cache.has(role.id)) {
            await targetMember.roles.add(role).catch(() => {});
            roleAdded = `<@&${role.id}>`;
          }
        }

        const totalFame = (playerInfo.KillFame || 0) + (playerInfo.DeathFame || 0);

        await Player.create({
          discordId: user.id,
          albionId: playerInfo.Id,
          albionName: playerInfo.Name,
          guildId: playerInfo.GuildId,
          guildName: playerInfo.GuildName,
          killFame: playerInfo.KillFame || 0,
          deathFame: playerInfo.DeathFame || 0,
        });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('✅ Admin Registration Complete')
              .setDescription(`Registered **${playerInfo.Name}** for <@${user.id}>`)
              .addFields(
                { name: 'Guild', value: playerInfo.GuildName || 'None', inline: true },
                { name: 'Role Added', value: roleAdded, inline: true },
                { name: 'New Nickname', value: newNickname || 'Not changed', inline: true },
                { name: 'Total Fame', value: totalFame.toLocaleString(), inline: true }
              )
              .setThumbnail('https://render.albiononline.com/v1/spell/' + (playerInfo.Avatar || 'T8_2H_NATURESTAFF'))
              .setTimestamp()
          ]
        });

      } catch (err) {
        console.error('[Admin Register Error]', err);
        return interaction.editReply({ content: '❌ Something went wrong. Check logs.' });
      }
    }

    // ❌ UNREGISTER
    if (sub === 'unregister') {
      const user = interaction.options.getUser('user');

      try {
        const player = await Player.findOne({ where: { discordId: user.id } });
        if (!player) {
          return interaction.editReply({ content: `⚠️ No registration found for <@${user.id}>.` });
        }

        const targetMember = await guild.members.fetch(user.id).catch(() => null);
        const guildData = player.guildId
          ? await AlbionGuild.findOne({
              where: {
                guildId: player.guildId,
                discordGuildId: guild.id
              }
            })
          : null;

        if (targetMember && guildData?.guildRole) {
          const role = guild.roles.cache.get(guildData.guildRole);
          if (role && targetMember.roles.cache.has(role.id)) {
            await targetMember.roles.remove(role).catch(() => {});
          }
        }

        if (targetMember && config.editNick) {
          await targetMember.setNickname(null).catch(() => {});
        }

        await Player.destroy({ where: { discordId: user.id } });

        return interaction.editReply({ content: `✅ <@${user.id}> has been unregistered and cleaned up.` });

      } catch (err) {
        console.error('[Admin Unregister Error]', err);
        return interaction.editReply({ content: '❌ Error removing user. Check logs.' });
      }
    }
  }
};
