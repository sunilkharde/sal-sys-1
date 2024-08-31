import express from "express";
const router = express.Router();
import consumerController from "../controller/consumerController.js"

router.get('/create', consumerController.viewBlank);
router.post('/create', consumerController.create);
router.get('/view', consumerController.viewAll);
router.get('/update/:id', consumerController.edit);
router.post('/update/:id', consumerController.update);
router.get('/delete/:id', consumerController.delete);

// router.get('/view-info', consumerController.viewAllInfo);
// router.get('/update-info/:cust_id', consumerController.editInfo);
// router.post('/update-info/:cust_id', consumerController.updateInfo);

export default router;