import express from "express";
const router = express.Router();
import shopController from "../controller/shopController.js"
import { upload } from '../controller/shopController.js'; 

router.get('/create', shopController.viewBlank);
router.post('/create', upload.single('photo'), shopController.create);

export default router;