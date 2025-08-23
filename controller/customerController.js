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
        const alert = req.query.alert;
        try {
            var sp_code = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

            const sqlUser = `Select emp_id from employees where user_id = ${sp_code}`;
            const empData = await executeQuery(sqlUser);
            let empID = 0;
            if (empData.length > 0) {
                empID = empData[0].emp_id;
            }

            let sqlStr = "Select a.customer_id, a.customer_name, a.nick_name, a.city, CONCAT(a.city,' ',a.pin_code) as city_pin, a.district, b.market_area, a.ext_code " +
                "From customers as a, market_area as b " +
                "Where a.market_area_id = b.market_area_id";

            if (!["Admin", "Read", "Support"].includes(res.locals.user.user_role)) {
                sqlStr += ` and (mg_id = ${empID} or se_id = ${empID})`;
            }

            const results = await executeQuery(sqlStr);

            // Get unique districts and cities for filters
            const districts = [...new Set(results.map(item => item.district))].sort();

            // Group cities by district for dependent dropdown
            const citiesByDistrict = {};
            results.forEach(item => {
                if (!citiesByDistrict[item.district]) {
                    citiesByDistrict[item.district] = new Set();
                }
                citiesByDistrict[item.district].add(item.city);
            });

            // Convert Sets to Arrays for JSON serialization
            const citiesByDistrictSerializable = {};
            Object.keys(citiesByDistrict).forEach(district => {
                citiesByDistrictSerializable[district] = Array.from(citiesByDistrict[district]).sort();
            });

            res.render("customers/customer-view-info", {
                customers: results,
                districts,
                citiesByDistrict: JSON.stringify(citiesByDistrictSerializable),
                alert
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Error fetching customer data");
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

    static getFinancialYearStart = (currentDate) => {
        const year = currentDate.month() >= 3 ? currentDate.year() : currentDate.year() - 1;
        return moment([year, 3, 1]); // April is month 3 in moment (0-indexed)
    };

    static viewInfoReport = async (req, res) => {
        const { cust_id } = req.params;
        let { from_date, to_date, base_group } = req.query;

        try {

            // if (!base_group) base_group = 'Gai Chhap Jarda';

            // 1. Get complete customer info
            const sqlCustomer = `
                SELECT a.*, 
                    CONCAT(b.last_name, ' ', b.first_name) AS mg_name,
                    CONCAT(c.last_name, ' ', c.first_name) AS se_name,
                    d.market_area
                FROM customers a
                LEFT JOIN employees b ON a.mg_id = b.emp_id
                LEFT JOIN employees c ON a.se_id = c.emp_id
                LEFT JOIN market_area d ON a.market_area_id = d.market_area_id
                WHERE a.customer_id = ?`;
            const customerData = await executeQuery(sqlCustomer, [cust_id]);

            if (customerData.length === 0) {
                return res.status(404).send("Customer not found");
            }

            // 2. Get Work Person, Vehicle, and Salesman Details (unchanged)
            const wpData = await executeQuery(`SELECT * FROM cust_wp WHERE customer_id = ? ORDER BY sr_no`, [cust_id]);
            const vehData = await executeQuery(`SELECT * FROM cust_veh WHERE customer_id = ? ORDER BY sr_no`, [cust_id]);
            const spData = await executeQuery(`SELECT * FROM cust_sp WHERE customer_id = ? ORDER BY sr_no`, [cust_id]);

            // 3. Calculate date ranges
            const currentDate = moment();
            const financialYearStart = this.getFinancialYearStart(currentDate);
            const defaultFromDate = financialYearStart;
            const queryFromDate = from_date || defaultFromDate.format('YYYY-MM-DD');
            const queryToDate = to_date || currentDate.format('YYYY-MM-DD');

            // Calculate last year's date range
            const lastYearFromDate = moment(queryFromDate).subtract(1, 'year').format('YYYY-MM-DD');
            const lastYearToDate = moment(queryToDate).subtract(1, 'year').format('YYYY-MM-DD');

            // For monthly trend - whole current and last financial year
            const currentFYStart = financialYearStart.format('YYYY-MM-DD');
            const currentFYEnd = financialYearStart.clone().add(1, 'year').subtract(1, 'day').format('YYYY-MM-DD');
            const lastFYStart = financialYearStart.clone().subtract(1, 'year').format('YYYY-MM-DD');
            const lastFYEnd = financialYearStart.clone().subtract(1, 'day').format('YYYY-MM-DD');

            const sapCustomerNumber = customerData[0].ext_code.padStart(10, '0');
            const sapCustomerExtKey = customerData[0].ext_code_key;

            // Add base group filter to WHERE clauses
            const baseGroupFilter = base_group ? `AND x.base_group = '${base_group}'` : '';

            // Helper function to categorize base groups
            const categorizeBaseGroup = (desc) => {
                if (!desc) return 'Regular';
                const lowerDesc = desc.toLowerCase();
                if (lowerDesc.includes('tob') || lowerDesc.includes('gai') || lowerDesc.includes('chhap') || lowerDesc.includes('uut') || lowerDesc.includes('uut')) { 
                    return 'Tobacco';
                }
                return 'Regular';
            };
            const categorizeBaseGroup2 = (desc) => {
                if (!desc) return 'Regular';
                const lowerDesc = desc.toLowerCase();
                if (lowerDesc.includes('tob1') || lowerDesc.includes('gai1') || lowerDesc.includes('chhap1')) {
                    return 'Tobacco';
                }
                return 'Regular';
            };

            // 4. Sales summary - current and last year
            const sqlSalesSummary = `
                SELECT 
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity ELSE 0 END) AS currentYearQty,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity * item_price ELSE 0 END) AS currentYearValue,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity ELSE 0 END) AS lastYearQty,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity * a.item_price ELSE 0 END) AS lastYearValue,
                    COUNT(DISTINCT x.base_group) AS categoryCount
                FROM sap_sales a, groups x
                WHERE TRIM(IFNULL(a.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                AND a.customer_number = ?
                AND (a.billing_date BETWEEN ? AND ? OR a.billing_date BETWEEN ? AND ?)
                ${baseGroupFilter}`;

            const salesSummary = await executeQuery(sqlSalesSummary, [
                queryFromDate, queryToDate,
                queryFromDate, queryToDate,
                lastYearFromDate, lastYearToDate,
                lastYearFromDate, lastYearToDate,
                sapCustomerNumber,
                queryFromDate, queryToDate,
                lastYearFromDate, lastYearToDate
            ]);

            // Calculate average monthly
            const monthsDiff = moment(queryToDate).diff(moment(queryFromDate), 'months') + 1;
            const avgMonthly = salesSummary[0].currentYearValue / monthsDiff;

            // 5. Base group performance - current and last year
            const sqlBaseGroup = `
                SELECT 
                    x.base_group,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity ELSE 0 END) AS currentYearQty,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity * a.item_price ELSE 0 END) AS currentYearValue,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity ELSE 0 END) AS lastYearQty,
                    SUM(CASE WHEN a.billing_date BETWEEN ? AND ? THEN a.quantity * a.item_price ELSE 0 END) AS lastYearValue
                FROM sap_sales as a, groups as x
                WHERE TRIM(IFNULL(a.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                AND a.customer_number = ?
                AND (a.billing_date BETWEEN ? AND ? OR a.billing_date BETWEEN ? AND ?)
                ${baseGroupFilter}
                GROUP BY x.base_group
                ORDER BY currentYearQty DESC`;

            const baseGroupData = await executeQuery(sqlBaseGroup, [
                queryFromDate, queryToDate,
                queryFromDate, queryToDate,
                lastYearFromDate, lastYearToDate,
                lastYearFromDate, lastYearToDate,
                sapCustomerNumber,
                queryFromDate, queryToDate,
                lastYearFromDate, lastYearToDate
            ]);

            // Add parent group and calculate percentages
            const baseGroupPerformance = baseGroupData.map(item => {
                const parentGroup = categorizeBaseGroup(item.base_group);
                const currentYearPercent = (item.currentYearValue / (salesSummary[0].currentYearValue || 1)) * 100;
                const lastYearPercent = (item.lastYearValue / (salesSummary[0].lastYearValue || 1)) * 100;

                return {
                    ...item,
                    parentGroup,
                    currentYearPercent,
                    lastYearPercent,
                    // growthPercent: ((item.currentYearValue - item.lastYearValue) / (item.lastYearValue || 1)) * 100
                    growthPercent: ((item.currentYearQty - item.lastYearQty) / (item.lastYearQty || 1)) * 100
                };
            });
            console.log('baseGroupPerformance...', baseGroupPerformance);

            // 6. Monthly trend - whole financial year (modified for proper chart display)
            const sqlMonthlyTrend = `
                SELECT 
                    DATE_FORMAT(a.billing_date, '%m') AS month_num,
                    DATE_FORMAT(a.billing_date, '%b') AS month_name,
                    YEAR(a.billing_date) AS year,
                    SUM(a.quantity * a.item_price) AS value,
                    SUM(a.quantity) AS qty
                FROM sap_sales as a, groups as x
                WHERE TRIM(IFNULL(a.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                AND a.customer_number = ?
                AND (
                    (a.billing_date BETWEEN ? AND ?) OR 
                    (a.billing_date BETWEEN ? AND ?)
                )
                ${baseGroupFilter}
                GROUP BY YEAR(a.billing_date), DATE_FORMAT(a.billing_date, '%m'), DATE_FORMAT(a.billing_date, '%b')
                ORDER BY  year, month_num`;

            const monthlyTrendRaw = await executeQuery(sqlMonthlyTrend, [
                sapCustomerNumber,
                currentFYStart, currentFYEnd,
                lastFYStart, lastFYEnd
            ]);

            // Process the raw data for chart display
            const monthlyTrend = { labels: [], currentYear: [], lastYear: [] };

            // Get current and last financial years
            const currentYear = moment().year();
            const lastYear = currentYear - 1;

            // Initialize arrays with zeros for all months
            const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
            // const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach(month => {
                monthlyTrend.labels.push(month);
                monthlyTrend.currentYear.push(0);
                monthlyTrend.lastYear.push(0);
            });

            // Fill in the actual data
            monthlyTrendRaw.forEach(item => {
                const monthIndex = months.indexOf(item.month_name);
                if (monthIndex !== -1) {
                    if (item.year === lastYear) {
                        monthlyTrend.lastYear[monthIndex] = item.qty;
                    } else if (item.year === currentYear) {
                        monthlyTrend.currentYear[monthIndex] = item.qty;
                    }
                }
            });

            // monthlyTrendRaw.forEach(item => {
            //     const monthIndex = months.indexOf(item.month_name);
            //     if (monthIndex !== -1) {
            //         if (item.year === currentYear) {
            //             monthlyTrend.currentYear[monthIndex] = item.qty;
            //         } else if (item.year === lastYear) {
            //             monthlyTrend.lastYear[monthIndex] = item.qty;
            //         }
            //     }
            // });


            // 7. Get customer ranking - optimized for base group filtering
            const sqlCustomerRanking = `
                WITH district_sales AS (
                    SELECT 
                        c.ext_code,
                        MAX(c.customer_name) AS customer_name,
                        MAX(c.city) AS city,
                        MAX(c.district) AS district,
                        ROUND(SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END), 0) AS currentYearSales,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS currentYearQty,
                        ROUND(SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END), 0) AS lastYearSales,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS lastYearQty
                    FROM customers c
                    JOIN sap_sales s ON s.customer_number = LPAD(c.ext_code, 10, '0')
                    JOIN groups x ON TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                    WHERE c.district = ?
                    AND (
                        (s.billing_date BETWEEN ? AND ?) OR 
                        (s.billing_date BETWEEN ? AND ?)
                    )
                    ${baseGroupFilter}
                    GROUP BY c.ext_code
                    HAVING currentYearQty > 0 OR lastYearQty > 0
                ),
                category_ranking AS (
                    SELECT 
                        c.ext_code,
                        x.base_group,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS currentYearQty,
                        ROW_NUMBER() OVER (
                            PARTITION BY c.ext_code 
                            ORDER BY SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) DESC
                        ) as category_rank
                    FROM customers c
                    JOIN sap_sales s ON s.customer_number = LPAD(c.ext_code, 10, '0')
                    JOIN groups x ON TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                    WHERE s.billing_date BETWEEN ? AND ?
                    AND c.district = ?
                    ${baseGroupFilter}
                    GROUP BY c.ext_code, x.base_group
                ),
                ranked_customers AS (
                    SELECT 
                        ds.ext_code,
                        ds.customer_name,
                        ds.city,
                        ds.district,
                        ds.currentYearSales,
                        ds.currentYearQty,
                        ds.lastYearSales,
                        ds.lastYearQty,
                        RANK() OVER (
                            ORDER BY ds.currentYearQty DESC, ds.customer_name ASC
                        ) AS sales_rank,
                        CASE 
                            WHEN ds.lastYearQty = 0 THEN NULL 
                            ELSE ROUND(((ds.currentYearQty - ds.lastYearQty) / ds.lastYearQty * 100), 2) 
                        END AS growth_percent,
                        GROUP_CONCAT(
                            CASE WHEN cr.category_rank <= 3 THEN cr.base_group END 
                            ORDER BY cr.category_rank
                        ) AS top_categories
                    FROM district_sales ds
                    LEFT JOIN category_ranking cr ON ds.ext_code = cr.ext_code AND cr.category_rank <= 3
                    GROUP BY ds.ext_code, ds.customer_name, ds.city, ds.district, 
                            ds.currentYearSales, ds.currentYearQty, ds.lastYearSales, ds.lastYearQty
                )
                SELECT * FROM ranked_customers
                ORDER BY sales_rank ASC, customer_name ASC;
                `;

            const rankingData = await executeQuery(sqlCustomerRanking, [
                // Current year sales
                queryFromDate, queryToDate,
                queryFromDate, queryToDate,

                // Last year sales  
                lastYearFromDate, lastYearToDate,
                lastYearFromDate, lastYearToDate,

                // District filter
                customerData[0].district,

                // Date ranges for both periods
                queryFromDate, queryToDate,
                lastYearFromDate, lastYearToDate,

                // Category ranking - current year only
                queryFromDate, queryToDate,
                queryFromDate, queryToDate,
                queryFromDate, queryToDate,
                customerData[0].district
            ]);

            // Process the top categories string into an array
            rankingData.forEach(customer => {
                if (customer.top_categories) {
                    customer.top_categories = customer.top_categories.split(',').filter(Boolean).slice(0, 3);
                }
            });

            // Get all customers in the district
            const allDistrictCustomers = rankingData.filter(customer =>
                customer.district === customerData[0].district
            );

            // Get top 10 customers
            let topCustomers = allDistrictCustomers.slice(0, 10);

            // Find current customer's rank
            const currentCustomerRank = allDistrictCustomers.find(c =>
                c.ext_code === customerData[0].ext_code
            );

            // If current customer not in top 10, add them to the list
            if (currentCustomerRank && !topCustomers.some(c => c.ext_code === customerData[0].ext_code)) {
                topCustomers.push(currentCustomerRank);

                // Sort again to maintain ranking order
                topCustomers.sort((a, b) => a.sales_rank - b.sales_rank);
            }


            // 8. Benchmark comparison - Optimized to show all categories
            const hasBenchmarks = await executeQuery(
                "SELECT COUNT(*) as count FROM cust_bench WHERE customer_id = ?",
                [cust_id]
            );

            let transformedBenchmarkData = null;

            if (hasBenchmarks[0].count > 0) {
                // Get all benchmark customer IDs
                const benchmarkIds = (await executeQuery(
                    `SELECT c.customer_id 
                    FROM customers c
                    WHERE c.ext_code_key IN (
                        SELECT c2.ext_code_key 
                        FROM customers c2
                        INNER JOIN cust_bench cb ON c2.customer_id = cb.cust_bench_id
                        WHERE cb.customer_id = ?
                    )`,
                    [cust_id]
                )).map(b => b.customer_id);

                const benchmarkExtCodeKeys = (await executeQuery(
                    `SELECT c.ext_code_key 
                    FROM customers c
                    WHERE c.ext_code_key IN (
                        SELECT c2.ext_code_key 
                        FROM customers c2
                        INNER JOIN cust_bench cb ON c2.customer_id = cb.cust_bench_id
                        WHERE cb.customer_id = ?
                    )`,
                    [cust_id]
                )).map(b => b.ext_code_key);                

                // Get ALL base groups for current customer to ensure all categories are shown
                const allBaseGroupsForCustomer = await executeQuery(`
                SELECT DISTINCT x.base_group
                FROM sap_sales s
                JOIN groups x ON TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                WHERE s.customer_number = ?
                AND (s.billing_date BETWEEN ? AND ? OR s.billing_date BETWEEN ? AND ?)
                ${baseGroupFilter}
                ORDER BY x.base_group`,
                    [
                        sapCustomerNumber,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate
                    ]
                );

                // Get current customer's sales by ALL categories (even if zero)
                const currentCustomerAllCategories = allBaseGroupsForCustomer.map(group => ({
                    base_group: group.base_group,
                    currentYearQty: 0,
                    currentYearValue: 0,
                    lastYearQty: 0,
                    lastYearValue: 0
                }));

                // Get actual current customer data and merge
                const currentCustomerActualData = await executeQuery(`
                SELECT 
                    x.base_group,
                    SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS currentYearQty,
                    SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END) AS currentYearValue,
                    SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS lastYearQty,
                    SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END) AS lastYearValue
                FROM customers c
                JOIN sap_sales s ON s.customer_number = LPAD(c.ext_code_key, 10, '0')
                JOIN groups x ON TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                WHERE (s.billing_date BETWEEN ? AND ? OR s.billing_date BETWEEN ? AND ?)
                AND c.ext_code_key = ?
                ${baseGroupFilter}
                GROUP BY x.base_group`,
                    [
                        queryFromDate, queryToDate,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate,
                        lastYearFromDate, lastYearToDate,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate,
                        sapCustomerExtKey //cust_id --AND c.customer_id = ?
                    ]
                );

                // Merge actual data with all categories template
                currentCustomerActualData.forEach(actual => {
                    const found = currentCustomerAllCategories.find(cat => cat.base_group === actual.base_group);
                    if (found) {
                        Object.assign(found, actual);
                    }
                });

                // Get benchmark customers' total data
                const benchmarkData = await executeQuery(`
                SELECT 
                    c.ext_code_key,
                    MAX(c.customer_name) AS customer_name,
                    MAX(c.city) AS city,
                    ROUND(SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END), 0) AS currentYearSales,
                    SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS currentYearQty,
                    ROUND(SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END), 0) AS lastYearSales,
                    SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS lastYearQty
                FROM customers c
                JOIN sap_sales s ON s.customer_number = LPAD(c.ext_code_key, 10, '0')
                JOIN groups x ON TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                WHERE (s.billing_date BETWEEN ? AND ? OR s.billing_date BETWEEN ? AND ?)
                AND c.ext_code_key IN (?)
                ${baseGroupFilter}
                GROUP BY c.ext_code_key
                ORDER BY currentYearQty DESC`,
                    [
                        queryFromDate, queryToDate,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate,
                        lastYearFromDate, lastYearToDate,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate,
                        benchmarkExtCodeKeys // benchmarkIds --AND c.customer_id IN (?)
                    ]
                );

                // Get benchmark customers' sales by ALL categories
                const benchmarkAllCategories = await executeQuery(`
                    SELECT 
                        c.ext_code_key,
                        x.base_group,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS currentYearQty,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END) AS currentYearValue,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity ELSE 0 END) AS lastYearQty,
                        SUM(CASE WHEN s.billing_date BETWEEN ? AND ? THEN s.quantity * s.item_price ELSE 0 END) AS lastYearValue
                    FROM customers c
                    JOIN sap_sales s ON s.customer_number = LPAD(c.ext_code_key, 10, '0')
                    JOIN groups x ON TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
                    WHERE (s.billing_date BETWEEN ? AND ? OR s.billing_date BETWEEN ? AND ?)
                    AND c.ext_code_key IN (?)
                    ${baseGroupFilter}
                    GROUP BY c.ext_code_key, x.base_group`,
                    [
                        queryFromDate, queryToDate,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate,
                        lastYearFromDate, lastYearToDate,
                        queryFromDate, queryToDate,
                        lastYearFromDate, lastYearToDate,
                        benchmarkExtCodeKeys // benchmarkIds --AND c.customer_id IN (?)
                    ]
                );

                // Prepare comparison data with parent groups for ALL categories
                const benchmarkComparison = currentCustomerAllCategories.map(category => {
                    const parentGroup = categorizeBaseGroup(category.base_group);

                    const comparisonRow = {
                        base_group: category.base_group,
                        base_group_description: category.base_group || 'Other',
                        parentGroup,
                        current_customer: {
                            currentYearQty: category.currentYearQty,
                            currentYearValue: category.currentYearValue,
                            lastYearQty: category.lastYearQty,
                            lastYearValue: category.lastYearValue,
                            growthPercent: ((category.currentYearQty - category.lastYearQty) / (category.lastYearQty || 1)) * 100
                        },
                        benchmarks: []
                    };

                    // Find benchmark data for this category from all benchmarks
                    benchmarkAllCategories.forEach(benchmark => {
                        if (benchmark.base_group === category.base_group) {
                            comparisonRow.benchmarks.push({
                                ext_code_key: benchmark.ext_code_key,
                                customer_name: '', // Will be filled from benchmarkData
                                city: '', // Will be filled from benchmarkData
                                currentYearQty: benchmark.currentYearQty,
                                currentYearValue: benchmark.currentYearValue,
                                lastYearQty: benchmark.lastYearQty,
                                lastYearValue: benchmark.lastYearValue,
                                growthPercent: ((benchmark.currentYearQty - benchmark.lastYearQty) / (benchmark.lastYearQty || 1)) * 100
                            });
                        }
                    });

                    return comparisonRow;
                });

                // 9. Transform benchmark data for the table layout
                if (benchmarkData.length > 0) {
                    // Create header row with customer names
                    const headerRow = {
                        isHeader: true,
                        category: 'Category',
                        currentCustomer: {
                            name: customerData[0].customer_name + ' (Current)',
                            city: customerData[0].city
                        },
                        benchmarks: benchmarkData.map(benchmark => ({
                            ext_code_key: benchmark.ext_code_key,
                            customer_name: benchmark.customer_name,
                            city: benchmark.city
                        }))
                    };

                    // Create data rows for each base group
                    const dataRows = benchmarkComparison.map(category => {
                        const row = {
                            base_group: category.base_group,
                            base_group_description: category.base_group || 'Other',
                            parentGroup: category.parentGroup,
                            current_customer: category.current_customer,
                            benchmarks: []
                        };

                        // Match benchmarks in the same order as header and fill customer names
                        headerRow.benchmarks.forEach(headerBenchmark => {
                            const foundBenchmark = category.benchmarks.find(b =>
                                b.ext_code_key === headerBenchmark.ext_code_key
                            );

                            if (foundBenchmark) {
                                // Fill in customer name and city from header data
                                foundBenchmark.customer_name = headerBenchmark.customer_name;
                                foundBenchmark.city = headerBenchmark.city;
                                row.benchmarks.push(foundBenchmark);
                            } else {
                                // Create empty benchmark entry
                                row.benchmarks.push({
                                    ext_code_key: headerBenchmark.ext_code_key,
                                    customer_name: headerBenchmark.customer_name,
                                    city: headerBenchmark.city,
                                    currentYearQty: 0,
                                    currentYearValue: 0,
                                    lastYearQty: 0,
                                    lastYearValue: 0,
                                    growthPercent: 0
                                });
                            }
                        });

                        return row;
                    });

                    // Group by parent group
                    const groupedData = {};
                    dataRows.forEach(row => {
                        if (!groupedData[row.parentGroup]) {
                            groupedData[row.parentGroup] = [];
                        }
                        groupedData[row.parentGroup].push(row);
                    });

                    // Create a new object with groups in the desired order
                    const sortedGroupedData = {};
                    const groupOrder = ['Tobacco', 'Regular', 'Other'];

                    // Add groups in the specified order
                    groupOrder.forEach(group => {
                        if (groupedData[group]) {
                            sortedGroupedData[group] = groupedData[group];
                        }
                    });

                    // Add any other groups that might exist
                    Object.keys(groupedData).forEach(group => {
                        if (!sortedGroupedData[group]) {
                            sortedGroupedData[group] = groupedData[group];
                        }
                    });

                    transformedBenchmarkData = {
                        header: headerRow,
                        groupedData: sortedGroupedData
                    };
                }
            }


            // 10. Get all distinct base groups from sap_sales for the dropdown
            const sqlAllBaseGroups = `
            SELECT DISTINCT 
                x.base_group,
                x.base_group as base_group_description
            FROM sap_sales as s, groups as x
            WHERE TRIM(IFNULL(s.material_group, 'X')) = TRIM(IFNULL(x.group_code, 'X'))
            AND s.customer_number = ?
            ORDER BY x.base_group`;

            const allBaseGroups = await executeQuery(sqlAllBaseGroups, [sapCustomerNumber]);

            res.render("customers/customer-view-report", {
                data: customerData[0],
                salesSummary: {
                    ...salesSummary[0],
                    avgMonthly,
                    growthPercent: ((salesSummary[0].currentYearQty - salesSummary[0].lastYearQty) / (salesSummary[0].lastYearQty || 1)) * 100
                },
                baseGroupPerformance,
                monthlyTrend,
                wpData,
                vehData,
                spData,
                topCustomers,
                currentCustomerRank,
                allDistrictCustomers,
                // Financial year dates
                from_date: queryFromDate,
                to_date: queryToDate,
                lastYearFromDate,
                lastYearToDate,
                currentFYStart,
                currentFYEnd,
                lastFYStart,
                lastFYEnd,
                finYear: moment(currentFYStart).format('YYYY'), // moment(lastFYStart).format('YYYY') + '-' + moment(lastFYEnd).format('YYYY'), // e.g. 2022-2023
                // SAP customer details
                selected_base_group: base_group,
                base_groups: allBaseGroups.map(mg => ({
                    value: mg.base_group,
                    label: mg.base_group_description
                })),
                benchmarkData: transformedBenchmarkData,
                hasBenchmarks: hasBenchmarks[0].count > 0,
            });

        } catch (error) {
            console.error(error);
            res.status(500).send("Internal server error");
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
                SELECT 
                    cb.customer_id, 
                    cb.sr_no, 
                    cb.cust_bench_id, 
                    c1.customer_name as main_customer_name,
                    c1.district as main_district,
                    c1.city as main_city,
                    c2.customer_name as benchmark_customer_name,
                    c2.district as bench_district,
                    c2.city as bench_city
                FROM cust_bench cb
                JOIN customers c1 ON cb.customer_id = c1.customer_id
                JOIN customers c2 ON cb.cust_bench_id = c2.customer_id
                ORDER BY c1.customer_name`;

            const results = await executeQuery(sqlStr);
            res.render('customers/customer-benchmark-view', { benchmarks: results });
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    };

    static viewAddBenchmark = async (req, res) => {
        try {
            // Get unique districts from active dealers
            const districts = await executeQuery(`
            SELECT DISTINCT district as district_name 
            FROM customers 
            WHERE customer_type IN ('Dealer','Sub-Dealer') AND status='A' AND district IS NOT NULL
            ORDER BY district
        `);

            // Get all active dealers for fallback
            const dealers = await executeQuery(
                "SELECT customer_id, TRIM(customer_name) as customer_name, district, city FROM customers WHERE customer_type IN ('Dealer','Sub-Dealer') AND status='A' ORDER BY TRIM(customer_name)"
            );

            res.render('customers/customer-benchmark-add', {
                districts,
                dealers
            });
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
                    "SELECT customer_id, TRIM(customer_name) as customer_name FROM customers WHERE customer_type In ('Dealer','Sub-Dealer') AND status='A' ORDER BY TRIM(customer_name)"
                ),
                executeQuery(
                    "SELECT customer_id, TRIM(customer_name) as customer_name FROM customers WHERE customer_type In ('Dealer','Sub-Dealer') AND status='A' ORDER BY TRIM(customer_name)"
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

    /**
     * Filter Cities and Customers
     */
    static filterCities = async (req, res) => {
        try {
            const { district } = req.query;
            const cities = await executeQuery(
                "SELECT DISTINCT city FROM customers WHERE district = ? AND customer_type IN ('Dealer','Sub-Dealer') AND status='A' AND city IS NOT NULL ORDER BY city",
                [district]
            );
            res.json(cities);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    static filterCustomers = async (req, res) => {
        try {
            const { district, city } = req.query;
            const customers = await executeQuery(
                "SELECT customer_id, customer_name FROM customers WHERE district = ? AND city = ? AND customer_type IN ('Dealer','Sub-Dealer') AND status='A' ORDER BY customer_name",
                [district, city]
            );
            res.json(customers);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

};

export default customerController
export { upload }; // Add this at the bottom of the file