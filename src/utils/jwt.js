const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccess(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    config.accessSecret,
    { expiresIn: '20m' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { id: user.id },
    config.refreshSecret,
    { expiresIn: '7d' }
  );
}

function verifyAccess(token) {
  return jwt.verify(token, config.accessSecret);
}

function verifyRefresh(token) {
  return jwt.verify(token, config.refreshSecret);
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
