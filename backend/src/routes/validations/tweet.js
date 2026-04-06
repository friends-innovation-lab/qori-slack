// routes/validations/tweet.js

const { body, query } = require('express-validator');

const listTweetsRules = [
  query('page').optional().isInt().toInt(),
  query('perPage').optional().isInt().toInt(),
];

const createTweetRules = [
  body('tweet').isLength({ max: 140 }).exists(),
];

module.exports = {
  listTweetsRules,
  createTweetRules,
};
