'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if created_by column already exists
        const tableDescription = await queryInterface.describeTable('research_status');
        
        if (!tableDescription.created_by) {
            // Add created_by column only if it doesn't exist
            await queryInterface.addColumn('research_status', 'created_by', {
                type: Sequelize.STRING,
                allowNull: true
            });
        }

        // Add 'created' to the status enum (IF NOT EXISTS handles existing values)
        if (queryInterface.sequelize.getDialect() === 'postgres') {
            await queryInterface.sequelize.query(`
        ALTER TYPE "enum_research_status_status"
        ADD VALUE IF NOT EXISTS 'created';
      `);
        } else {
            // For MySQL, check if we need to update the enum
            await queryInterface.changeColumn('research_status', 'status', {
                type: Sequelize.ENUM('approve', 'rejected', 'need_changes', 'created'),
                allowNull: false,
                defaultValue: 'approve'
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Remove created_by column
        await queryInterface.removeColumn('research_status', 'created_by');

        // Remove 'created' from the status enum
        if (queryInterface.sequelize.getDialect() === 'postgres') {
            // Revert enum to previous state
            await queryInterface.changeColumn('research_status', 'status', {
                type: Sequelize.ENUM('approve', 'rejected', 'need_changes'),
                allowNull: false,
                defaultValue: 'approve'
            });
            // Drop and recreate the enum type if needed (advanced, not always necessary)
        } else {
            await queryInterface.changeColumn('research_status', 'status', {
                type: Sequelize.ENUM('approve', 'rejected', 'need_changes'),
                allowNull: false,
                defaultValue: 'approve'
            });
        }
    }
}; 
