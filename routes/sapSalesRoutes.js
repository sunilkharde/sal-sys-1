import express from "express";
const router = express.Router();
import SapSalesController from "../controller/sapSalesController.js";

// Display the sales processing page
router.get('/process-sap-data', SapSalesController.showSalesProcessingPage);

// Process sales data for all business units
router.post('/process-sap-data', SapSalesController.processSalesDataForAllBUs);

export default router;