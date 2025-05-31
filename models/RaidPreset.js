// models/RaidPreset.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RaidPreset = sequelize.define('RaidPreset', {
    guild_id: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    slots: { type: DataTypes.JSON, allowNull: false }
  }, { tableName: 'raid_presets' });

  return RaidPreset;
};