import { executeQuery } from '../db.js';
import moment from 'moment';

//const conn = await pool.getConnection();
class poController {

    static getData = async (req, user) => {
        try {
            var user_role = user.user_role !== null && user.user_role !== undefined ? user.user_role : 'User';
            //const conn = await pool.getConnection();
            var sqlCust = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area,c.bu_id,CONCAT(d.bu_code,' | ',d.bu_name) as bu_name" +
                " from customers as a, market_area as b, customers_bu as c, business_units as d " +
                " Where a.market_area_id=b.market_area_id and a.status='A'" +
                " and a.customer_id=c.customer_id and c.bu_id=d.bu_id"
            if (user_role !== "Admin") {
                sqlCust = sqlCust + ` and a.user_id=${user.user_id}`;
            }
            const customer_list = await executeQuery(sqlCust);
            //conn.release

            //const conn1 = await pool.getConnection();
            const bu_list = await executeQuery("SELECT bu_id, CONCAT(bu_code,' | ',bu_name) as bu_name FROM business_units Where status='A'")
            // conn1.release

            //const [product_list] = await executeQuery("SELECT * FROM products as a Where a.status='A'");

            return [customer_list, bu_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static getBuList = async (req, res) => {
        try {
            const { customer_id } = req.query;
            const sqlStr = "SELECT a.bu_id, CONCAT(a.bu_code,' | ',a.bu_name) as bu_name FROM business_units as a, customers_bu as b " +
                " Where a.bu_id=b.bu_id and a.status='A' and b.customer_id = ?"
            const cust_bu_list = await executeQuery(sqlStr, [customer_id]);
            //conn.release;
            res.json({ CustBuList: cust_bu_list });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        } finally {
            //conn.release;
        }
    }

    static getProductList = async (req, res) => {
        try {
            const { bu_id } = req.query;
            //const conn = await pool.getConnection();
            const sqlStr = "SELECT a.product_id, a.product_name FROM products as a, products_bu as b" +
                " WHERE a.product_id=b.product_id and b.bu_id = ?";
            const productsList = await executeQuery(sqlStr, [bu_id]);
            //conn.release;
            res.json({ products_list: productsList });

        } catch (err) {
            //conn.release;
            console.error(err);
            res.status(500).send('Internal Server Error');
        } finally {
            //conn.release;
        }
    }

    static viewBlank = async (req, res) => {
        const [customer_list, bu_list] = await this.getData(req, res.locals.user);

        try {
            const row = await executeQuery("SELECT CURRENT_DATE() as po_date;")
            const poDate = row[0].po_date
            const minDate = moment(poDate);
            const maxDate = moment(poDate).add(15, 'days');
            const data = { po_date: poDate, po_no: '*****', exp_date: minDate, minDate, maxDate };
            res.render('po/po-create', { customer_list, bu_list, data });
        } catch (err) {
            //conn.release();
            console.error(err);
            return res.render('po/po-create', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    }

    static create = async (req, res) => {
        //const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, 'sr_no[]': sr_no, 'bu_ids[]': bu_ids, 'bu_names[]': bu_names, 'product_id[]': product_id, 'product_name[]': product_name, 'qty[]': qty, 'rate[]': rate, 'amount[]': amount } = req.body;
        const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, sr_no, bu_ids, bu_names, product_id, product_name, qty, rate, amount } = req.body;
        const data = req.body  //po_date, po_no, po_no_new, 
        const [customer_list, bu_list] = await this.getData(req, res.locals.user);

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id_hdn) {
            errors.push({ message: 'Select business unit' });
        }
        if (!exp_date) {
            errors.push({ message: 'Select expected date' });
        }
        // if (isNaN(rate) || rate <= 0) {
        //     errors.push({ message: 'Price must be a number' });
        // }
        //const conn = await pool.getConnection();
        const row = await executeQuery("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as po_date;")
        //conn.release
        var sysDate = row[0].po_date;
        if (exp_date < sysDate) {
            errors.push({ message: 'Expected date should greater than today' });
        }
        //
        if (errors.length) {
            res.render('po/po-create', { errors, data, customer_list, bu_list });
            return;
        }

        try {
            // Get CURRENT_DATE
            //const conn1 = await pool.getConnection();
            const row = await executeQuery("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as po_date;")
            // conn1.release
            const curDate = row[0].po_date;
            // Genrate max Customer id
            // const conn2 = await pool.getConnection();
            const rows1 = await executeQuery(`SELECT Max(po_no) AS maxNumber FROM po_hd Where po_date='${curDate}'`);
            // conn2.release
            var nextPoNo = rows1[0].maxNumber + 1;
            var poNoNew = 'NJ' + curDate.replace(/-/g, '') + nextPoNo.toString().padStart(3, '0');

            // Insert new record into database
            // const conn3 = await pool.getConnection();
            // await conn3.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO po_hd (po_date,po_no,po_no_new,customer_id,exp_date,bu_id,posted,ftp_date,status,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const params = [curDate, nextPoNo, poNoNew, customer_id, exp_date, bu_id_hdn, 'Y', ftp_date, status_new, c_by];
            await executeQuery(sqlStr, params);
            // await conn3.commit();
            // conn3.release

            const product_id_val = Array.isArray(product_id) ? product_id : [product_id];
            const qty_val = Array.isArray(qty) ? qty : [qty];
            const rate_val = Array.isArray(rate) ? rate : [rate];
            const amount_val = Array.isArray(amount) ? amount : [amount];
            for (let i = 0; i < product_id_val.length; i++) {
                let sr_no_val = (i + 1) * 10;
                const sqlStr2 = "INSERT INTO po_dt (po_date, po_no, sr_no, bu_id, product_id, qty, rate, amount)" +
                    " VALUES (?,?,?,?,?,?,?,?)"
                const paramsDt = [curDate, nextPoNo, sr_no_val, bu_id_hdn, product_id_val[i], qty_val[i], rate_val[i], amount_val[i]];
                await executeQuery(sqlStr2, paramsDt); //const [result2] =
            }

            // await conn4.commit();
            // conn4.release

            //return res.render('po/po-view', { alert: `Save Customer successfully` });
            res.redirect('/po/view');
            //res.redirect('/');

        } catch (err) {
            console.error(err);
            return res.render('po/po-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static viewAll = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        try {//DATE_FORMAT(a.po_date,'%d/%m/%Y') as po_date2, DATE_FORMAT(a.exp_date,'%d/%m/%Y') as exp_date
            //const conn = await pool.getConnection();
            const sqlStr = "Select a.po_date,a.po_no,a.po_no_new,b.customer_name,a.exp_date,CONCAT(c.bu_code,' | ',c.bu_short) as bu_name,a.posted,a.ftp_date,a.status" +
                " FROM po_hd as a, customers as b, business_units as c" +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.c_by=?" //+
            //" Order By a.po_date desc, a.po_no desc";
            const params = [res.locals.user.user_id];
            const results = await executeQuery(sqlStr, params);
            //conn.release
            res.render('po/po-view', { po: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static edit = async (req, res) => {
        const { po_date, po_no } = req.params;
        try {
            const [customer_list, bu_list] = await this.getData(req, res.locals.user);

            //const conn = await pool.getConnection();
            const sqlStr = "Select a.*,b.customer_name,c.bu_name" +
                " FROM po_hd as a, customers as b, business_units as c" +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.po_date=? and a.po_no=?";
            const params = [po_date, po_no];
            const results = await executeQuery(sqlStr, params);
            //conn.release
            //
            //const conn1 = await pool.getConnection();
            const sqlStr2 = "Select a.*,b.product_name" +
                " FROM po_dt as a, products as b" +
                " Where a.product_id=b.product_id and a.po_date=? and a.po_no=? Order By a.sr_no";
            const params2 = [po_date, po_no];
            const results2 = await executeQuery(sqlStr2, params2);
            // conn1.release
            //
            // const conn3 = await pool.getConnection();
            const sqlStr3 = "SELECT a.product_id, a.product_name FROM products as a, products_bu as b" +
                " WHERE a.product_id=b.product_id and b.bu_id =?";
            const productsList = await executeQuery(sqlStr3, results[0].bu_id);
            // conn3.release
            //
             const minDate = moment(po_date);  //moment(po_date, 'YYYY-MM-DD');
             const maxDate = moment(minDate).add(15, 'days');
            console.log('Date..Edit...... Min ' + minDate + ' Max ' + maxDate  )
            res.render('po/po-edit', { data: results[0], minDate, maxDate, data2: results2, customer_list, bu_list, productsList });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static update = async (req, res) => {
        const { po_date, po_no } = req.params;
        //const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, 'sr_no[]': sr_no, 'bu_ids[]': bu_ids, 'bu_names[]': bu_names, 'product_id[]': product_id, 'product_name[]': product_name, 'qty[]': qty, 'rate[]': rate, 'amount[]': amount } = req.body;
        const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, sr_no, bu_ids, bu_names, product_id, product_name, qty, rate, amount } = req.body;
        const data = req.body  //po_date, po_no, po_no_new, 
        const [customer_list, bu_list] = await this.getData(req, res.locals.user);

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id_hdn) {
            errors.push({ message: 'Select business unit' });
        }
        if (!exp_date) {
            errors.push({ message: 'Select expected date' });
        }
        // if (isNaN(rate) || rate <= 0) {
        //     errors.push({ message: 'Price must be a number' });
        // }
        // const [rows] = await executeQuery('SELECT * FROM po_hd WHERE po_date=? and po_no=? and bu_id=?', [po_date, po_no, bu_id_hdn]);
        // if (rows.length === 0) {
        //     errors.push({ message: 'Business unit can not change' });
        // }
        //const conn = await pool.getConnection();
        const row = await executeQuery("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as po_date;")
        //conn.release
        var sysDate = row[0].po_date;
        if (exp_date < sysDate) {
            errors.push({ message: 'Expected date should greater than today' });
        }
        //conn.release;
        //
        if (errors.length) {
            // const conn2 = await pool.getConnection();
            const sqlStr2 = "Select a.*,b.product_name" +
                " FROM po_dt as a, products as b" +
                " Where a.product_id=b.product_id and a.po_date=? and a.po_no=? Order By a.sr_no";
            const params2 = [po_date, po_no];
            const poDetails = await executeQuery(sqlStr2, params2);
            // conn2.release
            //
            // const conn3 = await pool.getConnection();
            const sqlStr3 = "SELECT a.product_id, a.product_name FROM products as a, products_bu as b" +
                " WHERE a.product_id=b.product_id and b.bu_id =?";
            const productsList = await executeQuery(sqlStr3, bu_id_hdn);
            // conn3.release
            //
            res.render('po/po-edit', { errors, data, customer_list, bu_list, data2: poDetails, productsList });
            return;
        }

        try {
            // Update record into database using customer_id
            // const conn4 = await pool.getConnection();
            // await conn4.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE po_hd Set customer_id=?,bu_id=?,exp_date=?,status=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE po_date=? and po_no=?"
            const params = [customer_id, bu_id_hdn, exp_date, status_new, u_by, po_date, po_no];
            await executeQuery(sqlStr, params);
            // await conn4.commit();
            // conn4.release
            //
            // Delete records from po_dt
            // const conn5 = await pool.getConnection();
            const sqlStr3 = "Delete FROM po_dt WHERE po_date=? and po_no=?"
            const params3 = [po_date, po_no];
            await executeQuery(sqlStr3, params3);
            // conn5.release
            //

            // Insert new records into po_dt
            // const conn6 = await pool.getConnection();
            // conn6.beginTransaction

            const product_id_val = Array.isArray(product_id) ? product_id : [product_id];
            const qty_val = Array.isArray(qty) ? qty : [qty];
            const rate_val = Array.isArray(rate) ? rate : [rate];
            const amount_val = Array.isArray(amount) ? amount : [amount];
            for (let i = 0; i < product_id.length; i++) {
                let sr_no_val = (i + 1) * 10;
                const sqlStr2 = "INSERT INTO po_dt (po_date, po_no, sr_no, bu_id, product_id, qty, rate, amount)" +
                    " VALUES (?,?,?,?,?,?,?,?)"
                const paramsDt = [po_date, po_no, sr_no_val, bu_id_hdn, product_id_val[i], qty_val[i], rate_val[i], amount_val[i]];
                await executeQuery(sqlStr2, paramsDt);
            }

            // await conn6.commit();
            // conn6.release

            //res.redirect('/po/view');
            res.redirect('/po/view?alert=Update+Order+successfully');

        } catch (err) {
            console.error(err);
            return res.render('po/po-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static delete = async (req, res) => {
        const { po_date, po_no } = req.params;
        try {
            var errors = [];
            //const conn = await pool.getConnection();
            const sqlStr3 = "Select * from po_hd Where po_date=? and po_no=? and posted='Y'"
            const params3 = [po_date, po_no];
            const rows = await executeQuery(sqlStr3, params3);
            //conn.release
            if (rows.length > 0) {
                errors.push({ message: "Posted entry can't delete" });
            }
            //            
            if (errors.length) {
                //res.render('po/po-view', { errors });
                res.redirect(`/po/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            const params = [po_date, po_no];
            //const conn1 = await pool.getConnection();
            // await conn1.beginTransaction();
            const sqlStr1 = "Delete FROM po_dt WHERE po_date=? and po_no=?"
            await executeQuery(sqlStr1, params);
            //
            const sqlStr2 = "Delete FROM po_hd WHERE po_date=? and po_no=?"
            await executeQuery(sqlStr2, params);
            // await conn1.commit();
            // conn1.release
            //
            //res.redirect('/po/view');
            res.redirect('/po/view?alert=customer+deleted+successfully');

        } catch (err) {
            console.error(err);
            return res.render('po/po-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

};

export default poController