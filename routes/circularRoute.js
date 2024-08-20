import express from "express";
const router = express.Router();
import circularController from "../controller/circularController.js"


 router.get('/create', circularController.viewBlank);
 router.post('/create', circularController.create);
 router.get('/view', circularController.viewAll);
 router.get('/update/:circular_date/:circular_id', circularController.edit);
 router.post('/update/:circular_date/:circular_id', circularController.update);




export default router;