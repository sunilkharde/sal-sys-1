import express from "express";
const router = express.Router();
import shopController from "../controller/shopController.js"
import { upload } from '../controller/shopController.js'; 


// View routes
router.get('/create', shopController.viewBlank);
router.get('/list', shopController.viewList);
router.get('/edit/:entry_date/:entry_no', shopController.viewEdit);
router.get('/view/:entry_date/:entry_no', shopController.viewSingle);

// Action routes
router.post('/create',  upload.single('photo'), shopController.create);
router.post('/update/:entry_date/:entry_no',  upload.single('photo'), shopController.update);
router.delete('/delete/:entry_date/:entry_no', shopController.delete);

// API/data routes
router.get('/api/list', shopController.apiList);
router.get('/api/count', shopController.apiCount);


export default router;