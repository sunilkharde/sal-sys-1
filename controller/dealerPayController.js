import pool from '../db.js';
import xlsx from 'xlsx';
import csv from 'fast-csv';

import PDFDocument from 'pdfkit-table';
import ftp from 'basic-ftp';
import { join } from 'path';
// import fs from 'fs';


const conn = await pool.getConnection();
class dealerPayController {

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
            const [pay_mode_list] = await conn.query("SELECT * FROM pay_modes Where status='A'");
            const [bu_list] = await conn.query("SELECT bu_id, CONCAT(bu_code,' | ',bu_short) as bu_name FROM business_units Where status='A'")
            return [customer_list, pay_mode_list, bu_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static viewBlank = async (req, res) => {
        const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);
        res.render('dealerPay/dealerPay-create', { customer_list, pay_mode_list, bu_list });
    }

    static create = async (req, res) => {
        const { customer_id, bu_id, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark } = req.body;
        const data = req.body
        const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id) {
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
        // const [rows] = await conn.query('SELECT * FROM customers WHERE customer_name=?', [customer_name]);
        // if (rows.length > 0) {
        //     errors.push({ message: 'Customer with this name is already exists' });
        // }
        if (errors.length) {
            res.render('dealerPay/dealerPay-create', { errors, data, customer_list, pay_mode_list, bu_list });
            return;
        }

        try {
            // Get CURRENT_DATE
            const [row] = await conn.query("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as doc_date;")
            const curDate = row[0].doc_date;
            // Genrate max documnet id
            const [rows1] = await conn.query(`SELECT Max(doc_no) AS maxNumber FROM dealer_payment Where doc_date='${curDate}'`);
            var nextDocNo = rows1[0].maxNumber + 1;
            var docNoNew = 'PM' + curDate.replace(/-/g, '') + nextDocNo.toString().padStart(3, '0');

            // Insert new record into database
            await conn.beginTransaction();
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO dealer_payment (doc_date,doc_no,doc_no_new,customer_id,bu_id,pay_mode,amount,ref_date,ref_no,ref_branch,ref_desc,remark,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const paramsDP = [curDate, nextDocNo, docNoNew, customer_id, bu_id, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark, c_by];
            await conn.query(sqlStr, paramsDP);
            await conn.commit();

            res.redirect('/dealerPay/view?alert=Payment+entry+save+successfully');


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
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        try {
            const sqlStr = "Select a.doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,a.ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id";
            const [results] = await conn.query(sqlStr)//, params);

            res.render('dealerPay/dealerPay-view', { dealerPayments: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static edit = async (req, res) => {
        const { doc_date, doc_no } = req.params;
        try {
            const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);
            const sqlStr = "Select a.*,b.customer_name,c.bu_code" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id and a.doc_date=? and a.doc_no=?";
            const params = [doc_date, doc_no];
            const [results] = await conn.query(sqlStr, params);
            //
            res.render('dealerPay/dealerPay-edit', { data: results[0], customer_list, pay_mode_list, bu_list });
        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            conn.release();
        }
    }

    static update = async (req, res) => {
        const { doc_date, doc_no } = req.params;
        const { customer_id, bu_id, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark } = req.body;
        const data = req.body
        const [customer_list, pay_mode_list, bu_list] = await this.getData(req, res.locals.user);

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id) {
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
        // const [rows] = await conn.query('SELECT * FROM dealer_payment WHERE doc_date=? and doc_no<>?', [doc_date, doc_no]);
        // if (rows.length > 0) {
        //     errors.push({ message: 'Customer with this name is already exists' });
        // }
        if (errors.length) {
            res.render('dealerPay/dealerPay-edit', { errors, data, customer_list, pay_mode_list, bu_list });
            return;
        }

        try {
            // Update record into database
            await conn.beginTransaction();
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE dealer_payment Set customer_id=?,bu_id=?,pay_mode=?,amount=?,ref_date=?,ref_no=?,ref_branch=?,ref_desc=?,remark=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE doc_date=? and doc_no=?"
            const params = [customer_id, bu_id, pay_mode, amount, ref_date, ref_no, ref_branch, ref_desc, remark, u_by, doc_date, doc_no];
            await conn.query(sqlStr, params);
            await conn.commit();

            //res.redirect('/dealerPay/view');
            res.redirect('/dealerPay/view?alert=Update+payment+entry+successfully');

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
        const { doc_date, doc_no } = req.params;
        try {
            var errors = [];
            const sqlStr3 = "Select * from dealer_payment Where doc_date=? and doc_no=?"
            const params3 = [doc_date, doc_no];
            const [rows] = await conn.query(sqlStr3, params3);
            if (rows.length > 0) {
                errors.push({ message: "Reference exist, payment entry can't delete" });
            }
            conn.release;
            //            
            if (errors.length) {
                res.redirect(`/dealerPay/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            await conn.beginTransaction();
            const sqlStr = "Delete from dealer_payment Where doc_date=? and doc_no=?"
            const params = [doc_date, doc_no];
            await conn.query(sqlStr, params);
            await conn.commit();
            //
            //res.redirect('/dealerPay/view');
            res.redirect('/dealerPay/view?alert=Payment+entry+deleted+successfully');
        } catch (err) {
            await conn.rollback();
            conn.release();
            console.error(err);
            return res.render('dealerPay/dealerPay-view', { alert: `Internal server error` });
        } finally {
            conn.release();
        }
    };

    static exportExcel = async (req, res) => {
        try {
            const sqlStr = "Select a.doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,a.ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id";
            //const params = [ doc_date, doc_no];
            const [rows] = await conn.query(sqlStr)//, params);

            const header = Object.keys(rows[0]);
            const data = [header, ...rows.map(row => Object.values(row))];
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.aoa_to_sheet(data);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            const excelBuffer = xlsx.write(workbook, { type: 'buffer' });
            res.setHeader('Content-Disposition', 'attachment; filename=DealerPayment.xlsx');
            res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(excelBuffer);
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal server error');
        } finally {
            conn.release
        }
    };

    static exportCSV = async (req, res) => {
        try {
            const sqlStr = "Select DATE_FORMAT(a.doc_date,'%d-%m-%Y') as doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,DATE_FORMAT(a.ref_date,'%d-%m-%Y') as ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id";
            //const params = [ doc_date, doc_no];
            const [rows] = await conn.query(sqlStr)//, params);

            const csvStream = csv.format({ headers: true });
            res.setHeader('Content-disposition', 'attachment; filename=DealerPayment.csv'); // Replace "users.csv" with your desired filename
            res.set('Content-Type', 'text/csv');
            csvStream.pipe(res);
            rows.forEach((row) => csvStream.write(row));
            csvStream.end();
            console.log('Data exported successfully to CSV file!');

        } catch (err) {
            console.error(err);
        } finally {
            conn.release
        }
    };

    static exportPdf = async (req, res) => {
        try {
            const sqlStr = "Select DATE_FORMAT(a.doc_date,'%d-%m-%Y') as doc_date,a.doc_no,a.doc_no_new,a.customer_id,b.customer_name,a.bu_id,c.bu_code,a.pay_mode,a.amount,DATE_FORMAT(a.ref_date,'%d-%m-%Y') as ref_date,a.ref_no,a.ref_desc,a.remark" +
                " from dealer_payment as a, customers as b, business_units as c " +
                " Where a.customer_id=b.customer_id and a.bu_id=c.bu_id";
            //const params = [ doc_date, doc_no];
            const [rows] = await conn.query(sqlStr)//, params);

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
            console.log('Data exported successfully to PDF file!');

        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        } finally {
            conn.release
        }
    };

    static viewBalance = async (req, res) => {
        try {
            const sqlStr = "SELECT a.ext_code FROM customers AS a, users AS b" +
                " WHERE a.user_id = b.user_id and b.user_id=?";
            const params = [res.locals.user.user_id];
            const [rows] = await conn.query(sqlStr, params);
            const filterValues = rows.map(row => row.ext_code);
            //
            const client = new ftp.Client();
            await client.access({
                host: process.env.ftp_host,
                user: process.env.ftp_user,
                password: process.env.ftp_password,
                port: process.env.ftp_port
            });

            const filePath = join(process.cwd(), 'BalData.csv');
            await client.downloadTo(filePath, '/SAP/BALDATA.csv');

            const results = [];
            csv.parseFile(filePath, { headers: true })
                .on('data', (data) => results.push(data))
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

            console.log('Data import successful!');

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal server error');
        }
    }

};

export default dealerPayController