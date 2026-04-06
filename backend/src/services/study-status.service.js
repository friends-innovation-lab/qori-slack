const sequelize = require('../database');
const { Op } = require('sequelize');

const addStudyStatus = async (data) => {
  try {
    const { StudyStatus } = sequelize.models;

    // Extract file_name from URL if path is provided
    let fileName = data.file_name;
    if (!fileName && data.path) {
      const urlParts = data.path.split('/');
      fileName = urlParts[urlParts.length - 1]; // Get the last part of the URL
    }


    // Check if a record with this file_name already exists
    const existingRecord = await StudyStatus.findOne({
      where: { file_name: fileName },
    });

    if (existingRecord) {
      // Update existing record
      const updateData = {
        study_name: data.study_name,
        path: data.path,
        status: data.status,
        updated_at: new Date(),
      };

      // For approvals, clear reason and requested_by
      if (data.status === 'approve') {
        updateData.reason = null;
        updateData.requested_by = null;
        updateData.approved_by = data.approved_by;
      } else {
        // For other statuses, update relevant fields
        if (data.reason !== undefined) updateData.reason = data.reason;
        if (data.requested_by !== undefined) updateData.requested_by = data.requested_by;
        if (data.approved_by !== undefined) updateData.approved_by = data.approved_by;
      }

      const updatedRecord = await existingRecord.update(updateData);
      return updatedRecord;
    }

    // Create new record
    const createData = {
      ...data,
      path: data.path,
      file_name: fileName,
    };

    const record = await StudyStatus.create(createData);
    return record;
  } catch (err) {
    console.error('addStudyStatus error:', err);
    throw new Error('Failed to add or update study status');
  }
};

const getStudyStatusByStudyName = async (studyName) => {
  try {
    const { StudyStatus } = sequelize.models;

    const records = await StudyStatus.findAll({
      where: { study_name: studyName },
      order: [['updated_at', 'DESC']], // Most recent first
    });

    return records;
  } catch (err) {
    console.error('getStudyStatusByStudyName error:', err);
    throw new Error('Failed to fetch study status records');
  }
};

const getStudyStatusByFileName = async (fileName) => {
  try {
    const { StudyStatus } = sequelize.models;
    const records = await StudyStatus.findAll({
      where: { file_name: fileName },
      order: [['updated_at', 'DESC']],
    });
    return records;
  } catch (err) {
    console.error('getStudyStatusByFileName error:', err);
    throw new Error('Failed to fetch study status records by file name');
  }
};

const getStudyStatusById = async (id) => {
  try {
    const { StudyStatus } = sequelize.models;
    const record = await StudyStatus.findByPk(id);
    return record;
  } catch (err) {
    console.error('getStudyStatusById error:', err);
    throw new Error('Failed to fetch study status record by ID');
  }
};

const getStudyStakeholderGuide = async (studyName) => {
  try {
    const { StudyStatus } = sequelize.models;
    
    const whereClause = {
      file_name: {
        [Op.iLike]: '%stakeholder%' // Case-insensitive search for "stakeholder" in filename
      }
    };
    
    // Add study_name filter if provided
    if (studyName) {
      whereClause.study_name = studyName;
    }
    
    const records = await StudyStatus.findAll({
      where: whereClause,
      order: [['updated_at', 'DESC']], // Most recent first
    });
    
    return records;
  } catch (err) {
    console.error('getStudyStakeholderGuide error:', err);
    throw new Error('Failed to fetch study stakeholder guide');
  }
};

module.exports = { addStudyStatus, getStudyStatusByStudyName, getStudyStatusByFileName, getStudyStatusById, getStudyStakeholderGuide };
