'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check the current column type
      const tableDescription = await queryInterface.describeTable('study_participants');

      if (tableDescription.demographics_info) {
        console.log('Current demographics_info column type:', tableDescription.demographics_info.type);

        // Change the column type from TEXT to JSON
        if (tableDescription.demographics_info.type === 'TEXT' || tableDescription.demographics_info.type === 'TINYTEXT' || tableDescription.demographics_info.type === 'MEDIUMTEXT' || tableDescription.demographics_info.type === 'LONGTEXT') {
          console.log('Converting demographics_info from TEXT to JSON...');

          // For PostgreSQL
          if (queryInterface.sequelize.getDialect() === 'postgres') {
            await queryInterface.sequelize.query(`
              ALTER TABLE study_participants 
              ALTER COLUMN demographics_info TYPE JSON 
              USING demographics_info::JSON
            `);
          }
          // For MySQL/MariaDB
          else if (queryInterface.sequelize.getDialect() === 'mysql' || queryInterface.sequelize.getDialect() === 'mariadb') {
            await queryInterface.changeColumn('study_participants', 'demographics_info', {
              type: Sequelize.JSON,
              allowNull: true,
            });
          }
          // For SQLite
          else if (queryInterface.sequelize.getDialect() === 'sqlite') {
            // SQLite doesn't have a native JSON type, but Sequelize handles it
            await queryInterface.changeColumn('study_participants', 'demographics_info', {
              type: Sequelize.JSON,
              allowNull: true,
            });
          }

          console.log('Successfully converted demographics_info to JSON type');
        } else if (tableDescription.demographics_info.type === 'JSON') {
          console.log('demographics_info is already JSON type, no action needed');
        } else {
          console.log('demographics_info has unexpected type:', tableDescription.demographics_info.type);
        }
      } else {
        console.log('demographics_info column does not exist');
      }
    } catch (error) {
      console.error('Error converting demographics_info column type:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Revert JSON back to TEXT
      const tableDescription = await queryInterface.describeTable('study_participants');

      if (tableDescription.demographics_info && tableDescription.demographics_info.type === 'JSON') {
        console.log('Reverting demographics_info from JSON to TEXT...');

        // For PostgreSQL
        if (queryInterface.sequelize.getDialect() === 'postgres') {
          await queryInterface.sequelize.query(`
            ALTER TABLE study_participants 
            ALTER COLUMN demographics_info TYPE TEXT
          `);
        }
        // For MySQL/MariaDB
        else if (queryInterface.sequelize.getDialect() === 'mysql' || queryInterface.sequelize.getDialect() === 'mariadb') {
          await queryInterface.changeColumn('study_participants', 'demographics_info', {
            type: Sequelize.TEXT,
            allowNull: true,
          });
        }
        // For SQLite
        else if (queryInterface.sequelize.getDialect() === 'sqlite') {
          await queryInterface.changeColumn('study_participants', 'demographics_info', {
            type: Sequelize.TEXT,
            allowNull: true,
          });
        }

        console.log('Successfully reverted demographics_info to TEXT type');
      }
    } catch (error) {
      console.error('Error reverting demographics_info column type:', error);
      throw error;
    }
  }
};
