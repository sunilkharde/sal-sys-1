import express from "express";
const router = express.Router();
import dsrTpController from "../controller/dsrTpController.js"

router.get('/dsr-da', dsrTpController.getDailyAllow);
router.get('/dsr-ad', dsrTpController.getAllowData);
router.post('/save-leave-data', dsrTpController.saveLeaveData);
router.get('/create', dsrTpController.viewBlank);
router.post('/create', dsrTpController.create);
router.get('/view-pm', dsrTpController.viewPM);//*****/
router.get('/view', dsrTpController.viewAll);
router.get('/update/:year/:month/:emp_id', dsrTpController.edit);//*****/
router.post('/update/:year/:month/:emp_id', dsrTpController.update);//*****/
router.get('/get-tp/:year/:month/:emp_id', dsrTpController.getTP);//*****/
router.get('/delete/:dsr_date/:emp_id', dsrTpController.delete);
router.get('/post-pm', dsrTpController.postPM);
router.get('/post-edit', dsrTpController.postEdit);
router.post('/save-mon-allow', dsrTpController.saveMonAllow);
router.post('/post-mon-allow', dsrTpController.postMonAllow);
router.get('/report', dsrTpController.empReport);

// router.get('/export-excel', dsrTpController.exportExcel);
// router.get('/export-csv', dsrTpController.exportCSV);
router.get('/export-pdf', dsrTpController.exportPdf);

router.get('/report-atten', dsrTpController.reportAtten);
router.get('/atten-export-csv', dsrTpController.attenExportCSV);


export default router;