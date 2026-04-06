const sequelize = require('../database');

class ResearchPlanService {
  constructor() {
    this.ResearchPlan = sequelize.models.ResearchPlan;
    this.ResearchStudy = sequelize.models.ResearchStudy;
  }

  /**
   * Create a new research plan
   * @param {Object} planData - The plan data to create
   * @returns {Promise<Object>} The created plan
   */
  async createResearchPlan(planData) {
    try {
      // Handle case where study_id might be null
      if (!planData.study_id) {
        // Try to find the study by name if study_id is not provided
        const study = await this.ResearchStudy.findOne({
          where: { name: planData.study_name }
        });
        if (study) {
          planData.study_id = study.id;
        }
      }

      // Set manual timestamps
      const now = new Date();
      planData.created_at = now;
      planData.updated_at = now;

      const plan = await this.ResearchPlan.create(planData);
      return plan;
    } catch (error) {
      console.error('Error creating research plan:', error);
      throw new Error(`Failed to create research plan: ${error.message}`);
    }
  }

  /**
        * Get a research plan by ID
   * @param {number} id - The plan ID
   * @returns {Promise<Object>} The research plan
   */
  async getResearchPlanById(id) {
    try {
      const plan = await this.ResearchPlan.findByPk(id, {
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path', 'description']
          }
        ]
      });

      if (!plan) {
        throw new Error('Research plan not found');
      }

      return plan;
    } catch (error) {
      console.error('Error getting research plan by ID:', error);
      throw new Error(`Failed to get research plan: ${error.message}`);
    }
  }

  /**
   * Get research plans by study ID
   * @param {number} studyId - The study ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of research plans
   */
  async getResearchPlansByStudyId(studyId, options = {}) {
    try {
      const where = { study_id: studyId };

      const plans = await this.ResearchPlan.findAll({
        where,
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return plans;
    } catch (error) {
      console.error('Error getting research plans by study ID:', error);
      throw new Error(`Failed to get research plans: ${error.message}`);
    }
  }

  /**
   * Get research plans by user ID
   * @param {string} userId - The Slack user ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of research plans
   */
  async getResearchPlansByUserId(userId, options = {}) {
    try {
      const where = { created_by: userId };

      const plans = await this.ResearchPlan.findAll({
        where,
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return plans;
    } catch (error) {
      console.error('Error getting research plans by user ID:', error);
      throw new Error(`Failed to get research plans: ${error.message}`);
    }
  }

  /**
   * Get research plans by exact study name match
   * @param {string} studyName - The exact name of the research study
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of research plans
   */
  async getResearchPlansByStudyName(studyName, options = {}) {
    try {
      if (!studyName) {
        throw new Error('Study name is required');
      }

      const where = {
        study_name: studyName
      };

      const plans = await this.ResearchPlan.findAll({
        where,
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path', 'description']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return plans;
    } catch (error) {
      console.error('Error getting research plans by exact study name:', error);
      throw new Error(`Failed to get research plans by exact study name: ${error.message}`);
    }
  }

  /**
   * Search research plans
   * @param {Object} searchCriteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of matching research plans
   */
  async searchResearchPlans(searchCriteria, options = {}) {
    try {
      const where = {};

      // Add search criteria
      if (searchCriteria.study_name) {
        where.study_name = { [sequelize.Op.iLike]: `%${searchCriteria.study_name}%` };
      }

      if (searchCriteria.filename) {
        where.filename = { [sequelize.Op.iLike]: `%${searchCriteria.filename}%` };
      }

      const plans = await this.ResearchPlan.findAll({
        where,
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return plans;
    } catch (error) {
      console.error('Error searching research plans:', error);
      throw new Error(`Failed to search research plans: ${error.message}`);
    }
  }

  /**
   * Update a research plan
   * @param {number} id - The plan ID
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object>} The updated plan
   */
  async updateResearchPlan(id, updateData) {
    try {
      const plan = await this.ResearchPlan.findByPk(id);

      if (!plan) {
        throw new Error('Research plan not found');
      }

      // Set updated_at timestamp
      updateData.updated_at = new Date();

      // Update the plan
      await plan.update(updateData);

      return plan;
    } catch (error) {
      console.error('Error updating research plan:', error);
      throw new Error(`Failed to update research plan: ${error.message}`);
    }
  }

  /**
   * Delete a research plan
   * @param {number} id - The plan ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteResearchPlan(id) {
    try {
      const plan = await this.ResearchPlan.findByPk(id);

      if (!plan) {
        throw new Error('Research plan not found');
      }

      await plan.destroy();
      return true;
    } catch (error) {
      console.error('Error deleting research plan:', error);
      throw new Error(`Failed to delete research plan: ${error.message}`);
    }
  }

  /**
   * Get all research plans
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of all research plans
   */
  async getAllResearchPlans(options = {}) {
    try {
      const plans = await this.ResearchPlan.findAll({
        include: [
          {
            model: this.ResearchStudy,
            as: 'study',
            attributes: ['id', 'name', 'path', 'description']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: options.limit || 100,
        offset: options.offset || 0
      });

      return plans;
    } catch (error) {
      console.error('Error getting all research plans:', error);
      throw new Error(`Failed to get research plans: ${error.message}`);
    }
  }
}

module.exports = new ResearchPlanService();
