const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Player', {
    discordId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    albionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    albionName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    guildName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    killFame: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    deathFame: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastVerified: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, 
  {
    timestamps: true,
    tableName: 'players'
  });
};
