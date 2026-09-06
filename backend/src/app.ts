import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { WEB_ORIGIN, NODE_ENV } from './config.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireRole } from './middleware/requireRole.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { collectionsRoutes } from './modules/collections/collections.routes.js';
import { chaptersRoutes } from './modules/chapters/chapters.routes.js';
import { hadithsRoutes } from './modules/hadiths/hadiths.routes.js';
import { narratorsRoutes } from './modules/narrators/narrators.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { teachersRoutes } from './modules/teachers/teachers.routes.js';
import { circlesRoutes } from './modules/circles/circles.routes.js';
import { studySetsRoutes } from './modules/studySets/studySets.routes.js';
import { assignmentsRoutes } from './modules/assignments/assignments.routes.js';
import { reviewsRoutes } from './modules/reviews/reviews.routes.js';
import { progressRoutes } from './modules/progress/progress.routes.js';
import { notesRoutes } from './modules/notes/notes.routes.js';
import { metaRoutes } from './modules/meta/meta.routes.js';
import { healthRoutes } from './modules/meta/health.routes.js';
import { studentsRoutes } from './modules/students/students.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
if (NODE_ENV === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/health', healthRoutes);

app.use('/auth', authRoutes);

app.use('/collections', requireAuth, collectionsRoutes);
app.use('/chapters', requireAuth, chaptersRoutes);
app.use('/hadiths', requireAuth, hadithsRoutes);
app.use('/narrators', requireAuth, narratorsRoutes);
app.use('/analytics', requireAuth, analyticsRoutes);
app.use('/teachers', requireAuth, requireRole('admin'), teachersRoutes);
app.use('/circles', requireAuth, circlesRoutes);
app.use('/students', requireAuth, studentsRoutes);
app.use('/study-sets', requireAuth, studySetsRoutes);
app.use('/assignments', requireAuth, assignmentsRoutes);
app.use('/review-sessions', requireAuth, reviewsRoutes);
app.use('/progress', requireAuth, progressRoutes);
app.use('/notes', requireAuth, notesRoutes);
app.use('/meta', requireAuth, metaRoutes);

app.use(notFound);
app.use(errorHandler);
