import express from 'express';

import sapSalesController from '../controller/sapSalesController.js';
import sapImportController from '../controller/sapImportController.js';

const router = express.Router();

// Existing routes
router.get('/process-sap-data', sapSalesController.showSalesProcessingPage);
router.post('/process-sap-data', sapSalesController.processSalesDataForAllBUs);

// New import routes
router.get('/import', sapImportController.showImportPage);
router.post('/import', sapImportController.importSalesData);
router.get('/import-history', sapImportController.getImportHistory);
// router.get('/import-details/:batch/:buId', sapImportController.getImportDetails);


export default router;