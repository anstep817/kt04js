require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  accessSecret: process.env.JWT_ACCESS_SECRET || 'stepan-access-key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'stepan-refresh-key'
};
