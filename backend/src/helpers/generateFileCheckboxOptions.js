/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable quotes */
// utils/slackBlocks.js
const generateFileCheckboxOptions = (fileOptionsArray) =>
  fileOptionsArray.map((item) => ({
    text: {
      type: "mrkdwn",
      text: item.label,
    },
    value: item.key,
  }));

module.exports = {
  generateFileCheckboxOptions,
};
