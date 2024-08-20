import express from "express";
const router = express.Router();
import dsrController from "../controller/dsrController.js"

router.get('/dsr-da', dsrController.getDailyAllow);
router.get('/dsr-ad', dsrController.getAllowData);
router.post('/save-leave-data', dsrController.saveLeaveData);
router.get('/create', dsrController.viewBlank);
router.post('/create', dsrController.create);
router.get('/view-pm', dsrController.viewPM);
router.get('/view', dsrController.viewAll);
router.get('/update/:dsr_date/:emp_id', dsrController.edit);
router.post('/update/:dsr_date/:emp_id', dsrController.update);
router.get('/delete/:dsr_date/:emp_id', dsrController.delete);
router.get('/post-pm', dsrController.postPM);
router.get('/post-edit', dsrController.postEdit);
router.post('/save-mon-allow', dsrController.saveMonAllow);
router.post('/post-mon-allow', dsrController.postMonAllow);
router.get('/report', dsrController.empReport);

// router.get('/export-excel', dsrController.exportExcel);
// router.get('/export-csv', dsrController.exportCSV);
router.get('/export-pdf', dsrController.exportPdf);

router.get('/report-atten', dsrController.reportAtten);
router.get('/atten-export-csv', dsrController.attenExportCSV);

router.post('/save-location', dsrController.saveLocation);
router.post('/uploadSelfie', dsrController.uploadSelfie);


const checkUserRole = (req, res, next) => {
    const userRole = res.locals.user.user_role;
    if (userRole && ["Admin", "Read"].includes(userRole)) {
        // If user has Admin or Read role, allow access to these routes
        next(); // Proceed to the next middleware/route handler
    } else {
        // If user does not have Admin or Read role, handle accordingly
        next("route"); // Skip to the next route (e.g., routes for regular users)
    }
};
// Define routes for Admin and Read roles
router.get('/report-loc', checkUserRole, dsrController.reportLocation);
router.get('/report-loc2', checkUserRole, dsrController.reportLocationTrack);

// Define routes for regular users
router.get('/report-loc', dsrController.reportLocationRegular);
router.get('/report-loc2', dsrController.reportLocationRegular);


router.get('/report-loc-emp', dsrController.reportLocationEmployee);

router.get('/loc-export-csv', dsrController.exportCSVLocationRegular);





export default router;