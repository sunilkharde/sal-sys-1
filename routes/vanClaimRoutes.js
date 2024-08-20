import express from "express";
const router = express.Router();
import vanClaimController from "../controller/vanClaimController.js"

router.get('/view', vanClaimController.view);

router.get('/create', vanClaimController.viewBlank);
// router.post('/create', vanClaimController.create);

router.get('/getRentData', vanClaimController.getRentData);

router.get('/update', vanClaimController.edit);
router.post('/update/:customer_id/:claim_month', vanClaimController.update);

router.get('/exportPDF', vanClaimController.exportPDF);

export default router;