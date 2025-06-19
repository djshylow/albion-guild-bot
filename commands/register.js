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
      // Get guild config
      const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!config) {
        return interaction.editReply({
          content: '❌ No configuration found. Please ensure the bot is properly set up with the /setup command.',
        });
      }

      // Get player info from Albion API
      const playerInfo = await AlbionAPI.getPlayerInfo(albionName);
      if (!playerInfo || playerInfo.Name !== albionName) {
        return interaction.editReply({
          content: `Found a similar name: "${playerInfo?.Name || 'Unknown'}". Please use your exact character name.`,
        });
      }

      // Check if player is already registered
		const guildData = await AlbionGuild.findOne({
		  where: {
			guildId: playerInfo.GuildId || '', // Handle null guild IDs
			discordGuildId: interaction.guild.id
		  }
		});

      // Fetch the guild record from the database
      const guildInfo = playerInfo.GuildId ? await AlbionGuild.findOne({
        where: {
          guildId: playerInfo.GuildId,
          discordGuildId: interaction.guild.id
        }
      }) : null;

      // 🔔 Send alert if guild is not registered
      if (!guildData) {
        const logChannel = interaction.guild.channels.cache.get('1378000555422646342');
        const modRoleId = '1378004212168003694';
        if (logChannel) {
          const alertEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🚨 Unregistered Guild Registration Attempt')
            .setDescription(`A user tried to register from a guild that is not registered.`)
            .addFields(
              { name: 'User', value: `<@${discordId}> (${interaction.user.tag})`, inline: true },
              { name: 'Albion Name', value: playerInfo.Name, inline: true },
              { name: 'Guild Name', value: playerInfo.GuildName || 'Unknown', inline: true },
              { name: 'Guild ID', value: playerInfo.GuildId || 'N/A', inline: true }
            )
            .setTimestamp();
          logChannel.send({ embeds: [alertEmbed] });
          await logChannel.send(`<@&${modRoleId}>`);
        }
      }

      let roleAdded = 'None';
      let newNickname = playerInfo.Name;
      let member;

      try {
        member = await interaction.guild.members.fetch(discordId, { force: true });

        if (config.editNick) {
          if (config.showGuildTag && guildData?.guildTag) {
            newNickname = `[${guildData.guildTag}] ${playerInfo.Name}`;
          }
          await member.setNickname(newNickname).catch(() => {});
        }
      } catch (error) {
        console.error('Error fetching or setting nickname:', error);
      }

      if (!member) {
        return interaction.editReply({ content: 'Member not found in the guild.' });
      }

      // Handle role assignment
	// Handle role assignment with debug logging
		try {
		  console.log('Starting role assignment process...');
		  
		  // Remove allowed role if configured
		  if (config.allowedRole) {
			const allowedRole = interaction.guild.roles.cache.get(config.allowedRole);
			console.log(`Allowed role resolved: ${allowedRole?.id || 'Not found'}`);
			
			if (allowedRole && member.roles.cache.has(allowedRole.id)) {
			  console.log('Removing allowed role...');
			  await member.roles.remove(allowedRole)
				.then(() => console.log('Successfully removed allowed role'))
				.catch(e => console.error('Failed to remove allowed role:', e));
			}
		  }

		  // Add guild role if configured
		  if (guildInfo?.guildRole) {
			const guildRole = interaction.guild.roles.cache.get(guildInfo.guildRole);
			console.log(`Guild role resolved: ${guildRole?.id || 'Not found'}`);
			
			if (guildRole) {
			  if (!member.roles.cache.has(guildRole.id)) {
				console.log('Adding guild role...');
				await member.roles.add(guildRole)
				  .then(() => {
					console.log('Successfully added guild role');
					roleAdded = `<@&${guildRole.id}>`;
				  })
				  .catch(e => {
					console.error('Failed to add guild role:', e);
					throw new Error('Failed to assign guild role. Check bot permissions.');
				  });
			  } else {
				console.log('Member already has the guild role');
				roleAdded = `<@&${guildRole.id}> (already had role)`;
			  }
			}
		  }
		} catch (roleError) {
		  console.error('Role management error:', roleError);
		  return interaction.editReply({
			content: '❌ Failed to update roles. Please check bot permissions and role hierarchy.',
		  });
		}

      // Save player to DB
      const totalFame = (playerInfo.KillFame || 0) + (playerInfo.DeathFame || 0);
      await Player.create({
        discordId,
        albionName: playerInfo.Name,
        albionId: playerInfo.Id,
        guildId: playerInfo.GuildId,
        guildName: playerInfo.GuildName,
        killFame: playerInfo.KillFame || 0,
        deathFame: playerInfo.DeathFame || 0
      });

      // Respond with success embed
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Registration Complete')
        .setDescription(`Successfully registered ${playerInfo.Name}`)
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

    } catch (error) {
      console.error('Registration error:', error);

      let errorMessage = 'An error occurred during registration.';
      if (error.message.includes('not found')) {
        errorMessage = `Character "${albionName}" not found. Check spelling and try again.`;
      } else if (error.message.includes('Missing Permissions')) {
        errorMessage = '❌ Bot lacks permissions to manage roles or nicknames.';
      }

      await interaction.editReply({
        content: errorMessage
      });
    }
  }
};