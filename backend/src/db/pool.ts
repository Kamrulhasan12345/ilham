import { Pool } from 'pg';
import { DB } from '../config.js';


export const pool = new Pool({ ...DB, max: 10 });
