const { DataTypes, Model } = require('sequelize');
const sequelize = require('../services/database');

class GuildConfig extends Model {}

GuildConfig.init(
  {
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    adminRole: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    modRole: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    allowedRole: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    purgeUsersOnLeave: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    editNick: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
	showGuildTag: {
	  type: DataTypes.BOOLEAN,
	  allowNull: false,
	  defaultValue: true,
	  field: 'show_guild_tag'
	}
  },
  {
    sequelize,
    modelName: 'GuildConfig',
    tableName: 'guild_configs',
    timestamps: true,
  }

);

module.exports = GuildConfig;
