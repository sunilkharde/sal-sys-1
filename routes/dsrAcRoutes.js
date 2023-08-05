import express from "express";
const router = express.Router();
import dsrAcController from "../controller/dsrAcController.js"

router.get('/view', dsrAcController.viewAll);//****/
router.get('/update/:year/:month/:emp_id', dsrAcController.edit);
router.post('/update/:year/:month/:emp_id', dsrAcController.update);

// router.get('/export-excel', dsrAcController.exportExcel);
router.get('/export-csv', dsrAcController.postExportCSV);
// router.get('/export-pdf', dsrAcController.exportPdf);


export default router;