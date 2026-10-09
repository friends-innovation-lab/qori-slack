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
    // TRIGGER: Prevent deletion of revisions (append-only with explicit error)
    // Allows CASCADE deletes from parent tables (construct/project deletion)
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_revision_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Allow CASCADE deletes (when parent construct is being deleted)
        -- pg_trigger_depth() > 1 means we're inside a cascaded trigger
        IF pg_trigger_depth() > 1 THEN
          RETURN OLD;
        END IF;
        -- Also allow if the parent construct no longer exists (already deleted in same transaction)
        IF NOT EXISTS (SELECT 1 FROM evidence_constructs WHERE id = OLD.construct_id) THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'revisions are append-only - deletion not allowed';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_prevent_revision_delete
      BEFORE DELETE ON evidence_construct_revisions
      FOR EACH ROW
      EXECUTE FUNCTION prevent_revision_delete();
    `);

    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER: Prevent deletion of reviews (append-only with explicit error)
    // Allows CASCADE deletes from parent tables (construct/project deletion)
    // ═══════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_review_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Allow CASCADE deletes (when parent construct is being deleted)
        IF pg_trigger_depth() > 1 THEN
          RETURN OLD;
        END IF;
        -- Also allow if the parent construct no longer exists
        IF NOT EXISTS (SELECT 1 FROM evidence_constructs WHERE id = OLD.construct_id) THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'reviews are append-only - deletion not allowed';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_prevent_review_delete
      BEFORE DELETE ON evidence_construct_reviews
      FOR EACH ROW
      EXECUTE FUNCTION prevent_review_delete();
    `);

    console.log('Added DR-1 same-construct validation triggers and immutability protections');
  },

  async down(queryInterface) {
    // Drop all triggers
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_review_delete ON evidence_construct_reviews;
      DROP TRIGGER IF EXISTS trg_prevent_revision_delete ON evidence_construct_revisions;
      DROP TRIGGER IF EXISTS trg_prevent_review_update ON evidence_construct_reviews;
      DROP TRIGGER IF EXISTS trg_prevent_revision_content_update ON evidence_construct_revisions;
      DROP TRIGGER IF EXISTS trg_check_review_revision_construct ON evidence_construct_reviews;
      DROP TRIGGER IF EXISTS trg_check_accepted_revision_construct ON evidence_constructs;
      DROP TRIGGER IF EXISTS trg_check_latest_revision_construct ON evidence_constructs;
    `);

    // Drop all functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS prevent_review_delete();
      DROP FUNCTION IF EXISTS prevent_revision_delete();
      DROP FUNCTION IF EXISTS prevent_review_update();
      DROP FUNCTION IF EXISTS prevent_revision_content_update();
      DROP FUNCTION IF EXISTS check_review_revision_construct();
      DROP FUNCTION IF EXISTS check_accepted_revision_construct();
      DROP FUNCTION IF EXISTS check_latest_revision_construct();
    `);

    // Also drop legacy rules if they exist (from earlier migration versions)
    await queryInterface.sequelize.query(`
      DROP RULE IF EXISTS prevent_review_delete ON evidence_construct_reviews;
      DROP RULE IF EXISTS prevent_revision_delete ON evidence_construct_revisions;
    `);

    console.log('Removed DR-1 same-construct validation triggers and immutability protections');
  },
};
