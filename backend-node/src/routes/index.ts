import { Router } from 'express';
import authRoutes from './auth.routes.js';
import terminalRoutes from './terminal.routes.js';
import workspacesRoutes from './workspaces.routes.js';

const router = Router();

router.use('/api/auth', authRoutes);
router.use('/api/terminal', terminalRoutes);
router.use('/api/workspaces', workspacesRoutes);

export default router;
