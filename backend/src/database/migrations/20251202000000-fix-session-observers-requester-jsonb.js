'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    // Check current column type
    const tableDescription = await queryInterface.describeTable('session_observers');
    const requesterIdType = tableDescription.requester_id.type;
    
    console.log(`Current requester_id column type: ${requesterIdType}`);

    if (dialect === 'postgres') {
      // PostgreSQL migration
      
      // Step 1: Remove index if it exists
      try {
        await queryInterface.removeIndex('session_observers', ['requester_id']);
      } catch (e) {
        console.log('Index removal skipped (may not exist):', e.message);
      }

      // Step 2: Convert column type to JSONB with proper data normalization
      // Check if column is already JSONB
      if (!requesterIdType.toLowerCase().includes('json')) {
        // First, create a helper function to normalize the data
        await queryInterface.sequelize.query(`
          CREATE OR REPLACE FUNCTION normalize_to_jsonb_array(input_text TEXT)
          RETURNS JSONB AS $$
          BEGIN
            IF input_text IS NULL OR input_text = '' THEN
              RETURN '[]'::jsonb;
            END IF;
            
            -- Remove leading/trailing whitespace
            input_text := TRIM(input_text);
            
            -- If it looks like a JSON array (starts and ends with brackets)
            IF input_text ~ '^\\[.*\\]$' THEN
              BEGIN
                -- Try to parse as JSON
                RETURN input_text::jsonb;
              EXCEPTION WHEN OTHERS THEN
                -- If parsing fails, wrap in array
                RETURN jsonb_build_array(input_text);
              END;
            ELSE
              -- Plain string, wrap in array
              RETURN jsonb_build_array(input_text);
            END IF;
          END;
          $$ LANGUAGE plpgsql IMMUTABLE;
        `);

        // Now use the function in the ALTER TABLE
        await queryInterface.sequelize.query(`
          ALTER TABLE session_observers 
          ALTER COLUMN requester_id TYPE jsonb 
          USING normalize_to_jsonb_array(requester_id::text),
          ALTER COLUMN requester_id SET DEFAULT '[]'::jsonb,
          ALTER COLUMN requester_name TYPE jsonb 
          USING normalize_to_jsonb_array(requester_name::text),
          ALTER COLUMN requester_name SET DEFAULT '[]'::jsonb;
        `);

        // Clean up the helper function
        await queryInterface.sequelize.query(`
          DROP FUNCTION IF EXISTS normalize_to_jsonb_array(TEXT);
        `);

        console.log('✅ Converted columns to JSONB');
      } else {
        console.log('⚠️ Columns are already JSON type');
        
        // Normalize existing JSONB data to ensure arrays
        await queryInterface.sequelize.query(`
          UPDATE session_observers 
          SET requester_id = CASE
            WHEN jsonb_typeof(requester_id) = 'array' THEN requester_id
            ELSE jsonb_build_array(requester_id::text)
          END,
          requester_name = CASE
            WHEN requester_name IS NULL THEN '[]'::jsonb
            WHEN jsonb_typeof(requester_name) = 'array' THEN requester_name
            ELSE jsonb_build_array(requester_name::text)
          END;
        `);
        
        // Ensure defaults are set
        await queryInterface.sequelize.query(`
          ALTER TABLE session_observers 
          ALTER COLUMN requester_id SET DEFAULT '[]'::jsonb,
          ALTER COLUMN requester_name SET DEFAULT '[]'::jsonb;
        `);
      }

    } else {
      // MySQL migration
      
      // Step 1: Normalize all data first
      await queryInterface.sequelize.query(`
        UPDATE session_observers 
        SET requester_id = CASE
          -- If it looks like a JSON array string, parse it
          WHEN requester_id REGEXP '^\\s*\\[.*\\]\\s*$' THEN
            CASE 
              WHEN requester_id REGEXP '^\\s*\\[\\s*\\]\\s*$' THEN JSON_ARRAY()
              ELSE CAST(requester_id AS JSON)
            END
          -- Plain string, wrap in array
          ELSE JSON_ARRAY(requester_id)
        END,
        requester_name = CASE
          WHEN requester_name IS NULL THEN JSON_ARRAY()
          WHEN requester_name REGEXP '^\\s*\\[.*\\]\\s*$' THEN
            CASE 
              WHEN requester_name REGEXP '^\\s*\\[\\s*\\]\\s*$' THEN JSON_ARRAY()
              ELSE CAST(requester_name AS JSON)
            END
          ELSE JSON_ARRAY(requester_name)
        END;
      `);

      // Step 2: Convert column type to JSON
      await queryInterface.sequelize.query(`
        ALTER TABLE session_observers 
        MODIFY COLUMN requester_id JSON NOT NULL DEFAULT ('[]'),
        MODIFY COLUMN requester_name JSON DEFAULT ('[]');
      `);
      
      console.log('✅ Converted columns to JSON');
    }

    console.log('✅ Migration complete: All requester data normalized to JSON arrays');
  },

  down: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      // Revert to VARCHAR(255) - extract first element from array
      await queryInterface.sequelize.query(`
        ALTER TABLE session_observers 
        ALTER COLUMN requester_id TYPE varchar(255) USING (requester_id->>0),
        ALTER COLUMN requester_name TYPE varchar(255) USING (requester_name->>0);
      `);
      
      // Re-add index
      await queryInterface.addIndex('session_observers', ['requester_id']);
    } else {
      // MySQL: Extract first element and convert back
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

    console.log('✅ Reverted to VARCHAR(255)');
  },
};

