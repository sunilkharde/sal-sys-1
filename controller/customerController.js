import { executeQuery } from '../db.js';

//const conn = await pool.getConnection();
class customerController {

    static getData = async () => {
        try {
            //const conn = await pool.getConnection();
            const cities_list = await executeQuery("SELECT * FROM cities");
            //conn.release

            //const conn1 = await pool.getConnection();
            const users_list = await executeQuery("SELECT a.*, CONCAT(a.username, ' [', a.email_id,']') as map_user FROM users as a Where a.status='A' and a.user_role='Dealer'");
            //conn1.release

            //const conn2 = await pool.getConnection();
            const market_area_list = await executeQuery("SELECT * FROM market_area Where status='A'");
            //conn2.release

            // const conn3 = await pool.getConnection();
            const bu_list = await executeQuery("SELECT bu_id, CONCAT(bu_code,' | ',bu_name) as bu_name FROM business_units Where status='A'")
            // conn3.release

            return [cities_list, users_list, market_area_list, bu_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static viewBlank = async (req, res) => {
        const [cities_list, users_list, market_area_list, bu_list] = await this.getData();
        res.render('customers/customer-create', { cities_list, users_list, market_area_list, bu_list });
    }

    static create = async (req, res) => {
        const { customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status, bu_id } = req.body;
        const data = req.body
        const [cities_list, users_list, market_area_list, bu_list] = await this.getData();
        ////const conn = await pool.getConnection();

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
        //const conn = await pool.getConnection();
        const rows = await executeQuery('SELECT * FROM customers WHERE customer_name=?', [customer_name]);
        //conn.release
        if (rows.length > 0) {
            errors.push({ message: 'Customer with this name is already exists' });
        }
        if (errors.length) {
            res.render('customers/customer-create', { errors, data, cities_list, users_list, market_area_list, bu_list, selectedBu_list });
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
            const sqlStr = "INSERT INTO customers (customer_id,customer_name,nick_name,add1,add2,add3,city,pin_code,district,state,market_area_id,user_id,ext_code,geo_location,customer_type,status,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const paramsCust = [nextCustomerID, customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status_new, c_by];
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
            //const conn = await pool.getConnection();
            const sqlStr = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area,a.ext_code" +
                " from customers as a, market_area as b " +
                " Where a.market_area_id=b.market_area_id";
            const results = await executeQuery(sqlStr)//, params);
            //conn.release

            res.render('customers/customer-view', { customers: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static edit = async (req, res) => {
        const { id } = req.params;

        try {
            const [cities_list, users_list, market_area_list, bu_list] = await this.getData();

            const rows1 = await executeQuery(`SELECT bu_id FROM customers_bu Where customer_id=${id}`);
            const selectedBu_list = rows1.map(row => row.bu_id); //store result as array 

            //const conn = await pool.getConnection();
            const sqlStr = "Select a.*,CONCAT(b.username,' [', b.email_id,']') as username,c.market_area" +
                " From customers as a LEFT JOIN users as b ON (a.user_id=b.user_id)" +
                " LEFT JOIN market_area as c ON (a.market_area_id=c.market_area_id)" +
                " Where a.customer_id= ?";
            const params = [id];
            const results = await executeQuery(sqlStr, params);
            //conn.release
            //
            res.render('customers/customer-edit', { data: results[0], cities_list, users_list, market_area_list, bu_list, selectedBu_list });
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static update = async (req, res) => {
        const { id } = req.params;
        const { customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status, bu_id } = req.body;
        const data = req.body
        const [cities_list, users_list, market_area_list, bu_list] = await this.getData();

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
        const rows = await executeQuery('SELECT * FROM customers WHERE customer_name=? and customer_id<>?', [customer_name, id]);
        //conn.release
        if (rows.length > 0) {
            errors.push({ message: 'Dealer with this name is already exists' });
        }
        if (errors.length) {
            res.render('customers/customer-edit', { errors, data, cities_list, users_list, market_area_list, bu_list, selectedBu_list });
            return;
        }

        try {
            // Update record into database using customer_id
            //const conn1 = await pool.getConnection();
            // await conn1.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE customers Set customer_name=?,nick_name=?,add1=?,add2=?,add3=?,city=?,pin_code=?,district=?,state=?,market_area_id=?,user_id=?,ext_code=?,geo_location=?,customer_type=?,status=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE customer_id=?"
            const params = [customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, market_area_id, user_id, ext_code, geo_location, customer_type, status_new, u_by, id];
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

};

export default customerController