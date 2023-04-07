import express from "express";
const router = express.Router();
import dealerPayController from "../controller/dealerPayController.js"

// router.get('/dealerPay-list', dealerPayController.getProductList);
router.get('/create', dealerPayController.viewBlank);
router.post('/create', dealerPayController.create);
router.get('/view', dealerPayController.viewAll);
router.get('/update/:doc_date/:doc_no', dealerPayController.edit);
router.post('/update/:doc_date/:doc_no', dealerPayController.update);
router.get('/delete/:doc_date/:doc_no', dealerPayController.delete);

router.get('/export-excel', dealerPayController.exportExcel);
router.get('/export-csv', dealerPayController.exportCSV);
router.get('/export-pdf', dealerPayController.exportPdf);

router.get('/view-bal', dealerPayController.viewBalance);


export default router;