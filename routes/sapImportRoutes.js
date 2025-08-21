import express from 'express';

import sapImportController from '../controller/sapImportController.js';

const router = express.Router();

// Routes for SAP Sales Data Import
router.get('/import', sapImportController.showImportPage);
router.post('/import', sapImportController.importSalesData);
router.get('/import-history', sapImportController.getImportHistory);
router.get('/import-details/:importBatch/:buId?', sapImportController.showImportDetails);

// Route for SAP Materials Group Import
// router.get('/view-group', sapImportController.showMaterialsGroup);


export default router;