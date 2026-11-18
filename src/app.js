const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');
const adminRouter = require('./routes/admin');

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

app.use('/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Такого адреса нет' });
});

app.use(errorHandler);

module.exports = app;
