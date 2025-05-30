const { Player, AlbionGuild } = require('../models');
const AlbionAPI = require('../utils/api');

async function verifyRegisteredPlayers(client) {
  try {
    const players = await Player.findAll();
    const now = new Date();
    const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));

    for (const player of players) {
      if (player.lastVerified && player.lastVerified > oneWeekAgo) continue;

      try {
        const playerData = await AlbionAPI.getPlayerInfo(player.albionName);
        const member = await client.guilds.cache
          .get(process.env.GUILD_ID)
          ?.members.fetch(player.discordId);

        if (!playerData || !playerData.GuildId) {
          const guild = await AlbionGuild.findOne({ 
            where: { guildId: player.guildId } 
          });
          if (guild && member) {
            const role = await member.guild.roles.fetch(guild.guildRole);
            if (role) await member.roles.remove(role);
          }
          await player.destroy();
          continue;
        }

        await player.update({ 
          lastVerified: new Date(),
          guildId: playerData.GuildId,
          guildName: playerData.GuildName,
          killFame: playerData.KillFame || 0,
          deathFame: playerData.DeathFame || 0
        });
      } catch (error) {
        console.error(`Verification failed for ${player.albionName}:`, error);
      }
    }
  } catch (error) {
    console.error('Verification task failed:', error);
  }
}

module.exports = { verifyRegisteredPlayers };