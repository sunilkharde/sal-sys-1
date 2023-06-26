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


export default router;