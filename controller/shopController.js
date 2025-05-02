import { executeQuery } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { format } from 'date-fns';

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
// const upload = multer({ storage: storage });
const upload = multer({
    storage: storage,
    limits: { fileSize: 1 * 1024 * 1024 } // 1MB limit
});


class shopController {


    // View blank form
    static viewBlank = async (req, res) => {
        res.render('shops/shop-create', {
            googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
            data: {},
            success: req.query.success === '1'
        });
    }

    // Create new shop record
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

            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

            const params = [
                entryDate, nextEntryNo, loc_lat, loc_lng, loc_name, loc_add,
                c_by, // Assuming you have user auth
                email, mobile, shop_name, owner_name, owner_mobile,
                address, city, pin, taluka, dist, photo_path
            ];

            await executeQuery(sql, params);

            res.redirect('/shop/list');
            // res.render('shops/shop-create', {
            //     googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
            //     data: {},
            //     showSuccessAlert: true  // New flag for alert
            // });

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

    // View shop list with pagination
    static viewList = async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;

            // Get search parameters
            const { shop_name, owner_name, owner_mobile, city } = req.query;
        
            // Prepare user IDs - current user or fallback to 1 (admin)
            const userIds = [res.locals.user?.user_id || 1, 1];
            let whereClause = ' AND c_by IN (?)';
            const params = [userIds];

            if (shop_name) {
                whereClause += ' AND shop_name LIKE ?';
                params.push(`%${shop_name}%`);
            }
            if (owner_name) {
                whereClause += ' AND owner_name LIKE ?';
                params.push(`%${owner_name}%`);
            }
            if (owner_mobile) {
                whereClause += ' AND owner_mobile LIKE ?';
                params.push(`%${owner_mobile}%`);
            }
            if (city) {
                whereClause += ' AND city LIKE ?';
                params.push(`%${city}%`);
            }

            // Get total count
            const countQuery = `SELECT COUNT(*) AS total FROM shop_records WHERE 1=1 ${whereClause}`;
            const countResult = await executeQuery(countQuery, params);
            const total = countResult[0].total;
            const totalPages = Math.ceil(total / limit);

            // Get paginated data
            const dataQuery = `SELECT * FROM shop_records WHERE 1=1 ${whereClause} 
                         ORDER BY entry_date DESC, entry_no DESC LIMIT ? OFFSET ?`;
            const dataParams = [...params, limit, offset];
            const shops = await executeQuery(dataQuery, dataParams);

            res.render('shops/shop-list', {
                shops,
                pagination: {
                    current: page,
                    prev: page > 1 ? page - 1 : null,
                    next: page < totalPages ? page + 1 : null,
                    total: totalPages,
                    pages: Array.from({ length: Math.min(5, totalPages) }, (_, i) => ({
                        number: i + 1,
                        active: (i + 1) === page
                    }))
                },
                query: req.query
            });
        } catch (err) {
            console.error('Error fetching shop list:', err);
            res.render('shops/shop-list', {
                shops: [],
                pagination: {},
                error: 'Failed to load shop records'
            });
        }
    }

    // View single shop record
    static viewSingle = async (req, res) => {
        try {
            const { entry_date, entry_no } = req.params;

            // console.log(`Viewing shop record - Date: ${entry_date}, No: ${entry_no}`);

            const query = 'SELECT * FROM shop_records WHERE entry_date = ? AND entry_no = ?';
            const result = await executeQuery(query, [entry_date, parseInt(entry_no)]);

            if (result.length === 0) {
                return res.status(404).render('error', {
                    message: 'Shop record not found'
                });
            }

            // Debug: Log the view path being used
            const viewPath = path.join(process.cwd(), 'views', 'shops', 'shop-view.hbs');
            // console.log(`Looking for view at: ${viewPath}`);

            if (!fs.existsSync(viewPath)) {
                throw new Error(`View template not found at: ${viewPath}`);
            }

            res.render('shops/shop-view', {
                shop: result[0],
                googleApiKey: process.env.GOOGLE_MAPS_API_KEY
            });
        } catch (err) {
            console.error('Error in viewSingle:', err);
            res.status(500).render('error', {
                message: err.message || 'Failed to load shop record'
            });
        }
    }

    // View edit form
    static viewEdit = async (req, res) => {
        try {
            const { entry_date, entry_no } = req.params;

            // Debugging: Log the received parameters
            // console.log(`Editing shop record - Date: ${entry_date}, No: ${entry_no}`);

            const query = 'SELECT * FROM shop_records WHERE entry_date = ? AND entry_no = ?';
            const result = await executeQuery(query, [entry_date, parseInt(entry_no)]); // Ensure entry_no is a number

            if (result.length === 0) {
                console.log(`No record found for Date: ${entry_date}, No: ${entry_no}`);
                return res.status(404).render('error', {
                    message: 'Shop record not found'
                });
            }

            res.render('shops/shop-edit', {
                shop: result[0],
                googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
                showSuccessAlert: req.query.success === '1'
            });
        } catch (err) {
            console.error('Error fetching shop record for edit:', err);
            res.status(500).render('error', {
                message: 'Failed to load shop record for editing'
            });
        }
    }

    // Update shop record
    static update = async (req, res) => {
        const { entry_date, entry_no } = req.params;
        const {
            shop_name, owner_name, owner_mobile, email, mobile,
            address, city, pin, taluka, dist, removePhoto
        } = req.body;

        const loc_lat = req.body.loc_lat || null;
        const loc_lng = req.body.loc_lng || null;
        const loc_name = req.body.loc_name || null;
        const loc_add = req.body.loc_add || null;

        try {
            // Get current photo path
            const currentQuery = 'SELECT photo_path FROM shop_records WHERE entry_date = ? AND entry_no = ?';
            const currentResult = await executeQuery(currentQuery, [entry_date, entry_no]);
            let photo_path = currentResult[0]?.photo_path || null;

            // Handle photo update/removal
            if (removePhoto === 'on' && photo_path) {
                // Remove existing photo file
                const filePath = path.join('public', photo_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                photo_path = null;
            }

            if (req.file) {
                // Remove old photo if exists
                if (photo_path) {
                    const oldPath = path.join('public', photo_path);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }

                // Save new photo
                const ext = path.extname(req.file.originalname);
                const newFilename = `${entry_date.replace(/-/g, '')}-${entry_no}${ext}`;
                const oldPath = path.join('public/shops/', req.file.filename);
                const newPath = path.join('public/shops/', newFilename);

                fs.renameSync(oldPath, newPath);
                photo_path = `/shops/${newFilename}`;
            }

            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

            // Update record
            const sql = `UPDATE shop_records SET
                loc_lat = ?, loc_lng = ?, loc_name = ?, loc_add = ?,
                u_at = CURRENT_TIMESTAMP(), u_by = ?,
                email = ?, mobile = ?, shop_name = ?, owner_name = ?, owner_mobile = ?,
                address = ?, city = ?, pin = ?, taluka = ?, dist = ?, photo_path = ?
                WHERE entry_date = ? AND entry_no = ?`;

            const params = [
                loc_lat, loc_lng, loc_name, loc_add,
                u_by, // Assuming you have user auth
                email, mobile, shop_name, owner_name, owner_mobile,
                address, city, pin, taluka, dist, photo_path,
                entry_date, entry_no
            ];

            await executeQuery(sql, params);

            res.redirect('/shop/list');
            // res.redirect(`/shop/edit/${entry_date}/${entry_no}?success=1`);
        } catch (err) {
            console.error('Error updating shop:', err);
            if (req.file) {
                fs.unlinkSync(path.join('public/shops/', req.file.filename));
            }
            res.render('shops/shop-edit', {
                shop: req.body,
                googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
                showErrorAlert: true
            });
        }
    }

    // Delete shop record
    static delete = async (req, res) => {
        const { entry_date, entry_no } = req.params;

        if (res.locals.user.user_role !== "Admin") {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        try {
            // Get photo path if exists
            const query = 'SELECT photo_path FROM shop_records WHERE entry_date = ? AND entry_no = ?';
            const result = await executeQuery(query, [entry_date, entry_no]);

            if (result.length > 0 && result[0].photo_path) {
                const filePath = path.join('public', result[0].photo_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Delete record
            await executeQuery(
                'DELETE FROM shop_records WHERE entry_date = ? AND entry_no = ?',
                [entry_date, entry_no]
            );

            res.json({ success: true });
        } catch (err) {
            console.error('Error deleting shop:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }

    // API: Get shop list (for AJAX)
    static apiList = async (req, res) => {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (page - 1) * limit;

            let query = 'SELECT * FROM shop_records';
            let params = [];

            if (search) {
                query += ' WHERE shop_name LIKE ? OR owner_name LIKE ? OR city LIKE ?';
                params = [`%${search}%`, `%${search}%`, `%${search}%`];
            }

            query += ' ORDER BY entry_date DESC, entry_no DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const shops = await executeQuery(query, params);
            res.json({ success: true, data: shops });
        } catch (err) {
            console.error('API Error fetching shops:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }

    // API: Get shop count
    static apiCount = async (req, res) => {
        try {
            const result = await executeQuery('SELECT COUNT(*) AS count FROM shop_records');
            res.json({ success: true, count: result[0].count });
        } catch (err) {
            console.error('API Error counting shops:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }

}

export default shopController;
export { upload };