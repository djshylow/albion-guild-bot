// models/GuildConfig.js
const { DataTypes } = require('sequelize');
// REMOVE THIS LINE: const sequelize = require('../services/database'); // <-- REMOVE THIS

module.exports = (sequelize) => { // <-- Wrap in a function that takes sequelize
  const GuildConfig = sequelize.define('GuildConfig', {
    guildId: { // This is the Discord Guild ID
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      field: 'guild_id'
    },
    adminRole: {
      type: DataTypes.STRING, // Discord Role ID
      allowNull: false,
      field: 'admin_role'
    },
    modRole: {
      type: DataTypes.STRING, // Discord Role ID
      allowNull: false,
      field: 'mod_role'
    },
    allowedRole: {
      type: DataTypes.STRING, // Discord Role ID for players to be verified into
      allowNull: true,
      field: 'allowed_role'
    },
    purgeUsersOnLeave: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'purge_users_on_leave'
    },
    editNick: { // Whether to edit user nicknames
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'edit_nick'
    },
    showGuildTag: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'show_guild_tag'
    }
  }, {
    sequelize, // Pass the sequelize instance here
    modelName: 'GuildConfig',
    tableName: 'guild_configs',
    timestamps: true, // Keep as per your original
    createdAt: 'created_at', // For consistency with Player.js
    updatedAt: 'updated_at', // For consistency with Player.js
    underscored: true // If you want automatic camelCase to snake_case column mapping
  });

  return GuildConfig; // <-- Return the defined model
};