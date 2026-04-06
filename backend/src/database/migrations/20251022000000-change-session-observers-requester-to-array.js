'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    // Remove index
    await queryInterface.removeIndex('session_observers', ['requester_id']);

    if (dialect === 'postgres') {
      // PostgreSQL: Use ALTER COLUMN with USING to convert in one step
      await queryInterface.sequelize.query(`
        ALTER TABLE session_observers 
        ALTER COLUMN requester_id TYPE jsonb 
        USING jsonb_build_array(requester_id),
        ALTER COLUMN requester_id SET DEFAULT '[]'::jsonb,
        ALTER COLUMN requester_name TYPE jsonb 
        USING CASE WHEN requester_name IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(requester_name) END,
        ALTER COLUMN requester_name SET DEFAULT '[]'::jsonb;
      `);
    } else {
      // MySQL: Simple column change
      await queryInterface.sequelize.query(`
        ALTER TABLE session_observers 
        MODIFY COLUMN requester_id JSON NOT NULL DEFAULT ('[]'),
        MODIFY COLUMN requester_name JSON DEFAULT ('[]');
      `);

      // Convert existing data
      await queryInterface.sequelize.query(`
        UPDATE session_observers 
        SET requester_id = JSON_ARRAY(requester_id),
            requester_name = CASE WHEN requester_name IS NULL THEN JSON_ARRAY() ELSE JSON_ARRAY(requester_name) END;
      `);
    }

    console.log('✅ Migrated to JSON arrays');
  },

  down: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      // PostgreSQL: Extract first element from array
      await queryInterface.sequelize.query(`
        ALTER TABLE session_observers 
        ALTER COLUMN requester_id TYPE varchar(255) USING (requester_id->>0),
        ALTER COLUMN requester_name TYPE varchar(255) USING (requester_name->>0);
      `);
    } else {
      // MySQL: Extract first element
      await queryInterface.sequelize.query(`
        UPDATE session_observers 
        SET requester_id = JSON_UNQUOTE(JSON_EXTRACT(requester_id, '$[0]')),
            requester_name = JSON_UNQUOTE(JSON_EXTRACT(requester_name, '$[0]'));
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE session_observers 
        MODIFY COLUMN requester_id VARCHAR(255) NOT NULL,
        MODIFY COLUMN requester_name VARCHAR(255);
      `);
    }

    // Re-add index
    await queryInterface.addIndex('session_observers', ['requester_id']);

    console.log('✅ Reverted to STRING');
  },
};

