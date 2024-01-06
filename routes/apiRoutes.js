import express from "express";
const router = express.Router();
import apiController from "../controller/apiController.js"

router.get('/customer-sp-mapping', apiController.customerSpMapping);
router.get('/employee-attendance/:attenMonth', apiController.employeeAttendance);
router.get('/employee-route-exp/:attenMonth', apiController.employeeRouteAndExp);
router.get('/employee-location/:attenMonth', apiController.employeeLocation);

// https://sales.malpani.com/api/customer-sp-mapping
// https://sales.malpani.com/api/employee-attendance/2023-10
// https://sales.malpani.com/api/employee-route-exp/2023-10
// https://sales.malpani.com/api/employee-location/2023-10

// router.post('/create', apiController.create);
// router.get('/view', apiController.viewAll);
// router.get('/update/:id', apiController.edit);
// router.post('/update/:id', apiController.update);
// router.get('/delete/:id', apiController.delete);

export default router;