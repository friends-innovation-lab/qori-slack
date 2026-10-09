'use strict';

/**
 * Migration: DR-1 — Add same-construct validation constraints
 *
 * Per SPEC-2 audit — Priority 2 Database Integrity:
 * - latest_revision_id must belong to the same construct
 * - accepted_revision_id must belong to the same construct
 * - review.revision_id must belong to review.construct_id
 *
 * Uses triggers for cross-table validation since composite FKs would
 * require schema restructuring.
 *
 * Also enforces immutability:
 * - Revisions: content and evidence_snapshot cannot be updated
 * - Reviews: entire row is immutable after insert
 */

module.exports = {
  async up(queryInterface) {
    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER: Validate latest_revision_id belongs to same construct
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_latest_revision_construct()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.latest_revision_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM evidence_construct_revisions
            WHERE id = NEW.latest_revision_id
            AND construct_id = NEW.id
          ) THEN
            RAISE EXCEPTION 'latest_revision_id must belong to this construct';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_check_latest_revision_construct
      BEFORE INSERT OR UPDATE OF latest_revision_id ON evidence_constructs
      FOR EACH ROW
      EXECUTE FUNCTION check_latest_revision_construct();
    `);

    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER: Validate accepted_revision_id belongs to same construct
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_accepted_revision_construct()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.accepted_revision_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM evidence_construct_revisions
            WHERE id = NEW.accepted_revision_id
            AND construct_id = NEW.id
          ) THEN
            RAISE EXCEPTION 'accepted_revision_id must belong to this construct';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_check_accepted_revision_construct
      BEFORE INSERT OR UPDATE OF accepted_revision_id ON evidence_constructs
      FOR EACH ROW
      EXECUTE FUNCTION check_accepted_revision_construct();
    `);

    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER: Validate review.revision_id belongs to review.construct_id
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION check_review_revision_construct()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.revision_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM evidence_construct_revisions
            WHERE id = NEW.revision_id
            AND construct_id = NEW.construct_id
          ) THEN
            RAISE EXCEPTION 'revision_id must belong to the same construct as the review';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_check_review_revision_construct
      BEFORE INSERT ON evidence_construct_reviews
      FOR EACH ROW
      EXECUTE FUNCTION check_review_revision_construct();
    `);

    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER: Enforce immutability of revision content/evidence_snapshot
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_revision_content_update()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.content IS DISTINCT FROM NEW.content THEN
          RAISE EXCEPTION 'revision content is immutable';
        END IF;
        IF OLD.evidence_snapshot IS DISTINCT FROM NEW.evidence_snapshot THEN
          RAISE EXCEPTION 'revision evidence_snapshot is immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_prevent_revision_content_update
      BEFORE UPDATE ON evidence_construct_revisions
      FOR EACH ROW
      EXECUTE FUNCTION prevent_revision_content_update();
    `);

    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER: Enforce immutability of review events (no updates allowed)
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_review_update()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'review events are immutable - updates not allowed';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_prevent_review_update
      BEFORE UPDATE ON evidence_construct_reviews
      FOR EACH ROW
      EXECUTE FUNCTION prevent_review_update();
    `);

    // ═══════════════════════════════════════════════════════════════════
    // RULE: Prevent deletion of revisions (append-only)
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE RULE prevent_revision_delete AS
      ON DELETE TO evidence_construct_revisions
      DO INSTEAD NOTHING;
    `);

    // ═══════════════════════════════════════════════════════════════════
    // RULE: Prevent deletion of reviews (append-only)
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE RULE prevent_review_delete AS
      ON DELETE TO evidence_construct_reviews
      DO INSTEAD NOTHING;
    `);

    console.log('Added DR-1 same-construct validation triggers and immutability protections');
  },

  async down(queryInterface) {
    // Drop rules
    await queryInterface.sequelize.query(`
      DROP RULE IF EXISTS prevent_review_delete ON evidence_construct_reviews;
      DROP RULE IF EXISTS prevent_revision_delete ON evidence_construct_revisions;
    `);

    // Drop triggers
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_review_update ON evidence_construct_reviews;
      DROP TRIGGER IF EXISTS trg_prevent_revision_content_update ON evidence_construct_revisions;
      DROP TRIGGER IF EXISTS trg_check_review_revision_construct ON evidence_construct_reviews;
      DROP TRIGGER IF EXISTS trg_check_accepted_revision_construct ON evidence_constructs;
      DROP TRIGGER IF EXISTS trg_check_latest_revision_construct ON evidence_constructs;
    `);

    // Drop functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS prevent_review_update();
      DROP FUNCTION IF EXISTS prevent_revision_content_update();
      DROP FUNCTION IF EXISTS check_review_revision_construct();
      DROP FUNCTION IF EXISTS check_accepted_revision_construct();
      DROP FUNCTION IF EXISTS check_latest_revision_construct();
    `);

    console.log('Removed DR-1 same-construct validation triggers and immutability protections');
  },
};
