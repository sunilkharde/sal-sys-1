import express from "express";
const router = express.Router();
import custDetailController from "../controller/custDetailController.js"

router.get('/create', custDetailController.viewBlank);
router.post('/create', custDetailController.create);
router.get('/view', custDetailController.viewAll);
router.get('/update/:customer_id', custDetailController.edit);
router.post('/update/:customer_id', custDetailController.update);
router.get('/delete/:customer_id/:sr_no', custDetailController.delete);

export default router;