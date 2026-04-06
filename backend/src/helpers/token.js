// helpers/token.js

const jwt = require('jsonwebtoken');

function generateToken(data, expiresIn = '1h') {
  const options = { expiresIn };
  return jwt.sign(data, process.env.JWT_SECRET_KEY, options);
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET_KEY);
}

module.exports = {
  generateToken,
  verifyToken,
};
