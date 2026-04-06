// middleware/validate.js

const { validationResult } = require('express-validator');

module.exports = function(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(422).json({
      message: 'Validation errors',
      errors: errors.array()
    });
  };
};
