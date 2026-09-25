import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, apiFetch } from './apiClient';

// One schema per endpoint and query key. zod strips unknown keys, so two
// pages parsing the same key with different schemas would hand each other
// trimmed rows out of the shared cache.

export const circleSchema = z.object({
  circle_id: z.number(),
  teacher_id: z.number(),
  name: z.string(),
  created_at: z.string(),
});
export type Circle = z.infer<typeof circleSchema>;

const statsSchema = z.object({
  student_id: z.number(),
  mastered_count: z.coerce.number(),
  review_count: z.coerce.number(),
});

const sessionSchema = z.object({
  session_id: z.number(),
  student_id: z.number(),
  reviewer_id: z.number().nullable(),
  circle_id: z.number().nullable(),
  created_at: z.string(),
});

const assignmentSchema = z.object({
  assignment_id: z.number(),
  circle_id: z.number(),
  study_set_id: z.number(),
  due_date: z.string(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

const progressSchema = z.object({
  // bigint arrives as a string over JSON; every other id here is integer.
  progress_id: z.coerce.number(),
  student_id: z.number(),
  hadith_id: z.number(),
  assignment_id: z.number().nullable(),
  mastery: z.number(),
  times_reviewed: z.coerce.number(),
  last_reviewed: z.string().nullable(),
});
export type Progress = z.infer<typeof progressSchema>;

export function useCircles() {
  return useQuery({
    queryKey: ['circles'],
    queryFn: () => apiFetch('/circles', z.array(circleSchema)),
  });
}

/** A fresh student has no stats row until the first progress insert, so a
    404 means zeros, not a failure. Students only. */
export function useStudentStats(userId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['students', userId, 'stats'],
    queryFn: async () => {
      try {
        return await apiFetch(`/students/${userId}/stats`, statsSchema);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: enabled && userId !== null,
  });
}

export function useReviewSessions() {
  return useQuery({
    queryKey: ['review-sessions'],
    queryFn: () => apiFetch('/review-sessions', z.array(sessionSchema)),
  });
}

export function useAssignments() {
  return useQuery({
    queryKey: ['assignments'],
    queryFn: () => apiFetch('/assignments', z.array(assignmentSchema)),
  });
}

/** The signed-in student's own progress rows. The endpoint refuses unscoped
    teacher calls, so pass enabled=false for teachers. */
export function useMyProgress(enabled: boolean) {
  return useQuery({
    queryKey: ['progress', 'me'],
    queryFn: () => apiFetch('/progress', z.array(progressSchema)),
    enabled,
  });
}

/** Most recently studied first. */
export function recentlyStudied(rows: Progress[], limit: number): Progress[] {
  return rows
    .filter((p) => p.last_reviewed !== null)
    .sort((a, b) => ((a.last_reviewed ?? '') < (b.last_reviewed ?? '') ? 1 : -1))
    .slice(0, limit);
}

/** app.progress.mastery runs 0..4; the stats count 3 and up as mastered. */
export const MASTERY_MAX = 4;
