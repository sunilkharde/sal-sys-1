import pool from '../db.js';

const conn = await pool.getConnection();
class dealerPayController {
    
    static getData = async () => {
        try {
            const [pay_mode_list] = await conn.query("SELECT * FROM pay_modes Where status='A'");
            const [bu_list] = await conn.query("SELECT bu_id, CONCAT(bu_code,' | ',bu_short) as bu_name FROM business_units Where status='A'")
            return [pay_mode_list, bu_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static viewBlank = async (req, res) => {
        const [pay_mode_list, bu_list] = await this.getData();
        res.render('dealerPay/dealerPay-create', { pay_mode_list, bu_list });
    }

    static create = async (req, res) => {
        const { customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, pay_modes_id, user_id, ext_code, geo_location, customer_type, status } = req.body;
        const data = req.body
        const [pay_mode_list, bu_list] = await this.getData();
        //const conn = await pool.getConnection();

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
        if (!pay_modes_id) {
            errors.push({ message: "Select customer's market area" });
        }
        if (!user_id) {
            errors.push({ message: "Select login details for customer" });
        }
        if (!ext_code) {
            errors.push({ message: "Select external code for customer" });
        }
        // if (isNaN(rate) || rate <= 0) {
        //     errors.push({ message: 'Price must be a number' });
        // }
        const [rows] = await conn.query('SELECT * FROM customers WHERE customer_name=?', [customer_name]);
        if (rows.length > 0) {
            errors.push({ message: 'Customer with this name is already exists' });
        }
        if (errors.length) {
            res.render('dealerPay/dealerPay-create', { errors, data, pay_mode_list, bu_list });
            return;
        }

        try {
            // Genrate max Customer id
            const [rows1] = await conn.query('SELECT Max(customer_id) AS maxNumber FROM customers');
            var nextCustomerID = rows1[0].maxNumber + 1;

            // Insert new record into database
            await conn.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO customers (customer_id,customer_name,nick_name,add1,add2,add3,city,pin_code,district,state,pay_modes_id,user_id,ext_code,geo_location,customer_type,status,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const paramsCust = [nextCustomerID, customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, pay_modes_id, user_id, ext_code, geo_location, customer_type, status_new, c_by];
            const [result] = await conn.query(sqlStr, paramsCust);
            await conn.commit();

            //return res.render('dealerPay/dealerPay-view', { alert: `Save Customer successfully` });
            res.redirect('/customer/view');
            //res.redirect('/');

        } catch (err) {
            await conn.rollback();
            conn.release();

            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

    static viewAll = async (req, res) => {
        //const conn = await pool.getConnection();
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        try {
            const sqlStr = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.pay_modes,a.customer_type" +
                " from customers as a, pay_modes as b " +
                " Where a.pay_modes_id=b.pay_modes_id";
            const [results] = await conn.query(sqlStr)//, params);

            res.render('dealerPay/dealerPay-view', { customers: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static edit = async (req, res) => {
        const { id } = req.params;
        try {
            const [pay_mode_list, bu_list] = await this.getData();
            const sqlStr = "Select a.*,CONCAT(b.username,' [', b.email_id,']') as username,c.pay_modes" +
                " From customers as a LEFT JOIN users as b ON (a.user_id=b.user_id)" +
                " LEFT JOIN pay_modes as c ON (a.pay_modes_id=c.pay_modes_id)" +
                " Where a.customer_id= ?";
            const params = [id];
            const [results] = await conn.query(sqlStr, params);
            //
            res.render('dealerPay/dealerPay-edit', { data: results[0], pay_mode_list, bu_list });
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static update = async (req, res) => {
        const { id } = req.params;
        const { customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, pay_modes_id, user_id, ext_code, geo_location, customer_type, status } = req.body;
        const data = req.body
        const [pay_mode_list, bu_list] = await this.getData();
        //const conn = await pool.getConnection();

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
        if (!pay_modes_id) {
            errors.push({ message: "Select customer's market area" });
        }
        if (!user_id) {
            errors.push({ message: "Select login details for customer" });
        }
        if (!ext_code) {
            errors.push({ message: "Select external code for customer" });
        }
        // if (isNaN(rate) || rate <= 0) {
        //     errors.push({ message: 'Price must be a number' });
        // }
        const [rows] = await conn.query('SELECT * FROM customers WHERE customer_name=? and customer_id<>?', [customer_name, id]);
        if (rows.length > 0) {
            errors.push({ message: 'Customer with this name is already exists' });
        }
        if (errors.length) {
            res.render('dealerPay/dealerPay-edit', { errors, data, pay_mode_list, bu_list });
            return;
        }

        try {
            // Update record into database using customer_id
            await conn.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE Customers Set customer_name=?,nick_name=?,add1=?,add2=?,add3=?,city=?,pin_code=?,district=?,state=?,pay_modes_id=?,user_id=?,ext_code=?,geo_location=?,customer_type=?,status=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE customer_id=?"
            const params = [customer_name, nick_name, add1, add2, add3, city, pin_code, district, state, pay_modes_id, user_id, ext_code, geo_location, customer_type, status_new, u_by, id];
            const [result] = await conn.query(sqlStr, params);
            await conn.commit();

            //res.redirect('/customer/view');
            res.redirect('/customer/view?alert=Update+Customer+successfully');

        } catch (err) {
            await conn.rollback();
            conn.release();
            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

    static delete = async (req, res) => {
        const { id } = req.params;
        try {
            var errors = [];
            const sqlStr3 = "Select * from po_hd Where customer_id=?"
            const params3 = [id];
            const [rows] = await conn.query(sqlStr3, params3);
            if (rows.length > 0) {
                errors.push({ message: "Reference exist, master entry can't delete" });
            }
            conn.release;
            //            
            if (errors.length) {
                res.redirect(`/customer/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            await conn.beginTransaction();
            const sqlStr = "Delete from customers WHERE customer_id=?"
            const params = [id];
            const [result] = await conn.query(sqlStr, params);
            await conn.commit();
            //
            //res.redirect('/customer/view');
            res.redirect('/customer/view?alert=customer+deleted+successfully');
        } catch (err) {
            await conn.rollback();
            conn.release();
            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

};

export default dealerPayController