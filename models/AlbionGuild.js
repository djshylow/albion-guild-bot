const { DataTypes, Model } = require('sequelize');
const sequelize = require('../services/database');

class AlbionGuild extends Model {}

AlbionGuild.init(
  {
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    guildRole: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guildTag: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    discordGuildId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'AlbionGuild',
    tableName: 'albion_guilds',
    timestamps: true,
  }
);

module.exports = AlbionGuild;
