import pool from '../db.js';

const conn = await pool.getConnection();
class poController {

    static getData = async (req, user) => {
        try {
            var user_role = user.user_role !== null && user.user_role !== undefined ? user.user_role : 'User';
            var sqlCust = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area,a.customer_type" +
                " from customers as a, market_area as b " +
                " Where a.market_area_id=b.market_area_id and a.status='A'"
            if (user_role !== "Admin") {
                sqlCust = sqlCust + ` and a.user_id=${user.user_id}`;
            }
            const [customer_list] = await conn.query(sqlCust);
            const [bu_list] = await conn.query("SELECT bu_id, CONCAT(bu_code,' | ',bu_short) as bu_name FROM business_units Where status='A'")
            //const [product_list] = await conn.query("SELECT * FROM products as a Where a.status='A'");

            return [customer_list, bu_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static getProductList = async (req, res) => {
        try {
            const { bu_id } = req.query;
            const sqlStr = "SELECT a.product_id, a.product_name FROM products as a, products_bu as b" +
                " WHERE a.product_id=b.product_id and b.bu_id = ?";
            const [productsList] = await conn.query(sqlStr, [bu_id]);
            conn.release;
            res.json({ products_list: productsList });

        } catch (err) {
            conn.release;
            console.error(err);
            res.status(500).send('Internal Server Error');
        } finally {
            conn.release;
        }
    }

    static viewBlank = async (req, res) => {
        //const [customer_list, bu_list] = await this.getData(req, res.locals.user);
        const [customer_list, bu_list] = await this.getData(req, res.locals.user);

        try {
            const [row] = await conn.query("SELECT DATE_FORMAT(CURRENT_DATE(),'%d-%m-%Y') as po_date;")
            const data = { po_date: row[0].po_date, po_no: '*****' };
            res.render('po/po-create', { customer_list, bu_list, data, conn });
        } catch (err) {
            conn.release();
            console.error(err);
            return res.render('po/po-create', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    }

    static create = async (req, res) => {
        const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, 'sr_no[]': sr_no, 'bu_ids[]': bu_ids, 'bu_names[]': bu_names, 'product_id[]': product_id, 'product_name[]': product_name, 'qty[]': qty, 'rate[]': rate, 'amount[]': amount } = req.body;
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
        const [row] = await conn.query("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as po_date;")
        var sysDate = row[0].po_date;
        if (exp_date < sysDate) {
            errors.push({ message: 'Expected date should greater than today' });
        }
        conn.release;
        //
        if (errors.length) {
            res.render('po/po-create', { errors, data, customer_list, bu_list });
            return;
        }

        try {
            // Get CURRENT_DATE
            const [row] = await conn.query("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as po_date;")
            const curDate = row[0].po_date;
            // Genrate max Customer id
            const [rows1] = await conn.query(`SELECT Max(po_no) AS maxNumber FROM po_hd Where po_date='${curDate}'`);
            var nextPoNo = rows1[0].maxNumber + 1;
            var poNoNew = 'NJ' + curDate.replace(/-/g, '') + nextPoNo.toString().padStart(3, '0');

            // Insert new record into database
            await conn.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO po_hd (po_date,po_no,po_no_new,customer_id,exp_date,bu_id,posted,ftp_date,status,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const params = [curDate, nextPoNo, poNoNew, customer_id, exp_date, bu_id_hdn, 'Y', ftp_date, status_new, c_by];
            const [result] = await conn.query(sqlStr, params);
            //await conn.commit();

            // Insert new records into po_dt
            // const product_id = req.body['product_id[]'];
            // for (let i = 0; i < product_id.length; i++) {
            //     const sr_no = (i + 1) * 10;
            //     //const bu_ids = req.body.bu_ids[i];
            //     const product_id = req.body.product_id[i];
            //     const qty = req.body.qty[i];
            //     const rate = req.body.rate[i];
            //     const amount = qty * rate;
            //     const sqlStr2 = "INSERT INTO po_dt (po_date, po_no, sr_no, bu_id, product_id, qty, rate, amount)" +
            //         " VALUES (?,?,?,?,?,?,?,?)"
            //     const paramsDt = [curDate, nextPoNo, sr_no, bu_id_hdn, product_id, qty, rate, amount];
            //     await conn.query(sqlStr2, paramsDt); //const [result2] =
            // }

            // Insert new records into po_dt
            for (let i = 0; i < product_id.length; i++) {
                const sr_no_val = (i + 1) * 10;
                //const bu_ids_val = bu_ids[i];
                const product_id_val = product_id[i];
                const qty_val = qty[i];
                const rate_val = rate[i];
                const amount_val = amount[i];
                const sqlStr2 = "INSERT INTO po_dt (po_date, po_no, sr_no, bu_id, product_id, qty, rate, amount)" +
                    " VALUES (?,?,?,?,?,?,?,?)"
                const paramsDt = [curDate, nextPoNo, sr_no_val, bu_id_hdn, product_id_val, qty_val, rate_val, amount_val];
                await conn.query(sqlStr2, paramsDt); //const [result2] =
            }
            await conn.commit();

            //return res.render('po/po-view', { alert: `Save Customer successfully` });
            res.redirect('/po/view');
            //res.redirect('/');

        } catch (err) {
            await conn.rollback();
            conn.release();

            console.error(err);
            return res.render('po/po-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

    static viewAll = async (req, res) => {
        //const conn = await pool.getConnection();
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        try {//DATE_FORMAT(a.po_date,'%d-%m-%Y') as po_date2, DATE_FORMAT(a.exp_date,'%d-%m-%Y') as exp_date
            const sqlStr = "Select a.po_date, a.po_no,a.po_no_new,b.customer_name,a.exp_date,CONCAT(c.bu_code,' | ',c.bu_short) as bu_name,a.posted,a.ftp_date,a.status" +
                " FROM po_hd as a, customers as b, business_units as c" +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.c_by=?" +
                " Order By a.po_date desc, a.po_no desc";
            const params = [res.locals.user.user_id];
            const [results] = await conn.query(sqlStr, params);
            res.render('po/po-view', { po: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static edit = async (req, res) => {
        const { po_date, po_no } = req.params;
        try {
            const [customer_list, bu_list] = await this.getData(req, res.locals.user);
            const sqlStr = "Select a.*,b.customer_name,c.bu_name" +
                " FROM po_hd as a, customers as b, business_units as c" +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.po_date=? and a.po_no=?";
            const params = [po_date, po_no];
            const [results] = await conn.query(sqlStr, params);
            //
            const sqlStr2 = "Select a.*,b.product_name" +
                " FROM po_dt as a, products as b" +
                " Where a.product_id=b.product_id and a.po_date=? and a.po_no=? Order By a.sr_no";
            const params2 = [po_date, po_no];
            const [results2] = await conn.query(sqlStr2, params2);
            //
            const sqlStr3 = "SELECT a.product_id, a.product_name FROM products as a, products_bu as b" +
                " WHERE a.product_id=b.product_id and b.bu_id =?";
            const [productsList] = await conn.query(sqlStr3, results[0].bu_id);
            //
            res.render('po/po-edit', { data: results[0], data2: results2, customer_list, bu_list, productsList });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static update = async (req, res) => {
        const { po_date, po_no } = req.params;
        const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, 'sr_no[]': sr_no, 'bu_ids[]': bu_ids, 'bu_names[]': bu_names, 'product_id[]': product_id, 'product_name[]': product_name, 'qty[]': qty, 'rate[]': rate, 'amount[]': amount } = req.body;
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
        // const [rows] = await conn.query('SELECT * FROM po_hd WHERE po_date=? and po_no=? and bu_id=?', [po_date, po_no, bu_id_hdn]);
        // if (rows.length === 0) {
        //     errors.push({ message: 'Business unit can not change' });
        // }
        const [row] = await conn.query("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as po_date;")
        var sysDate = row[0].po_date;
        if (exp_date < sysDate) {
            errors.push({ message: 'Expected date should greater than today' });
        }
        conn.release;
        //
        if (errors.length) {
            const sqlStr2 = "Select a.*,b.product_name" +
                " FROM po_dt as a, products as b" +
                " Where a.product_id=b.product_id and a.po_date=? and a.po_no=? Order By a.sr_no";
            const params2 = [po_date, po_no];
            const [poDetails] = await conn.query(sqlStr2, params2);
            //
            const sqlStr3 = "SELECT a.product_id, a.product_name FROM products as a, products_bu as b" +
                " WHERE a.product_id=b.product_id and b.bu_id =?";
            const [productsList] = await conn.query(sqlStr3, bu_id_hdn);
            //
            res.render('po/po-edit', { errors, data, customer_list, bu_list, data2: poDetails, productsList });
            return;
        }

        try {
            // Update record into database using customer_id
            await conn.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE po_hd Set customer_id=?,bu_id=?,exp_date=?,status=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE po_date=? and po_no=?"
            const params = [customer_id, bu_id_hdn, exp_date, status_new, u_by, po_date, po_no];
            await conn.query(sqlStr, params);
            //
            // Delete records from po_dt
            const sqlStr3 = "Delete FROM po_dt WHERE po_date=? and po_no=?"
            const params3 = [po_date, po_no];
            await conn.query(sqlStr3, params3);
            //

            // Insert new records into po_dt
            // const product_id = req.body['product_id[]'];
            // for (let i = 0; i < product_id.length; i++) {
            //     const sr_no = (i + 1) * 10;
            //     //const bu_ids = req.body.bu_ids[i];
            //     const product_id = req.body.product_id[i];
            //     const qty = req.body.qty[i];
            //     const rate = req.body.rate[i];
            //     const amount = qty * rate;
            //     const sqlStr2 = "INSERT INTO po_dt (po_date, po_no, sr_no, bu_id, product_id, qty, rate, amount)" +
            //         " VALUES (?,?,?,?,?,?,?,?)"
            //     const paramsDt = [po_date, po_no, sr_no, bu_id_hdn, product_id, qty, rate, amount];
            //     await conn.query(sqlStr2, paramsDt); //const [result2] =
            // }

            // Insert new records into po_dt
            for (let i = 0; i < product_id.length; i++) {
                const sr_no_val = (i + 1) * 10;
                //const bu_ids_val = bu_ids[i];
                const product_id_val = product_id[i];
                const qty_val = qty[i];
                const rate_val = rate[i];
                const amount_val = amount[i];
                const sqlStr2 = "INSERT INTO po_dt (po_date, po_no, sr_no, bu_id, product_id, qty, rate, amount)" +
                    " VALUES (?,?,?,?,?,?,?,?)"
                const paramsDt = [po_date, po_no, sr_no_val, bu_id_hdn, product_id_val, qty_val, rate_val, amount_val];
                await conn.query(sqlStr2, paramsDt);
            }
            await conn.commit();

            //res.redirect('/po/view');
            res.redirect('/po/view?alert=Update+Order+successfully');

        } catch (err) {
            await conn.rollback();
            conn.release();
            console.error(err);
            return res.render('po/po-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

    static delete = async (req, res) => {
        const { po_date, po_no } = req.params;
        try {
            var errors = [];
            const sqlStr3 = "Select * from po_hd Where po_date=? and po_no=? and posted='Y'"
            const params3 = [po_date, po_no];
            const [rows] = await conn.query(sqlStr3, params3);
            if (rows.length > 0) {
                errors.push({ message: "Posted entry can't delete" });
            }
            conn.release;
            //            
            if (errors.length) {
                //res.render('po/po-view', { errors });
                res.redirect(`/po/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            const params = [po_date, po_no];
            await conn.beginTransaction();
            const sqlStr1 = "Delete FROM po_dt WHERE po_date=? and po_no=?"
            await conn.query(sqlStr1, params);
            //
            const sqlStr2 = "Delete FROM po_hd WHERE po_date=? and po_no=?"
            await conn.query(sqlStr2, params);
            await conn.commit();
            //
            //res.redirect('/po/view');
            res.redirect('/po/view?alert=customer+deleted+successfully');

        } catch (err) {
            await conn.rollback();
            conn.release();
            console.error(err);
            return res.render('po/po-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

};

export default poController