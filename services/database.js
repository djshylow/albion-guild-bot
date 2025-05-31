// services/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: console.log, // Enable logging during development
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,       // Enable timestamps globally
      createdAt: 'created_at', // Explicit snake_case names
      updatedAt: 'updated_at',
      underscored: true,      // Convert camelCase to snake_case
      freezeTableName: true,  // Prevent pluralization
      paranoid: false,        // Disable soft deletes unless needed
      charset: 'utf8mb4',
      collate: 'utf8mb4_uca1400_ai_ci' // Match your DB collation
    },
    timezone: '+00:00' // Use UTC timezone
  }
);

// Test connection
sequelize.authenticate()
  .then(() => console.log('MySQL connection established successfully.'))
  .catch(err => console.error('Unable to connect to MySQL:', err));

module.exports = sequelize;