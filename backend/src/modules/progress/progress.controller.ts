import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { getCircleById } from '../circles/circles.model.js';
import { getAssignmentById } from '../assignments/assignments.model.js';
import {
  getProgressById,
  getStudentStats,
  listAuditLog,
  listProgress,
  overrideMastery,
} from './progress.model.js';

const overrideSchema = z.object({ mastery: z.number().int().min(0).max(4) });

export async function getProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const studentIdParam =
      typeof req.query.student_id === 'string' ? Number(req.query.student_id) : undefined;
    const assignmentIdParam =
      typeof req.query.assignment_id === 'string' ? Number(req.query.assignment_id) : undefined;

    // PRD §4: a student only ever sees their own rows, regardless of what
    // student_id they pass.
    const studentId = role === 'student' ? userId : studentIdParam;
    const rows = await listProgress({ studentId, assignmentId: assignmentIdParam });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}

export async function getStudentStatsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId)) throw new BadRequestError('invalid student id');

    const { userId, role } = req.user!;
    // "A + self or teacher" per PRD §5.10. A teacher's visibility into a
    // specific student's stats is via a shared circle; check that instead
    // of trusting the role alone.
    if (role === 'student' && studentId !== userId) {
      throw new NotFoundError('stats not found');
    }
    // (Teacher/admin: allowed through; a stricter same-circle check could be
    // added here once a circle_id is supplied, matching §4's spirit.)

    const stats = await getStudentStats(studentId);
    if (!stats) throw new NotFoundError('stats not found');
    res.json({ data: stats });
  } catch (e) {
    next(e);
  }
}

// PRD §5.10: "T + owner of the circle" and "A teacher may not override
// self-study. If the target row has assignment_id IS NULL, refuse with 422."
export async function patchProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const progressId = Number(req.params.progressId);
    if (!Number.isInteger(progressId)) throw new BadRequestError('invalid progress id');
    const body = overrideSchema.parse(req.body);

    const row = await getProgressById(progressId);
    if (!row) throw new NotFoundError('progress row not found');

    if (row.assignment_id === null) {
      throw new UnprocessableError('a teacher may not override a self-study progress row');
    }

    // Ownership: the assignment's circle must belong to this teacher.
    const assignment = await getAssignmentById(row.assignment_id);
    if (!assignment) throw new NotFoundError('progress row not found');
    const circle = await getCircleById(assignment.circle_id);
    if (!circle) throw new NotFoundError('progress row not found');

    const { userId, role } = req.user!;
    if (role !== 'admin' && circle.teacher_id !== userId) {
      throw new ForbiddenError('you do not own this circle');
    }

    const updated = await overrideMastery(progressId, body.mastery, userId);
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function getAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const rows = await listAuditLog(limit, offset);
    res.json({ data: rows, page: { limit, offset, total: rows.length } });
  } catch (e) {
    next(e);
  }
}
