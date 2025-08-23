import { executeQuery } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import moment from 'moment';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'public/customers/';
        // Ensure the directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const cust_id = req.params.cust_id || Date.now(); // Use customer_id if available
        cb(null, `${cust_id}${ext}`); // Rename file with customer_id
    }
});
const upload = multer({ storage: storage });


class customerGroupController {

    static grouping = async (req, res) => {
        try {
            // Simplified query - just get the data, we'll handle grouping in JavaScript
            const sqlStr = `
                SELECT 
                    c.customer_id,
                    c.customer_name,
                    c.ext_code,
                    c.ext_code_key,
                    CASE 
                        WHEN c.ext_code = c.ext_code_key THEN 'Primary'
                        WHEN c.ext_code_key IS NOT NULL THEN 'Secondary'
                        ELSE 'Ungrouped'
                    END as status,
                    p.customer_name as primary_name,
                    c.status as cust_status
                FROM customers c
                LEFT JOIN customers p ON c.ext_code_key = p.ext_code -- AND p.ext_code = p.ext_code_key
                WHERE c.status IN ('A','I')
                ORDER BY 
                    COALESCE(c.ext_code_key, c.ext_code),
                    CASE 
                        WHEN c.ext_code = c.ext_code_key THEN 0
                        WHEN c.ext_code_key IS NOT NULL THEN 1
                        ELSE 2
                    END,
                    c.customer_name
                `;

            const customers = await executeQuery(sqlStr);

            // Get all potential primary customers
            const primaryCandidatesSql = `
        SELECT customer_id, customer_name, ext_code
        FROM customers 
        WHERE status IN ('A','I') 
        AND (ext_code_key IS NULL OR ext_code_key != ext_code)
        ORDER BY customer_name
        `;

            const primaryCandidates = await executeQuery(primaryCandidatesSql);

            res.render('customers/customer-grouping', {
                customers: customers,
                primaryCandidates: primaryCandidates,
                title: 'Customer Grouping Management'
            });

        } catch (error) {
            console.error('Grouping error:', error);
            res.status(500).render('error', {
                message: 'Error loading customer grouping',
                error: error.message
            });
        }
    };

    // Create new group
    static createGroup = async (req, res) => {
        console.log('=== createGroup METHOD CALLED ===');
        try {
            const { primary_customer_id, group_code } = req.body;
            const userId = res.locals.user?.user_id || 0;

            // Verify the customer exists and get their current ext_code
            const customerSql = "SELECT ext_code FROM customers WHERE customer_id = ? AND status IN ('A','I')";
            const customer = await executeQuery(customerSql, [primary_customer_id]);

            if (customer.length === 0) {
                return res.status(400).json({ success: false, message: 'Customer not found' });
            }

            // Update customer to become primary (ext_code = ext_code_key)
            const updateSql = "UPDATE customers SET ext_code_key = ?, u_at = NOW(), u_by = ? WHERE customer_id = ?";
            await executeQuery(updateSql, [group_code, userId, primary_customer_id]);

            res.json({ success: true, message: 'Group created successfully' });

        } catch (error) {
            console.error('Create group error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Add customer to group
    static addToGroup = async (req, res) => {
        try {
            const { customer_id, primary_code } = req.body;
            const userId = res.locals.user?.user_id || 0;

            // Verify the primary group exists
            const primarySql = "SELECT customer_id FROM customers WHERE ext_code = ? AND ext_code_key = ? AND status IN ('A','I')";
            const primary = await executeQuery(primarySql, [primary_code, primary_code]);

            if (primary.length === 0) {
                return res.status(400).json({ success: false, message: 'Primary group not found' });
            }

            // Update customer to link to primary
            const updateSql = "UPDATE customers SET ext_code_key = ?, u_at = NOW(), u_by = ? WHERE customer_id = ?";
            await executeQuery(updateSql, [primary_code, userId, customer_id]);

            res.json({ success: true, message: 'Customer added to group successfully' });

        } catch (error) {
            console.error('Add to group error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Remove from group
    static removeFromGroup = async (req, res) => {
        try {
            const { customer_id } = req.body;
            const userId = res.locals.user?.user_id || 0;

            // Remove grouping by setting ext_code_key to NULL
            const updateSql = "UPDATE customers SET ext_code_key = NULL, u_at = NOW(), u_by = ? WHERE customer_id = ?";
            await executeQuery(updateSql, [userId, customer_id]);

            res.json({ success: true, message: 'Customer removed from group' });

        } catch (error) {
            console.error('Remove from group error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Make customer primary
    static makePrimary = async (req, res) => {
        try {
            const { customer_id, group_code } = req.body;
            const userId = res.locals.user?.user_id || 0;

            // Update customer to become primary (ext_code = ext_code_key)
            const updateSql = "UPDATE customers SET ext_code_key = ?, u_at = NOW(), u_by = ? WHERE customer_id = ?";
            await executeQuery(updateSql, [group_code, userId, customer_id]);

            res.json({ success: true, message: 'Customer made primary successfully' });

        } catch (error) {
            console.error('Make primary error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Update group (edit functionality)
    static updateGroup = async (req, res) => {
        try {
            const { customer_id, group_code } = req.body;
            const userId = res.locals.user?.user_id || 0;

            console.log('=== updateGroup METHOD CALLED ===');
            console.log('Updating group for customer:', customer_id, 'with new code:', group_code);

            // Verify the customer exists and is a primary customer
            const customerSql = "SELECT ext_code_key FROM customers WHERE customer_id = ? AND status IN ('A','I') AND ext_code = ext_code_key";
            const customer = await executeQuery(customerSql, [customer_id]);

            if (customer.length === 0) {
                return res.status(400).json({ success: false, message: 'Primary customer not found or not a primary customer' });
            }

            const oldGroupCode = customer[0].ext_code_key;

            // Update primary customer's group code
            const updatePrimarySql = "UPDATE customers SET ext_code_key = ?, u_at = NOW(), u_by = ? WHERE customer_id = ?";
            await executeQuery(updatePrimarySql, [group_code, userId, customer_id]);

            // Update all secondary customers in this group
            const updateSecondariesSql = "UPDATE customers SET ext_code_key = ?, u_at = NOW(), u_by = ? WHERE ext_code_key = ? AND status IN ('A','I')";
            await executeQuery(updateSecondariesSql, [group_code, userId, oldGroupCode]);

            res.json({ success: true, message: 'Group updated successfully' });

        } catch (error) {
            console.error('Update group error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Remove entire group
    static removeGroup = async (req, res) => {
        try {
            console.log('=== removeGroup METHOD CALLED ===');
            console.log('Request body:', req.body);

            const { customer_id } = req.body;
            const userId = res.locals.user?.user_id || 0;

            console.log('Customer ID to remove group:', customer_id);
            console.log('User ID:', userId);

            // First get the primary customer's ext_code
            const primarySql = "SELECT ext_code FROM customers WHERE customer_id = ? AND status IN ('A','I')";
            const primary = await executeQuery(primarySql, [customer_id]);

            console.log('Primary customer query result:', primary);

            if (primary.length === 0) {
                console.log('Customer not found');
                return res.status(400).json({ success: false, message: 'Customer not found' });
            }

            const primaryCode = primary[0].ext_code;
            console.log('Primary code to remove:', primaryCode);

            // Remove grouping from primary customer
            const updatePrimarySql = "UPDATE customers SET ext_code_key = NULL, u_at = NOW(), u_by = ? WHERE customer_id = ?";
            await executeQuery(updatePrimarySql, [userId, customer_id]);
            console.log('Primary customer ungrouped');

            // Remove grouping from all secondary customers in this group
            const updateSecondariesSql = "UPDATE customers SET ext_code_key = NULL, u_at = NOW(), u_by = ? WHERE ext_code_key = ? AND status IN ('A','I')";
            const result = await executeQuery(updateSecondariesSql, [userId, primaryCode]);
            console.log('Secondary customers ungrouped:', result.affectedRows, 'affected');

            res.json({ success: true, message: 'Group removed successfully' });

        } catch (error) {
            console.error('Remove group error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // Get group members
    static getGroupMembers = async (req, res) => {
        try {
            const { group_code } = req.params;

            const sqlStr = `
            SELECT customer_id, customer_name, ext_code
            FROM customers 
            WHERE ext_code_key = ? 
            AND ext_code != ext_code_key 
            AND status IN ('A','I')
            ORDER BY customer_name
        `;

            const members = await executeQuery(sqlStr, [group_code]);

            res.json({ success: true, members });

        } catch (error) {
            console.error('Get group members error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

};

export default customerGroupController;
export { upload }; // Add this at the bottom of the file