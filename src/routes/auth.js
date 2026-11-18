const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const prisma = require('../config/db');
const validate = require('../middleware/validate');
const { needAuth } = require('../middleware/guard');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

const router = express.Router();

const registerBody = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().required(),
  password: Joi.string().min(6).required()
});

const loginBody = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const limitLogin = rateLimit({
  windowMs: 900000,
  max: 10,
  message: { error: 'Много попыток входа, подождите' }
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

router.post('/register', validate(registerBody), async (req, res, next) => {
  try {
    const passHash = await bcrypt.hash(req.body.password, 10);
    const created = await prisma.user.create({
      data: {
        email: req.body.email,
        name: req.body.name,
        password: passHash
      }
    });
    res.status(201).json(publicUser(created));
  } catch (err) {
    next(err);
  }
});

router.post('/login', limitLogin, validate(loginBody), async (req, res, next) => {
  try {
    const found = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!found) {
      return res.status(401).json({ error: 'Неверные данные для входа' });
    }
    const ok = await bcrypt.compare(req.body.password, found.password);
    if (!ok) {
      return res.status(401).json({ error: 'Неверные данные для входа' });
    }
    res.cookie('refreshToken', signRefresh(found), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ accessToken: signAccess(found) });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res) => {
  const raw = req.cookies.refreshToken;
  if (!raw) {
    return res.status(401).json({ error: 'Нет refresh токена' });
  }
  try {
    const payload = verifyRefresh(raw);
    const found = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!found) {
      return res.status(401).json({ error: 'Нет refresh токена' });
    }
    res.json({ accessToken: signAccess(found) });
  } catch (err) {
    return res.status(401).json({ error: 'Нет refresh токена' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});

router.get('/me', needAuth, async (req, res, next) => {
  try {
    const found = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!found) {
      return res.status(401).json({ error: 'Войдите в аккаунт' });
    }
    res.json(publicUser(found));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
