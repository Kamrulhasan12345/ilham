import { Router } from 'express';
import { getUnverifiedTeachers, postVerifyTeacher } from './teachers.controller.js';

export const teachersRoutes = Router();

teachersRoutes.get('/unverified', getUnverifiedTeachers);
teachersRoutes.post('/:id/verify', postVerifyTeacher);
