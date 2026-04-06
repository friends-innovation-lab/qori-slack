const sequelize = require("../database");

const addChannelConfig = async (data) => {
  const { channel_id } = data;
  if (!channel_id) throw new Error('channel_id is required');

  try {
    const ChannelConfig = sequelize.models.ChannelConfig;

    let record = await ChannelConfig.findOne({ where: { channel_id } });

    if (record) {
      await record.update(data);           // 🔄 update existing
      console.log('🔄 updated', record.id);
    } else {
      record = await ChannelConfig.create(data); // ✨ create new
      console.log('✨ created', record.id);
    }

    return record;
  } catch (err) {
    console.error('addOrUpdateChannelConfig:', err);
    throw new Error('Failed to add or update channel config');
  }
};

const getChannelConfigByChannelId = async (channelId) => {
  try {
    const channelConfig = await sequelize.models.ChannelConfig.findOne({
      where: { channel_id: channelId }
    });
    console.log("🚀 ~ getChannelConfigByChannelId ~ channelConfig:", channelConfig);
    return channelConfig;
  } catch (error) {
    console.error("Error in getChannelConfigByChannelId:", error);
    throw new Error("Failed to fetch channel config");
  }
};


module.exports = {
  addChannelConfig,
  getChannelConfigByChannelId
};
