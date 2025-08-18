const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { Player, GuildConfig, AlbionGuild } = require('../models');
const AlbionAPI = require('../utils/api');

const MOD_ROLE_ID = '1378004212168003694'; // Your mod role ID
const WELCOME_CHANNEL_ID = '1376085914870222919'; // Your welcome channel ID

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
            .setDescription('Albion character name')
            .setRequired(true)
            .setMaxLength(30)
        )
        .addStringOption(option =>
          option.setName('albion_id')
            .setDescription('Albion character ID (use if name search fails)')
            .setRequired(false)
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
    // Defer immediately to avoid timeout
    await interaction.deferReply({ ephemeral: false });
    
    try {
      const sub = interaction.options.getSubcommand();
      const guild = interaction.guild;

      // Fetch member with error handling
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        return interaction.editReply({ content: '❌ Could not fetch your member data.' });
      }

      // Get Mod role object
      const modRole = guild.roles.cache.get(MOD_ROLE_ID);
      if (!modRole) {
        return interaction.editReply({
          content: '⚠️ Mod role not found in the server. Please check configuration.'
        });
      }

      // Check permissions
      if (member.roles.highest.position < modRole.position) {
        return interaction.editReply({
          content: '⛔ You must have the Mod role or higher to use this command.'
        });
      }

      const config = await GuildConfig.findOne({ where: { guildId: guild.id } });
      if (!config) {
        return interaction.editReply({
          content: '❌ Bot not configured. Run `/setup config` first.'
        });
      }

      // ✅ REGISTER
      if (sub === 'register') {
        const user = interaction.options.getUser('user');
        const albionName = interaction.options.getString('albion_name');
        const albionId = interaction.options.getString('albion_id');

        if (!albionName && !albionId) {
          return interaction.editReply({ content: '❌ You must provide either an Albion name or ID.' });
        }

        try {
          let playerInfo;
          
          if (albionId) {
            playerInfo = await AlbionAPI.getPlayerById(albionId);
            
            if (playerInfo.GuildId) {
              const guildData = await AlbionGuild.findOne({
                where: {
                  guildId: playerInfo.GuildId,
                  discordGuildId: guild.id
                }
              });
              
              if (!guildData) {
                return interaction.editReply({
                  content: `❌ This player's guild (${playerInfo.GuildName}) is not registered.\n` +
                          `Please register it first with \`/guild add\``
                });
              }
            }
          } else {
            const players = await AlbionAPI.searchPlayers(albionName);
            
            // Try exact name match in registered guilds
            for (const player of players) {
              if (player.Name.toLowerCase() === albionName.toLowerCase() && player.GuildId) {
                const guildData = await AlbionGuild.findOne({
                  where: {
                    guildId: player.GuildId,
                    discordGuildId: guild.id
                  }
                });
                
                if (guildData) {
                  const details = await AlbionAPI.getPlayerById(player.Id);
                  playerInfo = { ...player, ...details };
                  break;
                }
              }
            }
            
            if (!playerInfo) {
              playerInfo = players.find(p => p.Name.toLowerCase() === albionName.toLowerCase());
              
              if (playerInfo && playerInfo.GuildId) {
                const guildData = await AlbionGuild.findOne({
                  where: {
                    guildId: playerInfo.GuildId,
                    discordGuildId: guild.id
                  }
                });
                
                if (!guildData) {
                  return interaction.editReply({
                    content: `❌ Player found but their guild (${playerInfo.GuildName}) is not registered.\n` +
                            `Please register it first with \`/guild add\``
                  });
                }
                
                const details = await AlbionAPI.getPlayerById(playerInfo.Id);
                playerInfo = { ...playerInfo, ...details };
              }
            }
            
            if (!playerInfo) {
              const similarPlayers = players
                .filter(p => p.Name.toLowerCase().includes(albionName.toLowerCase()))
                .slice(0, 5);
              
              if (similarPlayers.length > 0) {
                const options = similarPlayers.map((p, i) => 
                  `${i+1}. ${p.Name} ${p.GuildName ? `[${p.GuildName}]` : '(No Guild)'}`
                ).join('\n');
                
                return interaction.editReply({
                  content: `Multiple similar players found:\n${options}\n\n` +
                          'Please either:\n' +
                          '1. Use the exact character name\n' +
                          '2. Use the Albion ID (/whois in game)\n' +
                          '3. Register their guild first using `/guild add`'
                });
              }
              
              return interaction.editReply({ 
                content: `❌ No player found matching "${albionName}"`
              });
            }
          }

          const existing = await Player.findOne({ where: { discordId: user.id } });
          if (existing) {
            return interaction.editReply({ content: `⚠️ ${user.username} is already registered.` });
          }

          const targetMember = await guild.members.fetch(user.id).catch(() => null);
          if (!targetMember) {
            return interaction.editReply({ content: '❌ Target user not found in this server.' });
          }

          const guildData = await AlbionGuild.findOne({
            where: {
              guildId: playerInfo.GuildId || '',
              discordGuildId: guild.id
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

          // Send welcome message if in guild
          if (playerInfo.GuildId && guildData) {
            const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
            if (welcomeChannel) {
              try {
                const adminMentions = [
                  '1332768976282849360',
                  '270443637865709570',
                  '688009786276708415',
                  '1290995422067949593'
                ].map(id => `<@${id}>`).join(', ');

                await welcomeChannel.send(`
Welcome to Vicarious, <@${user.id}>!

Please refer to channel <#1380027924173946881>. We recommend you follow the Mist Tutorial.

Please make sure to check channel <#1400474742607319172> as it contains details about alliance.

Any questions? Please type in this channel as our friendly community is there to support you. 
Do you need activity? Ask! We are all working people. Nobody is forced to do content.

Have fun! Enjoy!

Leadership: ${adminMentions}
                `);
              } catch (error) {
                console.error('Welcome message failed:', error);
              }
            }
          }

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
          return interaction.editReply({ 
            content: `❌ Registration failed: ${err.message || 'Check logs'}` 
          });
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

          if (targetMember) {
            if (guildData?.guildRole) {
              const role = guild.roles.cache.get(guildData.guildRole);
              if (role && targetMember.roles.cache.has(role.id)) {
                await targetMember.roles.remove(role).catch(() => {});
              }
            }
            
            if (config.editNick) {
              await targetMember.setNickname(null).catch(() => {});
            }
          }

          await Player.destroy({ where: { discordId: user.id } });

          return interaction.editReply({ content: `✅ <@${user.id}> has been unregistered and cleaned up.` });

        } catch (err) {
          console.error('[Admin Unregister Error]', err);
          return interaction.editReply({ content: '❌ Error removing user. Check logs.' });
        }
      }
    } catch (error) {
      console.error('Admin command error:', error);
      try {
        await interaction.editReply({ 
          content: '❌ An unexpected error occurred. Please try again.' 
        });
      } catch (e) {
        console.error('Failed to send error reply:', e);
      }
    }
  }
};