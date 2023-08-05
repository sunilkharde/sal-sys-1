import { executeQuery } from '../db.js';
import xlsx from 'xlsx';
import csv from 'fast-csv';

import PDFDocument from 'pdfkit-table';
import ftp from 'basic-ftp';
import { join } from 'path';
import moment from 'moment';

//const conn = await pool.getConnection();
class dealerPayController {

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

            // const conn1 = await pool.getConnection();
            const pay_mode_list = await executeQuery("SELECT * FROM pay_modes Where status='A'");
            //conn1.release

            // const conn2 = await pool.getConnection();
            const bu_list = await executeQuery("SELECT bu_id, CONCAT(bu_code,' | ',bu_name) as bu_name FROM business_units Where status='A'")
            //conn2.release

            return [customer_list, pay_mode_list, bu_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static viewBlank = async (req, res) => {
        const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);

        try {
            //const conn = await pool.getConnection();
            const row = await executeQuery("SELECT CURRENT_DATE() as doc_date;")
            //conn.release
            const data = { doc_date: row[0].doc_date, doc_no: '*****' };
            res.render('dealerPay/dealerPay-create', { customer_list, pay_mode_list, bu_list, data });
        } catch (err) {
            //conn.release();
            console.error(err);
            return res.render('dealerPay/dealerPay-create', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    }

    static create = async (req, res) => {
        const { customer_id, bu_id_hdn, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark } = req.body;
        const data = req.body
        const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id_hdn) {
            errors.push({ message: "Select business unit" });
        }
        if (!pay_mode) {
            errors.push({ message: "Select payment mode" });
        }
        if (isNaN(amount) || amount <= 0) {
            errors.push({ message: 'Amount must be a number' });
        }
        if (!ref_date) {
            errors.push({ message: 'Select transaction reference date' });
        }
        if (!ref_no) {
            errors.push({ message: 'Enter transaction reference number' });
        }
        // const [rows] = await executeQuery('SELECT * FROM customers WHERE customer_name=?', [customer_name]);
        // if (rows.length > 0) {
        //     errors.push({ message: 'Customer with this name is already exists' });
        // }
        if (errors.length) {
            res.render('dealerPay/dealerPay-create', { errors, data, customer_list, pay_mode_list, bu_list });
            return;
        }

        try {
            // Get CURRENT_DATE
            //const conn = await pool.getConnection();
            const row = await executeQuery("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as doc_date;")
            //conn.release
            const curDate = row[0].doc_date;
            // Genrate max documnet id
            // const conn1 = await pool.getConnection();
            const rows1 = await executeQuery(`SELECT Max(doc_no) AS maxNumber FROM dealer_payment Where doc_date='${curDate}'`);
            //conn1.release
            var nextDocNo = rows1[0].maxNumber + 1;
            var docNoNew = 'PM' + curDate.replace(/-/g, '') + nextDocNo.toString().padStart(3, '0');

            // Insert new record into database
            // const conn2 = await pool.getConnection();
            // await conn2.beginTransaction();
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO dealer_payment (doc_date,doc_no,doc_no_new,customer_id,bu_id,pay_mode,amount,ref_date,ref_no,ref_branch,ref_desc,remark,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const paramsDP = [curDate, nextDocNo, docNoNew, customer_id, bu_id_hdn, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark, c_by];
            await executeQuery(sqlStr, paramsDP);
            // await conn2.commit();
            //conn2.release

            res.redirect('/dealerPay/view?alert=Payment+entry+save+successfully');


        } catch (err) {
            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static viewAll = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        const { from_date, to_date } = req.query;
        try {
            var fromDate = null;
            var toDate = null;
            if (from_date === null || from_date === undefined) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = from_date
                toDate = to_date
            }

            const data = { from_date: fromDate, to_date: toDate }

            let sqlStr = "Select a.doc_date,a.doc_no,RIGHT(a.doc_no_new,3) AS doc_no_new,a.customer_id,b.customer_name,a.bu_id,CONCAT(c.bu_code,' | ',c.bu_short) as bu_code,a.pay_mode,a.amount,a.ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.ref_date Between ? and ?";
            // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            if (!["Admin", "Support", "Audit", "Account", "Bank"].includes(res.locals.user.user_role)) {
                sqlStr = sqlStr + ` and a.c_by=${res.locals.user.user_id}`;
            }
            var params = null;
            if (from_date === null || from_date === undefined) {
                params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')]
            } else {
                params = [fromDate, toDate]
            }
            const results = await executeQuery(sqlStr, params);

            res.render('dealerPay/dealerPay-view', { dealerPayments: results, data, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static edit = async (req, res) => {
        const { doc_date, doc_no } = req.params;
        try {
            const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);
            //const conn = await pool.getConnection();
            const sqlStr = "Select a.*,b.customer_name,c.bu_code, CONCAT(bu_code,' | ',bu_name) as bu_name" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.doc_date=? and a.doc_no=?";
            const params = [doc_date, doc_no];
            const results = await executeQuery(sqlStr, params);
            //conn.release
            //
            res.render('dealerPay/dealerPay-edit', { data: results[0], customer_list, pay_mode_list, bu_list });
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static update = async (req, res) => {
        const { doc_date, doc_no } = req.params;
        const { customer_id, bu_id_hdn, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark } = req.body;
        const data = req.body
        const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id_hdn) {
            errors.push({ message: "Select business unit" });
        }
        if (!pay_mode) {
            errors.push({ message: "Select payment mode" });
        }
        if (isNaN(amount) || amount <= 0) {
            errors.push({ message: 'Amount must be a number' });
        }
        if (!ref_date) {
            errors.push({ message: 'Select transaction date' });
        }
        if (!ref_no) {
            errors.push({ message: 'Enter transaction number' });
        }
        // const [rows] = await executeQuery('SELECT * FROM dealer_payment WHERE doc_date=? and doc_no<>?', [doc_date, doc_no]);
        // if (rows.length > 0) {
        //     errors.push({ message: 'Customer with this name is already exists' });
        // }
        if (errors.length) {
            res.render('dealerPay/dealerPay-edit', { errors, data, customer_list, pay_mode_list, bu_list });
            return;
        }

        try {
            // Update record into database
            //const conn = await pool.getConnection();
            // await conn.beginTransaction();
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE dealer_payment Set customer_id=?,bu_id=?,pay_mode=?,amount=?,ref_date=?,ref_no=?,ref_branch=?,ref_desc=?,remark=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE doc_date=? and doc_no=?"
            const params = [customer_id, bu_id_hdn, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark, u_by, doc_date, doc_no];
            await executeQuery(sqlStr, params);
            // await conn.commit();
            //conn.release

            //res.redirect('/dealerPay/view');
            res.redirect('/dealerPay/view?alert=Update+payment+entry+successfully');

        } catch (err) {
            // await conn.rollback();
            //conn.release();
            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static delete = async (req, res) => {
        const { doc_date, doc_no } = req.params;
        try {
            var errors = [];
            //const conn = await pool.getConnection();
            const sqlStr3 = "Select * from dealer_payment Where doc_date=? and doc_no=?"
            const params3 = [doc_date, doc_no];
            const rows = await executeQuery(sqlStr3, params3);
            //conn.release
            if (rows.length > 0) {
                errors.push({ message: "Reference exist, payment entry can't delete" });
            }
            //            
            if (errors.length) {
                res.redirect(`/dealerPay/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            // const conn1 = await pool.getConnection();
            // await conn1.beginTransaction();
            const sqlStr = "Delete from dealer_payment Where doc_date=? and doc_no=?"
            const params = [doc_date, doc_no];
            await executeQuery(sqlStr, params);
            // await conn1.commit();
            //conn1.release
            //
            //res.redirect('/dealerPay/view');
            res.redirect('/dealerPay/view?alert=Payment+entry+deleted+successfully');
        } catch (err) {
            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static exportExcel = async (req, res) => {
        const { exportExcel_from_date, exportExcel_to_date } = req.query;
        try {
            var fromDate = null;
            var toDate = null;
            if (exportExcel_from_date === null || exportExcel_from_date === undefined) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = exportExcel_from_date
                toDate = exportExcel_to_date
            }

            let sqlStr = "Select a.doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,a.ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.ref_date Between ? and ?";
            // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            if (!["Admin", "Support", "Audit", "Account", "Bank"].includes(res.locals.user.user_role)) {
                sqlStr = sqlStr + ` and a.c_by=${res.locals.user.user_id}`;
            }
            var params = null;
            if (exportExcel_from_date === null || exportExcel_from_date === undefined) {
                params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')]
            } else {
                params = [fromDate, toDate]
            }
            const rows = await executeQuery(sqlStr, params);

            const header = Object.keys(rows[0]);
            const data = [header, ...rows.map(row => Object.values(row))];
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.aoa_to_sheet(data);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            const excelBuffer = xlsx.write(workbook, { type: 'buffer' });
            res.setHeader('Content-Disposition', 'attachment; filename=DealerPayment.xlsx');
            res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(excelBuffer);

            const now = new Date().toLocaleString();
            console.log(`Dealer payment data exported successfully to Excel file!... user: '${res.locals.user.username} on '${now}'`);

        } catch (error) {
            console.error(error);
            res.status(500).send('Internal server error');
        } finally {
            //conn.release
        }
    };

    static exportCSV = async (req, res) => {
        const { exportCSV_from_date, exportCSV_to_date } = req.query;
        try {
            // console.log('exportCSV from date..... ' + exportCSV_from_date + ' ' + exportCSV_to_date)

            var fromDate = null;
            var toDate = null;
            if (exportCSV_from_date === null || exportCSV_from_date === undefined) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = exportCSV_from_date
                toDate = exportCSV_to_date
            }

            let sqlStr = "Select DATE_FORMAT(a.doc_date,'%d/%m/%Y') as doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,DATE_FORMAT(a.ref_date,'%d/%m/%Y') as ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.ref_date Between ? and ?";
            // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            if (!["Admin", "Support", "Audit", "Account", "Bank"].includes(res.locals.user.user_role)) {
                sqlStr = sqlStr + ` and a.c_by=${res.locals.user.user_id}`;
            }
            var params = null;
            if (exportCSV_from_date === null || exportCSV_from_date === undefined) {
                params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')]
            } else {
                params = [fromDate, toDate]
            }
            const rows = await executeQuery(sqlStr, params);

            const csvStream = csv.format({ headers: true });
            res.setHeader('Content-disposition', 'attachment; filename=DealerPayment.csv'); // Replace "users.csv" with your desired filename
            res.set('Content-Type', 'text/csv');
            csvStream.pipe(res);
            rows.forEach((row) => csvStream.write(row));
            csvStream.end();

            const now = new Date().toLocaleString();
            console.log(`Dealer payment data exported successfully to CSV file!... user: '${res.locals.user.username} on '${now}'`);
            // console.log('Data exported successfully to CSV file!');

        } catch (err) {
            console.error(err);
        } finally {
            //conn.release
        }
    };

    static exportPdf = async (req, res) => {
        const { exportPDF_from_date, exportPDF_to_date } = req.query;
        try {
            var fromDate = null;
            var toDate = null;
            if (exportPDF_from_date === null || exportPDF_from_date === undefined) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = exportPDF_from_date
                toDate = exportPDF_to_date
            }

            let sqlStr = "Select DATE_FORMAT(a.doc_date,'%d/%m/%Y') as doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,DATE_FORMAT(a.ref_date,'%d/%m/%Y') as ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.ref_date Between ? and ?";
            // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            if (!["Admin", "Support", "Audit", "Account", "Bank"].includes(res.locals.user.user_role)) {
                sqlStr = sqlStr + ` and a.c_by=${res.locals.user.user_id}`;
            }
            var params = null;
            if (exportPDF_from_date === null || exportPDF_from_date === undefined) {
                params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')]
            } else {
                params = [fromDate, toDate]
            }
            const rows = await executeQuery(sqlStr, params);

            let doc = new PDFDocument({ margin: 20, size: 'A4' });

            doc.info.Title = 'Dealer Payment';
            // Align the title and subtitle
            // doc.fontSize(14).text('Dealer Payment', { align: 'center' });
            // doc.fontSize(10).text('Dealer Payment Report', { align: 'center' });

            doc.table({
                title: { label: "Dealer Payment" },
                subtitle: { label: "Dealer Payment Report" },
                headers: [
                    { label: "Date", width: 50, align: 'left' },
                    { label: "Doc No", width: 70, align: 'left' },
                    { label: "Customer", width: 110, align: 'left' },
                    { label: "Business Unit", width: 50, align: 'left' },
                    { label: "Pay Mode", width: 40, align: 'left' },
                    { label: "Amount", width: 60, align: 'center' },
                    { label: "Ref Date", width: 50, align: 'left' },
                    { label: "Ref No", width: 50, align: 'left' },
                    { label: "Narration", width: 70, align: 'left' }
                ],
                rows: rows.map(row => [row.doc_date, row.doc_no_new, row.customer_name, row.bu_code, row.pay_mode, row.amount, row.ref_date, row.ref_no, row.ref_desc]),
                // header: headerOpts,
                repeatingHeader: true // enable repeating headers
            });

            // Set the response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=DealerPayment.pdf');
            // Pipe the PDF document to the response
            doc.pipe(res);
            // End the PDF document
            doc.end();

            const now = new Date().toLocaleString();
            console.log(`Dealer payment data exported successfully to PDF file!... user: '${res.locals.user.username} on '${now}'`);
            // console.log('Data exported successfully to PDF file!');

        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        } finally {
            //conn.release
        }
    };

    static viewBalance = async (req, res) => {
        try {
            //const conn = await pool.getConnection();
            const sqlStr = "SELECT CONCAT('000',a.ext_code) as ext_code FROM customers AS a, users AS b" +
                " WHERE a.user_id = b.user_id and b.user_id=?";
            const params = [res.locals.user.user_id];
            const rows = await executeQuery(sqlStr, params);
            //conn.release
            const filterValues = rows.map(row => row.ext_code);
            //
            const client = new ftp.Client();
            await client.access({
                host: process.env.ftp_host_temp,
                user: process.env.ftp_user_temp,
                password: process.env.ftp_password_temp,
                port: process.env.ftp_port
            });

            const filePath = join(process.cwd(), 'BalData.csv');
            await client.downloadTo(filePath, '/SAP/BALDATA.csv');

            const results = [];
            csv.parseFile(filePath, { headers: true })
                .on('data', (data) => results.push(data))
                .on('error', (error) => {
                    console.error('Error occurred while parsing CSV file:', error);
                    // Handle the error gracefully, e.g., by sending an error response or redirecting.
                    res.status(500).send('Error occurred while processing CSV file.');
                })
                .on('end', () => {
                    //const filterValues = ['A', 'B', 'C'];
                    const filteredResults = results.filter(record => filterValues.includes(record.CUSTOMER_CODE));
                    //const filteredResults = results.filter(record => parseInt(record.balance) > 100);
                    if (res.locals.user.user_role !== "Admin") {
                        res.render('dealerPay/dealerPay-view-bal', { dealerBalance: filteredResults });
                    } else {
                        res.render('dealerPay/dealerPay-view-bal', { dealerBalance: results });
                    }
                    client.close();
                });

            const now = new Date().toLocaleString();
            console.log(`Data imported successful by user '${res.locals.user.username} on '${now}'`);
            // console.log('Data import successful!');

        } catch (err) {
            console.error(err);
            // res.status(500).send('Internal server error');
            res.redirect('/');
        }
    }

};

export default dealerPayController