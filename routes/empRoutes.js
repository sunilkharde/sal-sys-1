import express from "express";
const router = express.Router();
import empController from "../controller/empController.js"

// router.get('/se-list', empController.getSeData);
router.get('/create', empController.viewBlank);
router.post('/create', empController.create);
router.get('/view', empController.viewAll);
router.get('/update/:emp_id', empController.edit);
router.post('/update/:emp_id', empController.update);
router.get('/delete/:emp_id', empController.delete);

// router.get('/view-info', empController.viewAllInfo);
// router.get('/update-info/:cust_id', empController.editInfo);
// router.post('/update-info/:cust_id', empController.updateInfo);

export default router;