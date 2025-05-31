// models/RaidSetup.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RaidSetup = sequelize.define('RaidSetup', {
    guild_id: { type: DataTypes.STRING, allowNull: false },
    message_id: { type: DataTypes.STRING },
    created_by: { type: DataTypes.STRING, allowNull: false },
    preset: { type: DataTypes.STRING, allowNull: false },
    raid_date: { type: DataTypes.STRING, allowNull: false },
    raid_time: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    gear_requirement: { type: DataTypes.STRING },
    item_power: { type: DataTypes.STRING },
    participants: { type: DataTypes.JSON, defaultValue: {} }
  }, { tableName: 'raid_setups' });

  return RaidSetup;
};