// routes/dsrAcRoutes.js

import express from "express";
const router = express.Router();
import dsrAcController from "../controller/dsrAcController.js"

router.get('/view', dsrAcController.viewAll);//****/
router.get('/update/:year/:month/:emp_id', dsrAcController.edit);
router.post('/update/:year/:month/:emp_id', dsrAcController.update);

// router.get('/export-excel', dsrAcController.exportExcel);
router.get('/export-csv', dsrAcController.postExportCSV);
// router.get('/export-pdf', dsrAcController.exportPdf);

router.get('/summary', dsrAcController.viewSummary);
router.get('/summary/graph-data', dsrAcController.getGraphData);
router.get('/summary/export-csv', dsrAcController.exportSummaryCSV);


export default router;