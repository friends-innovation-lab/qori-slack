const dotenv = require('dotenv');
dotenv.config();

const {
  DB_HOST,
  DB_PORT = 5432,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_DIALECT,
  // Test environment uses separate TEST_DB_* vars (set by globalSetup.ts)
  TEST_DB_HOST,
  TEST_DB_PORT,
  TEST_DB_NAME,
  TEST_DB_USER,
  TEST_DB_PASSWORD,
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
  test: {
    // Test config uses TEST_DB_* vars (set by Jest globalSetup), falling back to DB_* or defaults
    dialect: 'postgres',
    host: TEST_DB_HOST || DB_HOST || 'localhost',
    username: TEST_DB_USER || DB_USER || process.env.USER || 'qori_test',
    password: TEST_DB_PASSWORD ?? DB_PASSWORD ?? '',
    database: TEST_DB_NAME || 'qori_test',
    port: Number(TEST_DB_PORT || DB_PORT || 5432),
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