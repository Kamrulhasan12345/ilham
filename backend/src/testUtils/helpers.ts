import request from 'supertest';
import type { Application } from 'express';

export function uniqueEmail(tag: string): string {
  return `test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export function fakeIp(): string {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256,
  )}`;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export function extractCookie(res: request.Response, name = 'refresh_token'): string {
  const raw = res.headers['set-cookie'];
  if (!raw) throw new Error(`expected a Set-Cookie header for ${name}`);
  const cookies = Array.isArray(raw) ? raw : [raw];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  if (!match) throw new Error(`expected a Set-Cookie header named ${name}`);
  return match.split(';')[0];
}

export async function registerAndGetToken(
  app: Application,
  email: string,
  role: 'student' | 'teacher',
): Promise<{ accessToken: string; cookie: string }> {
  const res = await request(app)
    .post('/auth/register')
    .set('x-forwarded-for', fakeIp())
    .send({ email, password: 'password123', full_name: `${role} Person`, role });
  if (res.status !== 201) {
    throw new Error(`register failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { accessToken: res.body.data.accessToken, cookie: extractCookie(res) };
}

export async function loginAndGetToken(app: Application, email: string, password = 'password123'): Promise<string> {
  const res = await request(app)
    .post('/auth/login')
    .set('x-forwarded-for', fakeIp())
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
}
