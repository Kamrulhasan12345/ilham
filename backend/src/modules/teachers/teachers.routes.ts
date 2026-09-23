import { Router } from 'express';
import { deleteVerifyTeacher, getUnverifiedTeachers, postVerifyTeacher } from './teachers.controller.js';

export const teachersRoutes = Router();

teachersRoutes.get('/unverified', getUnverifiedTeachers);
teachersRoutes.post('/:id/verify', postVerifyTeacher);
teachersRoutes.delete('/:id/verify', deleteVerifyTeacher);
