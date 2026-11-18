const express = require('express');
const Joi = require('joi');
const prisma = require('../config/db');
const validate = require('../middleware/validate');
const { needAuth, needRole } = require('../middleware/guard');

const router = express.Router();

const roleBody = Joi.object({
  role: Joi.string().valid('USER', 'MODERATOR', 'ADMIN').required()
});

router.patch('/users/:id/role', needAuth, needRole('ADMIN'), validate(roleBody), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { role: req.body.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
