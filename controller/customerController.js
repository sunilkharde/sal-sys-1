import { executeQuery } from '../db.js';

//const conn = await pool.getConnection();
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

    //To view all customer to update additional Information by Anil Shinde
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

            let sqlStr = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area,a.ext_code" +
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
            const sqlStr = "Select a.*,CONCAT(b.username,' [', b.email_id,']') as username,c.market_area" +
                " From customers as a LEFT JOIN users as b ON (a.user_id=b.user_id)" +
                " LEFT JOIN market_area as c ON (a.market_area_id=c.market_area_id)" +
                " Where a.customer_id= ?";
            const params = [cust_id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0];

            //This code is for Vehicle information
            let sqlVeh = `Select * from cust_veh where customer_id = ${cust_id}`;
            let vehData = await executeQuery(sqlVeh);
            if (vehData.length === 0) {
                sqlVeh = `Select 1 as sr_no, '' as reg_no, '' as veh_type, '' as ins_no, NULL as ins_date From dual`;
                vehData = await executeQuery(sqlVeh);
            }

            //This code is for Salesman information
            let sqlSp = `Select * from cust_sp where customer_id = ${cust_id}`;
            let spData = await executeQuery(sqlSp);
            if (spData.length === 0) {
                sqlSp = `select 1 as sr_no, '' as sp_type, '' as sp_name, '' as sp_mobile From dual`;
                spData = await executeQuery(sqlSp);
            }

            res.render("customers/customer-edit-info", { data: data1, vehData, spData });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    };

    static updateInfo = async (req, res) => {
        const { cust_id } = req.params;
        const { godown_area, total_counters, gst_no, cust_care_no, sr_no, reg_no, veh_type, ins_no, ins_date, sp_type, sp_name, sp_mobile } = req.body;
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
            const sqlStr = "Update customers Set godown_area=?, total_counters=?, gst_no=?, cust_care_no=?, upd_by=?, upd_at=CURRENT_TIMESTAMP WHERE customer_id=?";
            const params = [godown_area, total_counters, gst_no, cust_care_no, upd_by, cust_id,];
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
                const sqlVeh = "Insert into cust_veh (customer_id,sr_no,reg_no,veh_type,ins_no,ins_date) values (?,?,?,?,?,?)";
                const paramsVeh = [cust_id, sr_no_val, regNoVal[i], vehTypeVal[i], insNoVal[i], insDateVal[i]];
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

};

export default customerController