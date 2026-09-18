export type ReviewResult = 'pass' | 'partial' | 'fail';

export interface ReviewItemInput {
  hadith_id: number;
  result: ReviewResult;
}

export interface CreateReviewSessionInput {
  reviewerId: number | null;
  studentId: number;
  circleId: number | null;
  assignmentId: number | null;
  items: ReviewItemInput[];
}

export interface ReviewSessionRow {
  session_id: number;
  student_id: number;
  reviewer_id: number | null;
  circle_id: number | null;
  created_at: string;
}
