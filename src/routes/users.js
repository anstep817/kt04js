const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const validate = require('../middleware/validate');
const { needAuth, needRole } = require('../middleware/guard');

const router = express.Router();

const userView = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true
};

const createUser = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('USER', 'MODERATOR', 'ADMIN')
});

const updateUser = Joi.object({
  email: Joi.string().email(),
  name: Joi.string(),
  role: Joi.string().valid('USER', 'MODERATOR', 'ADMIN')
});

router.get('/', needAuth, needRole('MODERATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const total = await prisma.user.count();
    const data = await prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      select: userView
    });
    res.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', needAuth, needRole('MODERATOR', 'ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        ...userView,
        posts: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!user) {
      return res.status(404).json({ error: 'Нет пользователя' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/', needAuth, needRole('ADMIN'), validate(createUser), async (req, res, next) => {
  try {
    const passHash = await bcrypt.hash(req.body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        name: req.body.name,
        password: passHash,
        role: req.body.role || 'USER'
      },
      select: userView
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', needAuth, needRole('ADMIN'), validate(updateUser), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: req.body,
      select: userView
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', needAuth, needRole('ADMIN'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Нет пользователя' });
    }
    await prisma.post.deleteMany({ where: { authorId: id } });
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
