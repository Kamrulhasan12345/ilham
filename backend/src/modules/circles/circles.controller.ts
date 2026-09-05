import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  createCircle,
  listAllCircles,
  listCirclesForStudent,
  listCirclesForTeacher,
} from './circles.model.js';

const createCircleSchema = z.object({ name: z.string().min(1) });

export async function getCircles(c: Context) {
  const userId = c.get('userId') as number;
  const role = c.get('role') as string;
  if (role === 'admin') return c.json({ data: await listAllCircles() });
  if (role === 'teacher') return c.json({ data: await listCirclesForTeacher(userId) });
  return c.json({ data: await listCirclesForStudent(userId) });
}

export async function postCircle(c: Context) {
  const teacherId = c.get('userId') as number;
  const body = await c.req.json().catch(() => null);
  const parsed = createCircleSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid circle payload' });
  }
  const circle = await createCircle({ teacherId, name: parsed.data.name });
  return c.json({ data: circle }, 201);
}
