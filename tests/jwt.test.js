process.env.JWT_ACCESS_SECRET = 'stepan-access-test';
process.env.JWT_REFRESH_SECRET = 'stepan-refresh-test';

const { signAccess, verifyAccess } = require('../src/utils/jwt');

test('token has user role', () => {
  const token = signAccess({ id: 3, role: 'ADMIN', email: 's@mail.com' });
  const payload = verifyAccess(token);
  expect(payload.id).toBe(3);
  expect(payload.role).toBe('ADMIN');
});
