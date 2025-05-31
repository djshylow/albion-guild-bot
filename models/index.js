const sequelize = require('../services/database'); // Adjust path as needed

// These lines will now correctly call the functions exported by the model files
const Player = require('./Player')(sequelize);
const AlbionGuild = require('./AlbionGuild')(sequelize);
const GuildConfig = require('./GuildConfig')(sequelize);
const RaidSetup = require('./RaidSetup')(sequelize);
const RaidPreset = require('./RaidPreset')(sequelize);

// ... (associations and exports) ...

module.exports = {
  sequelize,
  Player,
  AlbionGuild,
  GuildConfig,
  RaidSetup,
  RaidPreset
};