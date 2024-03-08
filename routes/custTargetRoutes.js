import express from "express";
const router = express.Router();
import { custTargetController, upload } from "../controller/custTargetController.js"

// router.get('/se-list', custTargetController.getSeData);

router.get('/view', custTargetController.view);
router.post('/view', custTargetController.save);
router.get('/delete', custTargetController.delete);
router.get('/upload', custTargetController.targetImport);
router.post('/upload', upload.single('file'), custTargetController.targetUpload);
router.get('/target-report', custTargetController.targeReport);
router.get('/target-export-csv', custTargetController.targeExportCSV);

router.get('/view-stock', custTargetController.viewStock);
router.post('/view-stock', custTargetController.saveStock);
router.get('/delete-stock', custTargetController.deleteStock);

// router.get('/create', custTargetController.create);
// router.post('/create', custTargetController.save);
// router.get('/edit/:id', custTargetController.edit);
// router.post('/edit/:id', custTargetController.update);
// router.get('/delete/:id', custTargetController.delete);


export default router;