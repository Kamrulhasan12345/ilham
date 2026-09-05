import { Hono } from 'hono';
import { getUnverifiedTeachers, postVerifyTeacher } from './teachers.controller.js';

export const teachersRoutes = new Hono();

teachersRoutes.get('/unverified', getUnverifiedTeachers);
teachersRoutes.post('/:id/verify', postVerifyTeacher);
