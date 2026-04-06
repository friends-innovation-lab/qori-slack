const dotenv = require('dotenv');
dotenv.config();

const {
  DB_HOST,
  DB_PORT = 5432,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_DIALECT
} = process.env;

module.exports = {
  development: {
    dialect: DB_DIALECT,
    host: DB_HOST,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: Number(DB_PORT),
    logging: false,
  },
  production: {
    dialect: DB_DIALECT,
    host: DB_HOST,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: Number(DB_PORT),
    logging: false,
  },
};