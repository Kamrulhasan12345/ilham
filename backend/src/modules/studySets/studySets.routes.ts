import { Router } from 'express';
import {
  deleteStudySetHandler,
  deleteStudySetItem,
  getStudySet,
  getStudySets,
  patchStudySet,
  postStudySet,
  postStudySetItem,
} from './studySets.controller.js';

export const studySetsRoutes = Router();

studySetsRoutes.get('/', getStudySets);
studySetsRoutes.post('/', postStudySet);
studySetsRoutes.get('/:id', getStudySet);
studySetsRoutes.patch('/:id', patchStudySet);
studySetsRoutes.delete('/:id', deleteStudySetHandler);
studySetsRoutes.post('/:id/items', postStudySetItem);
studySetsRoutes.delete('/:id/items/:hid', deleteStudySetItem);
