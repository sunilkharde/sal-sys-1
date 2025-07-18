import express from "express";
const router = express.Router();
import customerController from "../controller/customerController.js"
import { upload } from '../controller/customerController.js'; 

router.get('/se-list', customerController.getSeData);
router.get('/create', customerController.viewBlank);
router.post('/create', customerController.create);
router.get('/view', customerController.viewAll);
router.get('/update/:id', customerController.edit);
router.post('/update/:id', customerController.update);
router.get('/delete/:id', customerController.delete);

router.get('/view-info', customerController.viewAllInfo);
router.get('/update-info/:cust_id', customerController.editInfo);
// router.post('/update-info/:cust_id', customerController.updateInfo);
router.post('/update-info/:cust_id', upload.single('photo'), customerController.updateInfo);

// Add this to customerRoutes.js
router.get('/report', customerController.customerReport);
router.get('/report-data', customerController.getCustomerReportData);
router.get('/report-details/:cust_id', customerController.getCustomerDetails);
router.get('/search', customerController.searchCustomers);


// Benchmark
router.get('/benchmark', customerController.viewBenchmark);
router.get('/benchmark/add', customerController.viewAddBenchmark);
router.post('/benchmark/add', customerController.addBenchmark);
router.get('/benchmark/delete/:customer_id/:sr_no', customerController.deleteBenchmark);


export default router;