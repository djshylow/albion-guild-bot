const sequelize = require('../services/database');
const AlbionGuild = require('./AlbionGuild');
const GuildConfig = require('./GuildConfig');
const Player = require('./Player')(sequelize);  // ✅ Import Player model

(async () => {
  await sequelize.sync();
  console.log('Database synced.');
})();

module.exports = {
  sequelize,
  AlbionGuild,
  GuildConfig,
  Player, // ✅ Export Player model
};
