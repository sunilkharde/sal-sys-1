import express from "express";
const router = express.Router();
import empController from "../controller/empController.js"

router.get('/view', empController.viewAll);
router.get('/create', empController.viewBlank); // Create form
router.post('/create', empController.create);   // Create action
router.get('/update/:emp_id', empController.edit); // Edit form (now uses emp-form.hbs)
router.post('/update/:emp_id', empController.update); // Update action
router.get('/delete/:emp_id', empController.delete);

export default router;