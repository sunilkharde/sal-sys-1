import { executeQuery } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'public/shops/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        // We'll set the actual filename after we know the entry_no
        cb(null, `temp${ext}`);
    }
});
const upload = multer({ storage: storage });


class shopController {

    static viewBlank = async (req, res) => {
        res.render('shops/shop-create', {
            googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
            data: {},
            success: req.query.success === '1'
        });
    }    

    static create = async (req, res) => {
        const {
            entry_date, shop_name, owner_name, owner_mobile,
            email, mobile, address, city, pin, taluka, dist
        } = req.body;
        
        const loc_lat = req.body.loc_lat || null;
        const loc_lng = req.body.loc_lng || null;
        const loc_name = req.body.loc_name || null;
        const loc_add = req.body.loc_add || null;
        
        let photo_path = null;
        
        try {
            // Get next entry_no for the date
            const entryDate = entry_date || new Date().toISOString().split('T')[0];
            const maxEntryQuery = await executeQuery(
                'SELECT MAX(entry_no) AS max_entry FROM shop_records WHERE entry_date = ?', 
                [entryDate]
            );
            const nextEntryNo = (maxEntryQuery[0].max_entry || 0) + 1;
    
            // Process file upload if exists
            if (req.file) {
                const ext = path.extname(req.file.originalname);
                const newFilename = `${entryDate.replace(/-/g, '')}-${nextEntryNo}${ext}`;
                const oldPath = path.join('public/shops/', req.file.filename);
                const newPath = path.join('public/shops/', newFilename);

                // Rename the file
                fs.renameSync(oldPath, newPath);
                photo_path = `/shops/${newFilename}`;
            }
    
            // Insert record
            const sql = `INSERT INTO shop_records (
                entry_date, entry_no, loc_lat, loc_lng, loc_name, loc_add,
                c_at, c_by, email, mobile, shop_name, owner_name, owner_mobile,
                address, city, pin, taluka, dist, photo_path
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const params = [
                entryDate, nextEntryNo, loc_lat, loc_lng, loc_name, loc_add,
                req.user?.id || 1, // Assuming you have user auth
                email, mobile, shop_name, owner_name, owner_mobile,
                address, city, pin, taluka, dist, photo_path
            ];
    
            await executeQuery(sql, params);
            
            // res.redirect('/shop/create?success=1');
            res.render('shops/shop-create', { 
                googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
                data: {},
                showSuccessAlert: true  // New flag for alert
            });
        } catch (err) {
            console.error(err);
            // Handle error: log it and show an error message to the user
            if (req.file) {
                fs.unlinkSync(path.join('public/shops/', req.file.filename));
            }
            res.render('shops/shop-create', { 
                googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
                data: req.body,
                showErrorAlert: true,  // New flag for error alert
                photo_path: null
            });
        }
    }

}

export default shopController;
export { upload };