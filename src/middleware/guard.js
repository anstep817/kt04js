const { verifyAccess } = require('../utils/jwt');

function needAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Войдите в аккаунт' });
  }
  try {
    req.user = verifyAccess(parts[1]);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Войдите в аккаунт' });
  }
}

function needRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Запрещено' });
    }
    next();
  };
}

module.exports = { needAuth, needRole };
