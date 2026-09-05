import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { NotFoundError } from '../../lib/errors.js';
import { listUnverifiedTeachers, verifyTeacher } from './teachers.model.js';

export async function getUnverifiedTeachers(c: Context) {
  const teachers = await listUnverifiedTeachers();
  return c.json({ data: teachers });
}

export async function postVerifyTeacher(c: Context) {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    throw new HTTPException(400, { message: 'invalid teacher id' });
  }
  const verified = await verifyTeacher(id);
  if (!verified) {
    throw new NotFoundError('teacher not found');
  }
  return c.json({ data: { user_id: id, is_verified: true } });
}
