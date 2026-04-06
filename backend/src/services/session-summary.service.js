const sequelize = require('../database');

class SessionSummaryService {
  constructor() {
    this.SessionSummary = sequelize.models.SessionSummary;
    this.ResearchStudy = sequelize.models.ResearchStudy;
  }

  /**
   * Create or update a session summary
   * If a summary with the same study_id and filename exists, it will be updated
   * @param {Object} summaryData - The summary data to create or update
   * @returns {Promise<Object>} The created or updated summary
   */
  async createOrUpdateSessionSummary(summaryData) {
    try {
      // Handle case where study_id might be null
      if (!summaryData.study_id) {
        // Try to find the study by name if study_id is not provided
        const study = await this.ResearchStudy.findOne({
          where: { name: summaryData.study_name }
        });
        if (study) {
          summaryData.study_id = study.id;
        } else {
          throw new Error(`Study not found: ${summaryData.study_name}`);
        }
      }

      // Check if a summary with the same study_id and filename already exists
      const existingSummary = await this.SessionSummary.findOne({
        where: {
          study_id: summaryData.study_id,
          filename: summaryData.filename
        }
      });

      // Set manual timestamps
      const now = new Date();
      summaryData.updated_at = now;

      if (existingSummary) {
        // Update existing summary
        await existingSummary.update({
          ...summaryData,
          updated_at: now
        });
        return existingSummary;
      } else {
        // Create new summary
        summaryData.created_at = now;
        const summary = await this.SessionSummary.create(summaryData);
        return summary;
      }
    } catch (error) {
      console.error('Error creating/updating session summary:', error);
      throw new Error(`Failed to create/update session summary: ${error.message}`);
    }
  }

  /**
   * Get a session summary by ID
   * @param {number} id - The summary ID
   * @returns {Promise<Object>} The session summary
   */
  async getSessionSummaryById(id) {
    try {
      const summary = await this.SessionSummary.findByPk(id, {
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path', 'description']
          }
        ]
      });

      if (!summary) {
        throw new Error('Session summary not found');
      }

      return summary;
    } catch (error) {
      console.error('Error getting session summary by ID:', error);
      throw new Error(`Failed to get session summary: ${error.message}`);
    }
  }

  /**
   * Get session summaries by study ID
   * @param {number} studyId - The study ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of session summaries
   */
  async getSessionSummariesByStudyId(studyId, options = {}) {
    try {
      const where = { study_id: studyId };

      const summaries = await this.SessionSummary.findAll({
        where,
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path']
          }
        ],
        order: [
          ['created_at', 'DESC']
        ],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return summaries;
    } catch (error) {
      console.error('Error getting session summaries by study ID:', error);
      throw new Error(`Failed to get session summaries: ${error.message}`);
    }
  }

  /**
   * Get session summaries by study name
   * @param {string} studyName - The study name
   * @returns {Promise<Array>} Array of session summaries
   */
  async getSessionSummariesByStudyName(studyName) {
    try {
      const summaries = await this.SessionSummary.findAll({
        where: { study_name: studyName },
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path']
          }
        ],
        order: [
          ['created_at', 'DESC']
        ]
      });

      return summaries;
    } catch (error) {
      console.error('Error getting session summaries by study name:', error);
      throw new Error(`Failed to get session summaries: ${error.message}`);
    }
  }

  /**
   * Get all session summaries
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of session summaries
   */
  async getAllSessionSummaries(options = {}) {
    try {
      const summaries = await this.SessionSummary.findAll({
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path']
          }
        ],
        order: [
          ['created_at', 'DESC']
        ],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return summaries;
    } catch (error) {
      console.error('Error getting all session summaries:', error);
      throw new Error(`Failed to get session summaries: ${error.message}`);
    }
  }

  /**
   * Delete a session summary by ID
   * @param {number} id - The summary ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteSessionSummary(id) {
    try {
      const summary = await this.SessionSummary.findByPk(id);

      if (!summary) {
        throw new Error('Session summary not found');
      }

      await summary.destroy();
      return true;
    } catch (error) {
      console.error('Error deleting session summary:', error);
      throw new Error(`Failed to delete session summary: ${error.message}`);
    }
  }
}

module.exports = new SessionSummaryService();

