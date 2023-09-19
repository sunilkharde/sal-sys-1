import express from "express";
const router = express.Router();
import dsrController from "../controller/dsrController.js"

router.get('/dsr-da', dsrController.getDailyAllow);
router.get('/dsr-ad', dsrController.getAllowData);
router.post('/save-leave-data', dsrController.saveLeaveData);
router.get('/create', dsrController.viewBlank);
router.post('/create', dsrController.create);
router.get('/view-pm', dsrController.viewPM);
router.get('/view', dsrController.viewAll);
router.get('/update/:dsr_date/:emp_id', dsrController.edit);
router.post('/update/:dsr_date/:emp_id', dsrController.update);
router.get('/delete/:dsr_date/:emp_id', dsrController.delete);
router.get('/post-pm', dsrController.postPM);
router.get('/post-edit', dsrController.postEdit);
router.post('/save-mon-allow', dsrController.saveMonAllow);
router.post('/post-mon-allow', dsrController.postMonAllow);
router.get('/report', dsrController.empReport);

// router.get('/export-excel', dsrController.exportExcel);
// router.get('/export-csv', dsrController.exportCSV);
router.get('/export-pdf', dsrController.exportPdf);

router.get('/report-atten', dsrController.reportAtten);
router.get('/atten-export-csv', dsrController.attenExportCSV);

router.post('/save-location', dsrController.saveLocation);
router.get('/report-loc', dsrController.reportLocation);
router.get('/report-loc2', dsrController.reportLocationTrack);


export default router;