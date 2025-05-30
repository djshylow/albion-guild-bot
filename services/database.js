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
      timestamps: true, // Enable timestamps globally
      underscored: true // Use snake_case for column names
    }
  }
);

// Test connection
sequelize.authenticate()
  .then(() => console.log('MySQL connection established successfully.'))
  .catch(err => console.error('Unable to connect to MySQL:', err));

module.exports = sequelize;