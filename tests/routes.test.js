process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_ACCESS_SECRET = 'stepan-access-test';
process.env.JWT_REFRESH_SECRET = 'stepan-refresh-test';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prismaDir = path.join(__dirname, '..', 'prisma');
for (const name of ['test.db', 'test.db-journal']) {
  const file = path.join(prismaDir, name);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  stdio: 'inherit',
  env: process.env
});

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

beforeEach(async () => {
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function addUser(email, name) {
  const res = await request(app).post('/auth/register').send({
    email,
    name,
    password: '123456'
  });
  return res;
}

async function enter(email) {
  const res = await request(app).post('/auth/login').send({
    email,
    password: '123456'
  });
  return res;
}

test('register works', async () => {
  const res = await addUser('stepan@mail.com', 'Stepan');
  expect(res.status).toBe(201);
  expect(res.body.email).toBe('stepan@mail.com');
  expect(res.body.password).toBeUndefined();
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-frame-options']).toBeTruthy();
});

test('same email cannot register twice', async () => {
  await addUser('copy@mail.com', 'Copy');
  const res = await addUser('copy@mail.com', 'Copy');
  expect(res.status).toBe(400);
});

test('login works', async () => {
  await addUser('in@mail.com', 'In');
  const res = await enter('in@mail.com');
  expect(res.status).toBe(200);
  expect(res.body.accessToken).toBeTruthy();
  expect(String(res.headers['set-cookie'])).toContain('HttpOnly');
});

test('wrong password is rejected', async () => {
  await addUser('pass@mail.com', 'Pass');
  const res = await request(app).post('/auth/login').send({
    email: 'pass@mail.com',
    password: '654321'
  });
  expect(res.status).toBe(401);
});

test('protected route works with token', async () => {
  await addUser('self@mail.com', 'Self');
  const login = await enter('self@mail.com');
  const res = await request(app)
    .get('/auth/me')
    .set('Authorization', 'Bearer ' + login.body.accessToken);
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Self');
});

test('protected route fails without token', async () => {
  const res = await request(app).get('/auth/me');
  expect(res.status).toBe(401);
});

test('owner deletes own post', async () => {
  await addUser('writer@mail.com', 'Writer');
  const login = await enter('writer@mail.com');
  const token = login.body.accessToken;
  const post = await request(app)
    .post('/api/posts')
    .set('Authorization', 'Bearer ' + token)
    .send({ title: 'Hello' });
  const res = await request(app)
    .delete('/api/posts/' + post.body.id)
    .set('Authorization', 'Bearer ' + token);
  expect(post.status).toBe(201);
  expect(res.status).toBe(204);
});

test('another user gets 403', async () => {
  await addUser('author@mail.com', 'Author');
  await addUser('other@mail.com', 'Other');
  const author = await enter('author@mail.com');
  const other = await enter('other@mail.com');
  const post = await request(app)
    .post('/api/posts')
    .set('Authorization', 'Bearer ' + author.body.accessToken)
    .send({ title: 'Mine' });
  const res = await request(app)
    .delete('/api/posts/' + post.body.id)
    .set('Authorization', 'Bearer ' + other.body.accessToken);
  expect(res.status).toBe(403);
});

test('refresh cookie gives a new access token', async () => {
  await addUser('fresh@mail.com', 'Fresh');
  const login = await enter('fresh@mail.com');
  const refresh = await request(app)
    .post('/auth/refresh')
    .set('Cookie', login.headers['set-cookie']);
  expect(refresh.status).toBe(200);
  expect(refresh.body.accessToken).toBeTruthy();
  const logout = await request(app)
    .post('/auth/logout')
    .set('Cookie', login.headers['set-cookie']);
  expect(logout.status).toBe(200);
});
