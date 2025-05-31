// models/AlbionGuild.js
const { DataTypes } = require('sequelize');
// REMOVE THIS LINE: const sequelize = require('../services/database'); // <-- REMOVE THIS

module.exports = (sequelize) => { // <-- Wrap in a function that takes sequelize
  const AlbionGuild = sequelize.define('AlbionGuild', {
    // Note: 'guildId' in your definition, but `id` in my previous example.
    // I'll stick to 'guildId' as per your provided code.
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      field: 'guild_id' // Added field for consistency if you use underscored: true globally
    },
    guildRole: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'guild_role'
    },
    guildTag: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'guild_tag'
    },
    discordGuildId: { // This is the Discord Guild ID, not the Albion guild ID
      type: DataTypes.STRING,
      allowNull: false,
      field: 'discord_guild_id'
    },
  }, {
    sequelize, // Pass the sequelize instance here
    modelName: 'AlbionGuild',
    tableName: 'albion_guilds',
    timestamps: true, // Keep as per your original
    createdAt: 'created_at', // For consistency with Player.js
    updatedAt: 'updated_at', // For consistency with Player.js
    underscored: true // If you want automatic camelCase to snake_case column mapping
  });

  return AlbionGuild; // <-- Return the defined model
};