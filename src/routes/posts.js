const express = require('express');
const Joi = require('joi');
const prisma = require('../config/db');
const validate = require('../middleware/validate');
const { needAuth } = require('../middleware/guard');

const router = express.Router();

const authorView = {
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    createdAt: true
  }
};

const createPost = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().allow(null, ''),
  published: Joi.boolean(),
  authorId: Joi.number().integer(),
  tags: Joi.array().items(Joi.string())
});

const updatePost = Joi.object({
  title: Joi.string(),
  content: Joi.string().allow(null, ''),
  published: Joi.boolean()
});

function ownOrStaff(user, post) {
  if (user.role === 'USER') {
    return post.authorId === user.id;
  }
  return user.role === 'MODERATOR' || user.role === 'ADMIN';
}

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const where = {};

    if (req.query.search) {
      const rows = await prisma.$queryRawUnsafe(
        'SELECT id FROM "Post" WHERE title LIKE ? COLLATE NOCASE',
        '%' + req.query.search + '%'
      );
      where.id = { in: rows.map((row) => Number(row.id)) };
    }
    if (req.query.published === 'true') {
      where.published = true;
    }
    if (req.query.published === 'false') {
      where.published = false;
    }
    if (req.query.authorId) {
      where.authorId = Number(req.query.authorId);
    }

    const total = await prisma.post.count({ where });
    const data = await prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { author: authorView, tags: true }
    });
    res.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: Number(req.params.id) },
      include: { author: authorView, tags: true }
    });
    if (!post) {
      return res.status(404).json({ error: 'Нет поста' });
    }
    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.post('/', needAuth, validate(createPost), async (req, res, next) => {
  try {
    const tags = req.body.tags || [];
    const post = await prisma.post.create({
      data: {
        title: req.body.title,
        content: req.body.content || null,
        published: req.body.published === true,
        authorId: req.user.id,
        tags: {
          connectOrCreate: tags.map((name) => ({
            where: { name },
            create: { name }
          }))
        }
      },
      include: { author: authorView, tags: true }
    });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', needAuth, validate(updatePost), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.post.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'Нет поста' });
    }
    if (!ownOrStaff(req.user, current)) {
      return res.status(403).json({ error: 'Нельзя менять чужой пост' });
    }
    const post = await prisma.post.update({
      where: { id },
      data: req.body,
      include: { author: authorView, tags: true }
    });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', needAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.post.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'Нет поста' });
    }
    if (!ownOrStaff(req.user, current)) {
      return res.status(403).json({ error: 'Нельзя удалить чужой пост' });
    }
    await prisma.post.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
