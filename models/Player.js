const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Player = sequelize.define('Player', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    discordId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: 'unique_discord_id', // Named unique constraint
      field: 'discord_id'
    },
    albionId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: 'unique_albion_id', // Named unique constraint
      field: 'albion_id'
    },
    albionName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'albion_name'
    },
    guildId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'guild_id'
    },
    guildName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'guild_name'
    },
    killFame: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'kill_fame'
    },
    deathFame: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'death_fame'
    },
    lastVerified: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_verified'
    }
  }, {
    tableName: 'players',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['discord_id'],
        name: 'unique_discord_id'
      },
      {
        unique: true,
        fields: ['albion_id'],
        name: 'unique_albion_id'
      }
    ]
  });

  // Add any model associations here if needed
  // Player.associate = (models) => { ... };

  return Player;
};