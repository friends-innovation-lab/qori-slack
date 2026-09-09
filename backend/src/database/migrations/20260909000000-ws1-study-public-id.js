'use strict';

/**
 * WS-1: Add stable public_id (UUID) to research_studies table.
 *
 * Mirrors WS-0 (projects.public_id). Workspace routes use immutable UUIDs
 * for browser bookmarks/links, not mutable slugs or internal integer IDs.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add nullable column
    await queryInterface.addColumn('research_studies', 'public_id', {
      type: Sequelize.UUID,
      allowNull: true,
      unique: false,
    });

    // Step 2: Backfill existing rows
    await queryInterface.sequelize.query(`
      UPDATE research_studies SET public_id = gen_random_uuid() WHERE public_id IS NULL;
    `);

    // Step 3: Make NOT NULL
    await queryInterface.changeColumn('research_studies', 'public_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    // Step 4: Add unique index
    await queryInterface.addIndex('research_studies', ['public_id'], {
      unique: true,
      name: 'research_studies_public_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('research_studies', 'research_studies_public_id_unique');
    await queryInterface.removeColumn('research_studies', 'public_id');
  },
};
