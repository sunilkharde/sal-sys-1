import { executeQuery } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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


class customerController {

    static getData = async () => {
        try {
            const cities_list = await executeQuery("SELECT * FROM cities");

            const users_list = await executeQuery("SELECT a.*, CONCAT(a.username, ' [', a.email_id,']') as map_user FROM users as a Where a.status='A' and a.user_role='Dealer'");

            const market_area_list = await executeQuery("SELECT * FROM market_area Where status='A'");

            const bu_list = await executeQuery("SELECT bu_id, CONCAT(bu_code,' | ',bu_name) as bu_name FROM business_units Where status='A'")

            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.desg_id IN (1,2,3,4,5)"
            // const params = [mg_id];
            const emp_list = await executeQuery(sqlStr) //, params);

            return [cities_list, users_list, market_area_list, bu_list, emp_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static getSeData = async (req, res) => {
        try {
            const { mg_id } = req.query;

            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.boss_id=?"
            const params = [mg_id];
            const empList = await executeQuery(sqlStr, params);

            res.json({ se_list: empList });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static viewBlank = async (req, res) => {
        const [cities_list, users_list, market_area_list, bu_list, emp_list] = await this.getData();
        res.render('customers/customer-create', { cities_list, users_list, market_area_list, bu_list, emp_list });
    }

    static create = async (req, res) => {
        const { customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status, bu_id, mg_id, se_id } = req.body;
        const data = req.body
        const [cities_list, users_list, market_area_list, bu_list, emp_list] = await this.getData();

        let selectedBu_list = Array.isArray(bu_id) ? bu_id : [bu_id];

        var errors = [];
        // Validate input || customer_name.trim().length === 0
        if (!customer_name) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!nick_name) {
            errors.push({ message: 'Enter nick name of customer' });
        }
        if (!city) {
            errors.push({ message: 'Select customer city from list' });
        }
        if (!market_area_id) {
            errors.push({ message: "Select customer's market area" });
        }
        if (!user_id) {
            errors.push({ message: "Select login details for customer" });
        }
        if (!ext_code) {
            errors.push({ message: "Select external code for customer" });
        }
        if (bu_id === undefined) {
            errors.push({ message: 'Select business unit' });
        }
        // if (isNaN(rate) || rate <= 0) {
        //     errors.push({ message: 'Price must be a number' });
        // }
        const rows = await executeQuery('SELECT * FROM customers WHERE customer_name=? or ext_code=?', [customer_name, ext_code]);
        if (rows.length > 0) {
            errors.push({ message: 'Customer with this name or SAP code is already exists' });
        }

        if (errors.length) {
            const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row1 = await executeQuery(sqlStr1, [mg_id]);
            var mgName = ""
            if (row1.length > 0) {
                mgName = row1[0].emp_name;
            }
            //
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row2 = await executeQuery(sqlStr2, [se_id]);
            var seName = ""
            if (row2.length > 0) {
                seName = row2[0].emp_name;
            }
            //
            const updatedData = { ...data, mg_name: mgName, se_name: seName };
            //
            res.render('customers/customer-create', { errors, data: updatedData, cities_list, users_list, market_area_list, bu_list, selectedBu_list, emp_list });
            return;
        }

        try {
            // Genrate max Customer id
            //const conn1 = await pool.getConnection();
            const rows1 = await executeQuery('SELECT Max(customer_id) AS maxNumber FROM customers');
            //conn1.release
            var nextCustomerID = rows1[0].maxNumber + 1;

            // Insert new record into database
            //const conn2 = await pool.getConnection();
            // await conn2.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO customers (customer_id,customer_name,nick_name,add1,add2,add3,city,pin_code,district,state,market_area_id,user_id,ext_code,geo_location,customer_type,status,mg_id,se_id,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const paramsCust = [nextCustomerID, customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status_new, mg_id, se_id, c_by];
            await executeQuery(sqlStr, paramsCust);
            // await conn2.commit();
            //conn2.release

            // Insert new record into 'customer_bu'
            if (bu_id !== undefined) {
                for (const bu_id of selectedBu_list) {
                    const sqlStr = "INSERT INTO customers_bu (customer_id,bu_id,c_at,c_by)" +
                        " VALUES (?,?,CURRENT_TIMESTAMP( ),?)"
                    const params = [nextCustomerID, bu_id, c_by];
                    await executeQuery(sqlStr, params);
                }
            }

            //return res.render('customers/customer-view', { alert: `Save Customer successfully` });
            res.redirect('/customer/view');
            //res.redirect('/');

        } catch (err) {
            console.error(err);
            return res.render('customers/customer-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static viewAll = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        try {

            const sqlStr = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,a.district,a.ext_code" +
                " from customers as a, market_area as b " +
                " Where a.market_area_id=b.market_area_id";
            const results = await executeQuery(sqlStr)//, params);

            res.render('customers/customer-view', { customers: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static edit = async (req, res) => {
        const { id } = req.params;

        try {
            const [cities_list, users_list, market_area_list, bu_list, emp_list] = await this.getData();

            const rows1 = await executeQuery(`SELECT bu_id FROM customers_bu Where customer_id=${id}`);
            const selectedBu_list = rows1.map(row => row.bu_id); //store result as array 

            const sqlStr = "Select a.*,CONCAT(b.username,' [', b.email_id,']') as username,c.market_area" +
                " From customers as a LEFT JOIN users as b ON (a.user_id=b.user_id)" +
                " LEFT JOIN market_area as c ON (a.market_area_id=c.market_area_id)" +
                " Where a.customer_id= ?";
            const params = [id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0]

            const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row1 = await executeQuery(sqlStr1, [results[0].mg_id]);
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row2 = await executeQuery(sqlStr2, [results[0].se_id]);

            data1 = {
                ...data1,
                mg_name: row1.length > 0 ? row1[0].emp_name : "Undefined",
                se_name: row2.length > 0 ? row2[0].emp_name : "Undefined"
            };

            res.render('customers/customer-edit', { data: data1, cities_list, users_list, market_area_list, bu_list, selectedBu_list, emp_list });
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static update = async (req, res) => {
        const { id } = req.params;
        const { customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status, bu_id, mg_id, se_id } = req.body;
        const data = req.body
        const [cities_list, users_list, market_area_list, bu_list, emp_list] = await this.getData();

        let selectedBu_list = Array.isArray(bu_id) ? bu_id : [bu_id];

        var errors = [];
        // Validate input || customer_name.trim().length === 0
        if (!customer_name) {
            errors.push({ message: 'Dealer name is required' });
        }
        if (!nick_name) {
            errors.push({ message: 'Enter nick name of dealer' });
        }
        if (!city) {
            errors.push({ message: 'Select dealer city from list' });
        }
        if (!market_area_id) {
            errors.push({ message: "Select dealer's market area" });
        }
        if (!user_id) {
            errors.push({ message: "Select login details for dealer" });
        }
        if (!ext_code) {
            errors.push({ message: "Select SAP code for dealer" });
        }
        if (bu_id === undefined) {
            errors.push({ message: 'Select business unit' });
        }
        // if (isNaN(rate) || rate <= 0) {
        //     errors.push({ message: 'Price must be a number' });
        // }
        //const conn = await pool.getConnection();
        const rows = await executeQuery('SELECT * FROM customers WHERE (customer_name=? or ext_code=?) and customer_id<>?', [customer_name, ext_code, id]);
        //conn.release
        if (rows.length > 0) {
            errors.push({ message: 'Dealer with this name or SAP code is already exists' });
        }
        if (errors.length) {
            const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row1 = await executeQuery(sqlStr1, [mg_id]);
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row2 = await executeQuery(sqlStr2, [se_id]);
            const updatedData = { ...data, mg_name: row1[0].emp_name, se_name: row2[0].emp_name };

            res.render('customers/customer-edit', { errors, data: updatedData, cities_list, users_list, market_area_list, bu_list, selectedBu_list, emp_list });
            return;
        }

        try {
            // Update record into database using customer_id
            //const conn1 = await pool.getConnection();
            // await conn1.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE customers Set customer_name=?,nick_name=?,add1=?,add2=?,add3=?,city=?,pin_code=?,district=?,state=?,market_area_id=?,user_id=?,ext_code=?,geo_location=?,customer_type=?,status=?,mg_id=?,se_id=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE customer_id=?"
            const params = [customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status_new, mg_id, se_id, u_by, id];
            await executeQuery(sqlStr, params);
            // await conn1.commit();
            //conn1.release

            const sqlStr2 = `Delete from customers_bu Where customer_id=${id}`
            await executeQuery(sqlStr2);

            if (bu_id !== undefined) {
                for (const bu_id of selectedBu_list) {
                    const sqlStr3 = "INSERT INTO customers_bu (customer_id,bu_id,u_at,u_by)" +
                        " VALUES (?,?,CURRENT_TIMESTAMP( ),?)"
                    const params = [id, bu_id, u_by];
                    await executeQuery(sqlStr3, params);
                }
            }

            res.redirect('/customer/view');
            // res.redirect('/customer/view?alert=Update+Customer+successfully');

        } catch (err) {
            console.error(err);
            return res.render('customer/customer-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static delete = async (req, res) => {
        const { id } = req.params;
        try {
            var errors = [];
            //const conn = await pool.getConnection();
            const sqlStr3 = "Select * from po_hd Where customer_id=?"
            const params3 = [id];
            const rows = await executeQuery(sqlStr3, params3);
            //conn.release
            if (rows.length > 0) {
                errors.push({ message: "Reference exist, master entry can't delete" });
            }
            //            
            if (errors.length) {
                res.redirect(`/customer/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            //const conn1 = await pool.getConnection();
            // await conn1.beginTransaction();
            const sqlStr = "Delete from customers WHERE customer_id=?"
            const params = [id];
            await executeQuery(sqlStr, params);
            // await conn1.commit();
            //conn1.release
            //
            //res.redirect('/customer/view');
            res.redirect('/customer/view?alert=customer+deleted+successfully');
        } catch (err) {
            console.error(err);
            return res.render('customers/customer-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    //To view all customer to update additional Information 
    static viewAllInfo = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        try {
            var sp_code = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

            //to select user from emp code
            const sqlUser = `Select emp_id from employees where user_id = ${sp_code}`;
            const empData = await executeQuery(sqlUser);
            let empID = 0;
            if (empData.length > 0) {
                empID = empData[0].emp_id
            }

            let sqlStr = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,a.district,b.market_area,a.ext_code" +
                " From customers as a, market_area as b " +
                " Where a.market_area_id=b.market_area_id";
            if (!["Admin", "Read", "Support"].includes(res.locals.user.user_role)) {
                sqlStr = sqlStr + ` and (mg_id = ${empID} or se_id = ${empID})`;
            }
            // const paramsVeh = [empData[0].emp_id, empData[0].emp_id];
            const results = await executeQuery(sqlStr); //, paramsVeh);

            res.render("customers/customer-view-info", { customers: results, alert });
        } catch (error) {
            console.error(error);
            // Handle the error
        }
    };

    static editInfo = async (req, res) => {
        const { cust_id } = req.params;

        try {
            const [cities_list, users_list, market_area_list, bu_list, emp_list] = await this.getData();

            const sqlStr = "Select a.*,CONCAT(b.username,' [', b.email_id,']') as username,c.market_area" +
                " From customers as a LEFT JOIN users as b ON (a.user_id=b.user_id)" +
                " LEFT JOIN market_area as c ON (a.market_area_id=c.market_area_id)" +
                " Where a.customer_id= ?";
            const params = [cust_id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0];

            const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row1 = await executeQuery(sqlStr1, [results[0].mg_id]);
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a Where a.emp_id=?"
            const row2 = await executeQuery(sqlStr2, [results[0].se_id]);

            data1 = {
                ...data1,
                mg_name: row1.length > 0 ? row1[0].emp_name : "Undefined",
                se_name: row2.length > 0 ? row2[0].emp_name : "Undefined"
            };

            //This code is for Vehicle information
            let sqlVeh = `Select * from cust_veh where customer_id = ${cust_id}`;
            let vehData = await executeQuery(sqlVeh);
            if (vehData.length === 0) {
                sqlVeh = `Select 1 as sr_no, '' as reg_no, '' as veh_type, '' as ins_no, NULL as ins_date, 0 as routes, 0 as outlets From dual`;
                vehData = await executeQuery(sqlVeh);
            }

            //This code is for Salesman information
            let sqlSp = `Select * from cust_sp where customer_id = ${cust_id}`;
            let spData = await executeQuery(sqlSp);
            if (spData.length === 0) {
                sqlSp = `select 1 as sr_no, '' as sp_type, '' as sp_name, '' as sp_mobile, '' as sp_edu, 0 as sp_year, 0 as sp_salary From dual`;
                spData = await executeQuery(sqlSp);
            }

            //This code is for Work Person information
            let sqlWp = `Select * from cust_wp where customer_id = ${cust_id}`;
            let wpData = await executeQuery(sqlWp);
            if (wpData.length === 0) {
                sqlWp = `select 1 as sr_no, '' as wp_type, '' as wp_name, '' as wp_mobile, '' as wp_edu, '' as wp_dob From dual`;
                wpData = await executeQuery(sqlWp);
            }


            res.render("customers/customer-edit-info", { data: data1, emp_list, vehData, spData, wpData });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    };

    static updateInfo = async (req, res) => {
        const { cust_id } = req.params;
        const { nick_name, godown_area, total_counters, gst_no, cust_care_no, add1, add2, add3, city, pin_code, district, state, geo_location, mg_id, se_id,
            sr_no, reg_no, veh_type, ins_no, ins_date, routes, outlets, sp_type, sp_name, sp_mobile, sp_edu, sp_year, sp_salary,
            wp_type, wp_name, wp_mobile, wp_edu, wp_dob } = req.body;
        const [cities_list, users_list, market_area_list, bu_list, emp_list] = await this.getData();

        var errors = [];
        if (isNaN(godown_area) || godown_area <= 0) {
            errors.push({ message: "Godown area cannot be blank" });
        }
        if (!reg_no || reg_no.length === 0) {
            errors.push({ message: "Enter vehicle details" });
        }
        if (!sp_name || sp_name.length === 0) {
            errors.push({ message: "Enter salesman details" });
        }

        if (errors.length) {
            const sqlStr = "SELECT a.*, CONCAT(b.username, ' [', b.email_id, ']') AS username, c.market_area " +
                "FROM customers AS a " +
                "LEFT JOIN users AS b ON (a.user_id = b.user_id) " +
                "LEFT JOIN market_area AS c ON (a.market_area_id = c.market_area_id) " +
                "WHERE a.customer_id = ?";
            const results = await executeQuery(sqlStr, [cust_id]);
            let data1 = results[0];

            let sqlVeh = `SELECT * FROM cust_veh WHERE customer_id = ${cust_id}`;
            let vehData = await executeQuery(sqlVeh);
            if (vehData.length === 0) {
                sqlVeh = `Select 1 as sr_no, '' as reg_no, '' as veh_type, '' as ins_no, NULL as ins_date, 0 as routes, 0 as outlets From dual`;
                vehData = await executeQuery(sqlVeh);
            }

            let sqlSp = `SELECT * FROM cust_sp WHERE customer_id = ${cust_id}`;
            let spData = await executeQuery(sqlSp);
            if (spData.length === 0) {
                sqlSp = `select 1 as sr_no, '' as sp_type, '' as sp_name, '' as sp_mobile, '' as sp_edu, 0 as sp_year, 0 as sp_salary From dual`;
                spData = await executeQuery(sqlSp);
            }

            let sqlWp = `Select * from cust_wp where customer_id = ${cust_id}`;
            let wpData = await executeQuery(sqlWp);
            if (wpData.length === 0) {
                sqlWp = `select 1 as sr_no, '' as wp_type, '' as wp_name, '' as wp_mobile, '' as wp_edu, '' as wp_dob From dual`;
                wpData = await executeQuery(sqlWp);
            }

            res.render("customers/customer-edit-info", { errors, data: data1, vehData, spData });
            return;
        }

        try {
            var upd_by = res.locals.user ? res.locals.user.user_id : 0;

            let photoPath = null;

            // **Delete old photo if exists** //No need of this code
            // const folderPath = 'public/customers/';
            // fs.readdirSync(folderPath).forEach(file => {
            //     if (file.startsWith(`${cust_id}.`)) {
            //         fs.unlinkSync(`${folderPath}${file}`);
            //     }
            // });

            // **Save new photo**
            if (req.file) {
                photoPath = `/customers/${cust_id}${path.extname(req.file.originalname)}`; // Save using customer_id
            }
            if (!photoPath || photoPath === undefined) {
                photoPath = geo_location;
            }
            // console.log('reqFile...', req.file,  photoPath)

            const sqlStr = "UPDATE customers SET nick_name=?, godown_area = ?, total_counters = ?, gst_no = ?, cust_care_no = ?, " +
                "add1 = ?, add2 = ?, add3 = ?, city = ?, pin_code = ?, district = ?, state = ?, geo_location = ?, mg_id=?, se_id=?," +
                "upd_by = ?, upd_at = CURRENT_TIMESTAMP WHERE customer_id = ?";
            const params = [nick_name, godown_area, total_counters, gst_no, cust_care_no, add1, add2, add3, city, pin_code, district, state, photoPath, mg_id, se_id, upd_by, cust_id];
            await executeQuery(sqlStr, params);

            // Delete and Insert Vehicle Information
            await executeQuery("DELETE FROM cust_veh WHERE customer_id=?", [cust_id]);

            const regNoVal = Array.isArray(reg_no) ? reg_no : [reg_no];
            const vehTypeVal = Array.isArray(veh_type) ? veh_type : [veh_type];
            const insNoVal = Array.isArray(ins_no) ? ins_no : [ins_no];
            const insDateVal = Array.isArray(ins_date) ? ins_date : [ins_date];
            const routesVal = Array.isArray(routes) ? routes : [routes];
            const outletsVal = Array.isArray(outlets) ? outlets : [outlets];

            for (let i = 0; i < regNoVal.length; i++) {
                let sr_no_val = i + 1;
                const sqlVeh = "INSERT INTO cust_veh (customer_id, sr_no, reg_no, veh_type, ins_no, ins_date, routes, outlets) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                await executeQuery(sqlVeh, [cust_id, sr_no_val, regNoVal[i].toUpperCase(), vehTypeVal[i], insNoVal[i], insDateVal[i], routesVal[i], outletsVal[i]]);
            }

            // Delete and Insert Salesperson Information
            await executeQuery("DELETE FROM cust_sp WHERE customer_id=?", [cust_id]);

            const spTypeVal = Array.isArray(sp_type) ? sp_type : [sp_type];
            const spNameVal = Array.isArray(sp_name) ? sp_name : [sp_name];
            const spMobileVal = Array.isArray(sp_mobile) ? sp_mobile : [sp_mobile];
            const spEduVal = Array.isArray(sp_edu) ? sp_edu : [sp_edu];
            const spYearVal = Array.isArray(sp_year) ? sp_year : [sp_year];
            const spSalaryVal = Array.isArray(sp_salary) ? sp_salary : [sp_salary];

            for (let i = 0; i < spNameVal.length; i++) {
                const sqlSp = "INSERT INTO cust_sp (customer_id, sr_no, sp_type, sp_name, sp_mobile, sp_edu, sp_year, sp_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                await executeQuery(sqlSp, [cust_id, i + 1, spTypeVal[i], spNameVal[i], spMobileVal[i], spEduVal[i], spYearVal[i], spSalaryVal[i]]);
            }

            // Delete and Insert Work Person Information
            await executeQuery("DELETE FROM cust_wp WHERE customer_id=?", [cust_id]);

            const wpTypeVal = Array.isArray(wp_type) ? wp_type : [wp_type];
            const wpNameVal = Array.isArray(wp_name) ? wp_name : [wp_name];
            const wpMobileVal = Array.isArray(wp_mobile) ? wp_mobile : [wp_mobile];
            const wpEduVal = Array.isArray(wp_edu) ? wp_edu : [wp_edu];
            const wpDobVal = Array.isArray(wp_dob) ? wp_dob : [wp_dob];

            for (let i = 0; i < wpNameVal.length; i++) {
                // console.log('wp name...', wpNameVal[i])
                const sqlWp = "INSERT INTO cust_wp (customer_id, sr_no, wp_type, wp_name, wp_mobile, wp_edu, wp_dob) VALUES (?, ?, ?, ?, ?, ?, ?)";
                await executeQuery(sqlWp, [cust_id, i + 1, wpTypeVal[i], wpNameVal[i], wpMobileVal[i], wpEduVal[i], wpDobVal[i]]);
            }

            res.redirect("/customer/view-info");
        } catch (err) {
            console.error(err);
            res.render("customer/view-info", { alert: "Internal server error" });
        }
    };

    static updateInfo_Old = async (req, res) => {
        const { cust_id } = req.params;
        const { godown_area, total_counters, gst_no, cust_care_no, add1, add2, add3, city, pin_code, district, state, sr_no, reg_no, veh_type, ins_no, ins_date, sp_type, sp_name, sp_mobile } = req.body;
        // const data = req.body;

        var errors = [];
        if (isNaN(godown_area) || godown_area <= 0) {
            errors.push({ message: "Godown area cannot be blank" });
        }
        if (reg_no === undefined || reg_no.length === 0) {
            errors.push({ message: "Enter vehicle details" });
        }
        if (sp_name === undefined || sp_name.length === 0) {
            errors.push({ message: "Enter salesman details" });
        }
        if (errors.length) {
            const sqlStr = "Select a.*,CONCAT(b.username,' [', b.email_id,']') as username,c.market_area" +
                " From customers as a LEFT JOIN users as b ON (a.user_id=b.user_id)" +
                " LEFT JOIN market_area as c ON (a.market_area_id=c.market_area_id)" +
                " Where a.customer_id= ?";
            const params = [cust_id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0];

            ///This code is for Vehicle information
            let sqlVeh = `Select * from cust_veh where customer_id = ${cust_id}`;
            let vehData = await executeQuery(sqlVeh);
            if (vehData.length === 0) {
                sqlVeh = `select 1 as sr_no, '' as reg_no, '' as veh_type, '' as ins_no, NULL as ins_date from dual`;
                vehData = await executeQuery(sqlVeh);
            }

            let sqlSp = `Select * from cust_sp where customer_id = ${cust_id}`;
            let spData = await executeQuery(sqlSp);
            if (spData.length === 0) {
                sqlVeh = `select 1 as sr_no, '' as sp_type, '' as sp_name, '' as sp_mobile From dual`;
                spData = await executeQuery(sqlSp);
            }

            res.render("customers/customer-edit-info", { errors, data: data1, vehData, spData });
            return;
        }

        try {
            var upd_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "Update customers Set godown_area=?, total_counters=?, gst_no=?, cust_care_no=?," +
                " add1=?, add2=?, add3=?, city=?, pin_code=?, district=?, state=?," +
                " upd_by=?, upd_at=CURRENT_TIMESTAMP WHERE customer_id=?";
            const params = [godown_area, total_counters, gst_no, cust_care_no, add1, add2, add3, city, pin_code, district, state, upd_by, cust_id,];
            await executeQuery(sqlStr, params);

            // Delete records from cust_veh
            const sqlVeh = "Delete FROM cust_veh WHERE customer_id=?";
            const paramsVeh = [cust_id];
            await executeQuery(sqlVeh, paramsVeh);

            const regNoVal = Array.isArray(reg_no) ? reg_no : [reg_no];
            const vehTypeVal = Array.isArray(veh_type) ? veh_type : [veh_type];
            const insNoVal = Array.isArray(ins_no) ? ins_no : [ins_no];
            const insDateVal = Array.isArray(ins_date) ? ins_date : [ins_date];

            for (let i = 0; i < reg_no.length; i++) {
                let sr_no_val = i + 1;
                const regNoUpper = regNoVal[i].toUpperCase();
                const sqlVeh = "Insert into cust_veh (customer_id,sr_no,reg_no,veh_type,ins_no,ins_date) values (?,?,?,?,?,?)";
                const paramsVeh = [cust_id, sr_no_val, regNoUpper, vehTypeVal[i], insNoVal[i], insDateVal[i]];
                await executeQuery(sqlVeh, paramsVeh);
            }

            // Delete records from cust_sp
            const sqlSp = "Delete FROM cust_sp WHERE customer_id=?";
            const paramsSp = [cust_id];
            await executeQuery(sqlSp, paramsSp);

            const spTypeVal = Array.isArray(sp_type) ? sp_type : [sp_type];
            const spNameVal = Array.isArray(sp_name) ? sp_name : [sp_name];
            const spMobileVal = Array.isArray(sp_mobile) ? sp_mobile : [sp_mobile];

            for (let i = 0; i < sp_name.length; i++) {
                const sr_no_val = i + 1;
                const sqlSp = "Insert into cust_sp (customer_id,sr_no,sp_type,sp_name,sp_mobile) values (?,?,?,?,?)";
                const paramsSp = [cust_id, sr_no_val, spTypeVal[i], spNameVal[i], spMobileVal[i]];
                await executeQuery(sqlSp, paramsSp);
            }

            res.redirect("/customer/view-info");
            // res.redirect('/customer/view?alert=Update+Customer+successfully');

        } catch (err) {
            console.error(err);
            return res.render("customer/view-info", { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    /***************** */
    // Customer Information Report
    static customerReport = async (req, res) => {
        try {
            // Get distinct states for the initial dropdown
            const sqlStates = "SELECT DISTINCT state FROM customers WHERE state IS NOT NULL AND state != '' ORDER BY state";
            const states = await executeQuery(sqlStates);

            res.render("customers/customer-report", { states });
        } catch (error) {
            console.error(error);
            res.render("error", { message: "Error loading customer report" });
        }
    };

    static getCustomerReportData = async (req, res) => {
        try {
            const { type, value } = req.query;

            let sql = "";
            let results = [];

            if (type === "state") {
                // Get cities for selected state
                sql = `SELECT DISTINCT city FROM customers 
                       WHERE state = ? AND city IS NOT NULL AND city != '' 
                       ORDER BY city`;
                results = await executeQuery(sql, [value]);
            } else if (type === "city") {
                // Get customers for selected city
                sql = `SELECT customer_id, customer_name, nick_name 
                       FROM customers 
                       WHERE city = ? 
                       ORDER BY customer_name`;
                results = await executeQuery(sql, [value]);
            }

            res.json(results);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Error fetching data" });
        }
    };

    static getCustomerDetails = async (req, res) => {
        try {
            const { cust_id } = req.params;

            // Get customer main info
            const customerSql = `SELECT * FROM customers WHERE customer_id = ?`;
            const customer = await executeQuery(customerSql, [cust_id]);

            if (customer.length === 0) {
                return res.status(404).json({ error: "Customer not found" });
            }

            // Get salesperson info
            const spSql = `SELECT * FROM cust_sp WHERE customer_id = ? ORDER BY sr_no`;
            const salespersons = await executeQuery(spSql, [cust_id]);

            // Get vehicle info
            const vehSql = `SELECT * FROM cust_veh WHERE customer_id = ? ORDER BY sr_no`;
            const vehicles = await executeQuery(vehSql, [cust_id]);

            res.json({
                customer: customer[0],
                salespersons,
                vehicles
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Error fetching customer details" });
        }
    };

    static searchCustomers = async (req, res) => {
        try {
            const { query } = req.query;

            if (!query || query.length < 2) {
                return res.json([]);
            }

            const searchQuery = `%${query}%`;

            const sql = `
                SELECT customer_id, customer_name, nick_name, city, state 
                FROM customers 
                WHERE customer_name LIKE ? 
                   OR nick_name LIKE ? 
                   OR city LIKE ? 
                   OR state LIKE ? 
                   OR add1 LIKE ? 
                   OR add2 LIKE ? 
                   OR add3 LIKE ? 
                   OR pin_code LIKE ? 
                   OR district LIKE ?
                ORDER BY customer_name
                LIMIT 10
            `;

            const results = await executeQuery(sql, [
                searchQuery, searchQuery, searchQuery, searchQuery,
                searchQuery, searchQuery, searchQuery, searchQuery,
                searchQuery
            ]);

            res.json(results);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Error searching customers" });
        }
    };
    // Customer Information Report:End


    /** Customer bench mark - mapping : Start */
    static viewBenchmark = async (req, res) => {
        try {
            const sqlStr = `
            SELECT cb.customer_id, cb.sr_no, cb.cust_bench_id, 
                   c1.customer_name as main_customer_name, 
                   c2.customer_name as benchmark_customer_name
            FROM cust_bench cb
            JOIN customers c1 ON cb.customer_id = c1.customer_id
            JOIN customers c2 ON cb.cust_bench_id = c2.customer_id
            ORDER BY cb.customer_id, cb.sr_no`;

            const results = await executeQuery(sqlStr);
            res.render('customers/customer-benchmark-view', { benchmarks: results });
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    };

    static viewAddBenchmark = async (req, res) => {
        try {
            // Get list of Dealers for benchmark selection
            const [mainDealers, subDealers] = await Promise.all([
                executeQuery(
                    "SELECT customer_id, customer_name FROM customers WHERE customer_type='Dealer' AND status='A' ORDER BY customer_name"
                ),
                executeQuery(
                    "SELECT customer_id, customer_name FROM customers WHERE customer_type='Sub-Dealer' AND status='A' ORDER BY customer_name"
                )
            ]);

            res.render('customers/customer-benchmark-add', { mainDealers, subDealers });
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    };

    static addBenchmark = async (req, res) => {
        const { customer_id, cust_bench_id } = req.body;

        try {
            // Fetch both dealer types once at the beginning
            const [mainDealers, subDealers] = await Promise.all([
                executeQuery(
                    "SELECT customer_id, customer_name FROM customers WHERE customer_type='Dealer' AND status='A' ORDER BY customer_name"
                ),
                executeQuery(
                    "SELECT customer_id, customer_name FROM customers WHERE customer_type='Sub-Dealer' AND status='A' ORDER BY customer_name"
                )
            ]);

            // Validate input
            if (!customer_id || !cust_bench_id) {
                return res.render('customers/customer-benchmark-add', {
                    mainDealers,
                    subDealers,
                    errors: [{ message: 'Both customer and benchmark customer are required' }]
                });
            }

            if (customer_id === cust_bench_id) {
                return res.render('customers/customer-benchmark-add', {
                    mainDealers,
                    subDealers,
                    errors: [{ message: 'Customer cannot benchmark against themselves' }]
                });
            }

            // Check for existing benchmark
            const existing = await executeQuery(
                "SELECT * FROM cust_bench WHERE customer_id=? AND cust_bench_id=?",
                [customer_id, cust_bench_id]
            );

            if (existing.length > 0) {
                return res.render('customers/customer-benchmark-add', {
                    mainDealers,
                    subDealers,
                    errors: [{ message: 'This benchmark relationship already exists' }]
                });
            }

            // Get next sequence number
            const seqResult = await executeQuery(
                "SELECT COALESCE(MAX(sr_no), 0) + 1 AS next_sr_no FROM cust_bench WHERE customer_id=?",
                [customer_id]
            );
            const next_sr_no = seqResult[0].next_sr_no;

            // Insert new record
            const c_by = res.locals.user?.user_id || 0;
            await executeQuery(
                "INSERT INTO cust_bench (customer_id, sr_no, cust_bench_id, c_at, c_by) VALUES (?, ?, ?, CURRENT_TIMESTAMP(), ?)",
                [customer_id, next_sr_no, cust_bench_id, c_by]
            );

            res.redirect('/customer/benchmark');
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    };

    static deleteBenchmark = async (req, res) => {
        const { customer_id, sr_no } = req.params;

        try {
            await executeQuery(
                "DELETE FROM cust_bench WHERE customer_id=? AND sr_no=?",
                [customer_id, sr_no]
            );

            res.redirect('/customer/benchmark');
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    };
    /** Customer bench mark - mapping : End */

};

export default customerController
export { upload }; // Add this at the bottom of the file