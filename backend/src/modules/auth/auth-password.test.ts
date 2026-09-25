import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { bearer, fakeIp, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';

describe('POST /auth/change-password', () => {
  test('a correct change rotates the password: new logs in, old does not', async () => {
    const email = uniqueEmail('chpw');
    const { accessToken } = await registerAndGetToken(app, email, 'student');

    const changed = await request(app)
      .post('/auth/change-password')
      .set('x-forwarded-for', fakeIp())
      .set(bearer(accessToken))
      .send({ current_password: 'password123', new_password: 'newpassword456' });
    assert.equal(changed.status, 200);

    const loginNew = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', fakeIp())
      .send({ email, password: 'newpassword456' });
    assert.equal(loginNew.status, 200);

    const loginOld = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', fakeIp())
      .send({ email, password: 'password123' });
    assert.equal(loginOld.status, 401);
  });

  test('a wrong current password returns 401 and changes nothing', async () => {
    const email = uniqueEmail('chpwrong');
    const { accessToken } = await registerAndGetToken(app, email, 'student');

    const res = await request(app)
      .post('/auth/change-password')
      .set('x-forwarded-for', fakeIp())
      .set(bearer(accessToken))
      .send({ current_password: 'not-the-password', new_password: 'newpassword456' });
    assert.equal(res.status, 401);

    const loginOld = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', fakeIp())
      .send({ email, password: 'password123' });
    assert.equal(loginOld.status, 200);
  });

  test('a short new password is 400 and no token is 401', async () => {
    const email = uniqueEmail('chpshort');
    const { accessToken } = await registerAndGetToken(app, email, 'student');

    const short = await request(app)
      .post('/auth/change-password')
      .set('x-forwarded-for', fakeIp())
      .set(bearer(accessToken))
      .send({ current_password: 'password123', new_password: 'short' });
    assert.equal(short.status, 400);

    const anon = await request(app)
      .post('/auth/change-password')
      .set('x-forwarded-for', fakeIp())
      .send({ current_password: 'password123', new_password: 'newpassword456' });
    assert.equal(anon.status, 401);
  });
});
