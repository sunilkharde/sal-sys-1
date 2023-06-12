import express from "express";
const router = express.Router();
import poController from "../controller/poController.js"

router.get('/bu-list', poController.getBuList);
router.get('/products-list', poController.getProductList);
router.get('/create', poController.viewBlank);
router.post('/create', poController.create);
router.get('/view', poController.viewAll);
router.get('/update/:po_date/:po_no', poController.edit);
router.post('/update/:po_date/:po_no', poController.update);
router.get('/delete/:po_date/:po_no', poController.delete);


export default router;