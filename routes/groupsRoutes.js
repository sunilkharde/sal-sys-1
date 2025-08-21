import express from 'express';
import groupsController from '../controller/groupsController.js';

const router = express.Router();

// Routes for Groups Management
router.get('/view-group', groupsController.showGroups);
router.post('/add', groupsController.addGroup);
router.post('/update', groupsController.updateGroup);
router.post('/delete', groupsController.deleteGroup);

export default router;