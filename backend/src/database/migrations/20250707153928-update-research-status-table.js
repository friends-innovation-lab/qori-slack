'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1) Add the new requested_by column
    await queryInterface.addColumn('research_status', 'requested_by', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 2) Make approved_by nullable
    await queryInterface.changeColumn('research_status', 'approved_by', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 3) Extend the enum on status to include "need_changes"
    // For Postgres, add the new value to the existing type first:
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_research_status_status"
          ADD VALUE IF NOT EXISTS 'need_changes';
      `);
      // then alter the column to use the same enum type (no-op but safe)
      await queryInterface.changeColumn('research_status', 'status', {
        type: Sequelize.ENUM('approve', 'rejected', 'need_changes'),
        allowNull: false,
        defaultValue: 'approve'
      });
    } else {
      // MySQL / MariaDB: just redefine the column
      await queryInterface.changeColumn('research_status', 'status', {
        type: Sequelize.ENUM('approve', 'rejected', 'need_changes'),
        allowNull: false,
        defaultValue: 'approve'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 1) Remove requested_by
    await queryInterface.removeColumn('research_status', 'requested_by');

    // 2) Make approved_by not-null again
    await queryInterface.changeColumn('research_status', 'approved_by', {
      type: Sequelize.STRING,
      allowNull: false
    });

    // 3) Revert enum on status back to just 'approve'/'rejected'
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      // Change column back
      await queryInterface.changeColumn('research_status', 'status', {
        type: Sequelize.ENUM('approve', 'rejected'),
        allowNull: false,
        defaultValue: 'approve'
      });
      // Drop the extended enum type and recreate original:
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_research_status_status" RENAME TO "enum_research_status_status_old";
      `);
      await queryInterface.sequelize.query(`
        CREATE TYPE "enum_research_status_status" AS ENUM('approve','rejected');
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE "research_status"
          ALTER COLUMN "status" TYPE "enum_research_status_status"
          USING status::text::"enum_research_status_status";
      `);
      await queryInterface.sequelize.query(`
        DROP TYPE "enum_research_status_status_old";
      `);
    } else {
      // MySQL: just redefine the column
      await queryInterface.changeColumn('research_status', 'status', {
        type: Sequelize.ENUM('approve', 'rejected'),
        allowNull: false,
        defaultValue: 'approve'
      });
    }
  }
};
