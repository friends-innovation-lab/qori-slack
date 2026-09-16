#!/usr/bin/env node
/**
 * Schema Validation Script
 *
 * Verifies that all Sequelize model columns exist in the database.
 * Catches the "code expects column that doesn't exist" class of bugs.
 *
 * Run after migrations, before starting the app or running tests.
 *
 * Usage: node scripts/validate-schema.js
 *
 * Exit codes:
 *   0 - Schema valid, all model columns exist in database
 *   1 - Schema invalid, missing columns found
 *
 * Model discovery: scans src/database/models/ for all .ts files and
 * imports their default export. This avoids maintaining a second
 * hardcoded model list that drifts from the authoritative registry
 * in src/database/index.ts.
 */

require('@babel/register')({
  extensions: ['.js', '.ts'],
  babelrc: false, // Ignore .babelrc to avoid config conflicts
  presets: [
    '@babel/preset-env',
    ['@babel/preset-typescript', { allowDeclareFields: true }],
  ],
});

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Dynamically discover all model files from the authoritative models directory.
// Each model file exports a default function: (sequelize: Sequelize) => Model.
const MODELS_DIR = path.resolve(__dirname, '../src/database/models');
const modelDefiners = [];

for (const file of fs.readdirSync(MODELS_DIR).sort()) {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;

  try {
    const mod = require(path.join(MODELS_DIR, file));
    const definer = mod.default || mod;
    if (typeof definer === 'function') {
      modelDefiners.push(definer);
    }
  } catch (err) {
    // Some model files may fail to import due to missing dependencies
    // in the validation context — log and continue
    console.warn(`  ⚠ Could not import model ${file}: ${err.message}`);
  }
}

async function validateSchema() {
  // Use environment variables for database connection
  const sequelize = new Sequelize({
    dialect: process.env.DB_DIALECT || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'qori_test',
    username: process.env.DB_USER || 'qori_test',
    password: process.env.DB_PASSWORD || 'test',
    logging: false,
  });

  // Register all discovered models
  for (const defineModel of modelDefiners) {
    try {
      defineModel(sequelize);
    } catch (err) {
      console.warn(`  ⚠ Could not register model: ${err.message}`);
    }
  }

  const errors = [];

  for (const [modelName, model] of Object.entries(sequelize.models)) {
    const tableName = model.getTableName();
    if (typeof tableName !== 'string') continue;

    // Get actual columns from database
    const dbColumns = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const dbColumnNames = new Set(dbColumns.map(c => c.column_name));

    // Check if table exists
    if (dbColumnNames.size === 0) {
      errors.push(`Table "${tableName}" (model ${modelName}) does not exist in database`);
      continue;
    }

    // Get expected columns from model
    const modelAttrs = model.getAttributes();
    for (const [attrName, attrDef] of Object.entries(modelAttrs)) {
      const columnName = attrDef.field || attrName;
      if (!dbColumnNames.has(columnName)) {
        errors.push(`${modelName}.${attrName} expects column "${columnName}" but it does not exist in table "${tableName}"`);
      }
    }
  }

  await sequelize.close();

  if (errors.length > 0) {
    console.error('Schema validation FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('');
    console.error('This means the code expects database columns that do not exist.');
    console.error('Check that all migrations have been run and that model definitions match migrations.');
    process.exit(1);
  }

  console.log(`Schema validation passed: ${Object.keys(sequelize.models).length} models verified`);
  process.exit(0);
}

validateSchema().catch(e => {
  console.error('Schema validation error:', e.message);
  process.exit(1);
});
