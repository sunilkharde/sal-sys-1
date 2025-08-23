import express from "express";
const router = express.Router();
import customerController from "../controller/customerController.js"
import { upload } from '../controller/customerController.js'; 
import customerGroupController from "../controller/customerGroup.js";


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
router.get('/view-report/:cust_id', customerController.viewInfoReport);

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
router.get('/benchmark/cities', customerController.filterCities);
router.get('/benchmark/customers', customerController.filterCustomers);    


// Customer grouping routes - FIXED
// Customer grouping routes - FIXED
router.get('/grouping', customerGroupController.grouping);
router.post('/create-group', customerGroupController.createGroup);
router.post('/add-to-group', customerGroupController.addToGroup);
router.post('/remove-from-group', customerGroupController.removeFromGroup);
router.post('/make-primary', customerGroupController.makePrimary);
router.post('/update-group', customerGroupController.updateGroup); // ADD THIS LINE
router.post('/remove-group', customerGroupController.removeGroup);


export default router;