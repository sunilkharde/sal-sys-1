import { executeQuery } from '../db.js';
import moment from 'moment';

// import xlsx from 'xlsx';
import csv from 'fast-csv';
// import PDFDocument from 'pdfkit-table';
// import ftp from 'basic-ftp';

class dsrAcController {

    static viewAll = async (req, res) => {
        // const alert = req.query.alert;
        const { mon_date } = req.query;
        try {
            var fromDate = null;
            var toDate = null;
            if (mon_date === null || mon_date === undefined) {
                fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = moment(mon_date + '-01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }
            const minDate = moment(toDate).subtract(1, 'months');
            const maxDate = moment(toDate);

            const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr0);
            // if (monData.length === 0) {
            //     res.status(404).send("<h1>Month is not open</h1>");
            //     return;
            // }
            const monDiff = moment(monData[0].month_date).diff(fromDate, 'months');
            
            if (monDiff > 1 && fromDate.format('YYYY-MM-DD') !== '2000-01-01') {
                    res.status(404).send("<h1>Posting not available for this month.</h1>");
                    return;
            }

            let sqlStr3 = "SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name,a.post_ac,a.da,a.lodge,a.fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks" +
                " FROM dsr_ac as a, employees as c" +
                " WHERE a.emp_id=c.emp_id and a.year=? and a.month=?" +
                " UNION" +
                " SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name,a.post_ac,Sum(b.total_allow) as da,Sum(b.total_lodge) as lodge,Sum(b.total_exp) as fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks" +
                " FROM dsr_0 as a, dsr_1 as b, employees as c" +
                " WHERE a.year=Year(b.dsr_date) and a.month=Month(b.dsr_date) and a.emp_id=b.emp_id and a.emp_id=c.emp_id" +
                " and a.post_mg='Y' and a.year=? and a.month=?" +
                " and a.emp_id NOT IN (SELECT x.emp_id from dsr_ac as x WHERE x.year=? and x.month=?)" +
                " GROUP BY a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name),a.post_ac,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks"
            const yr = fromDate.format('YYYY')
            const mn = toDate.format('MM')
            const params3 = [yr, mn, yr, mn, yr, mn];
            const postData = await executeQuery(sqlStr3, params3);

            res.render('dsrAc/dsrAc-view', { postData, minDate, maxDate, curMon: mon_date }); //, alert

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static edit = async (req, res) => {
        const { year, month, emp_id } = req.params;
        try {
            const expDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`, 'YYYY-MM-DD').format('MMM-YYYY');
            const yearMon = `${year}-${month.toString().padStart(2, '0')}`;

            //Get employee details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.middle_name,' ',d.first_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [emp_id];
            const empData = await executeQuery(sqlStr2, params2);

            const sqlStr3 = "SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name,a.post_ac,a.da,a.lodge,a.fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks" +
                " FROM dsr_ac as a, employees as c" +
                " WHERE a.emp_id=c.emp_id and a.year=? and a.month=? and a.emp_id=?" +
                " UNION" +
                " SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name,a.post_ac,Sum(b.total_allow) as da,Sum(b.total_lodge) as lodge,Sum(b.total_exp) as fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks" +
                " FROM dsr_0 as a, dsr_1 as b, employees as c" +
                " WHERE a.year=Year(b.dsr_date) and a.month=Month(b.dsr_date) and a.emp_id=b.emp_id and a.emp_id=c.emp_id" +
                " and a.post_mg='Y' and a.year=? and a.month=? and a.emp_id=?" +
                " and a.emp_id NOT IN (SELECT x.emp_id from dsr_ac as x WHERE x.year=? and x.month=? and x.emp_id=?)" +
                " GROUP BY a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name),a.post_ac,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks"
            const params3 = [year, month, emp_id, year, month, emp_id, year, month, emp_id];
            const postData = await executeQuery(sqlStr3, params3);

            res.render('dsrAc/dsrAc-edit', { empData: empData[0], postData: postData[0], expDate, yearMon });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static update = async (req, res) => {
        const { year, month, emp_id } = req.params;
        const { chk_post_ac, da, lodge, fare, stationary_val, postage_val, internet_val, other_val, remarks } = req.body;
        // const data = req.body

        const yearMon = `${year}-${month.toString().padStart(2, '0')}`;

        var errors = [];
        if (da === 0) {
            errors.push({ message: 'Please enter daily allowance!' });
        }
        if (errors.length) {
            const expDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`, 'YYYY-MM-DD').format('MMM-YYYY');
            const yearMon = `${year}-${month.toString().padStart(2, '0')}`;

            //Get employee details
            const sqlStr0 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.middle_name,' ',d.first_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params0 = [emp_id];
            const empData = await executeQuery(sqlStr0, params0);

            const sqlStr1 = "SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name,a.post_ac,a.da,a.lodge,a.fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks" +
                " FROM dsr_ac as a, employees as c" +
                " WHERE a.emp_id=c.emp_id and a.year=? and a.month=? and a.emp_id=?" +
                " UNION" +
                " SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name,a.post_ac,Sum(b.total_allow) as da,Sum(b.total_lodge) as lodge,Sum(b.total_exp) as fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks" +
                " FROM dsr_0 as a, dsr_1 as b, employees as c" +
                " WHERE a.year=Year(b.dsr_date) and a.month=Month(b.dsr_date) and a.emp_id=b.emp_id and a.emp_id=c.emp_id" +
                " and a.post_mg='Y' and a.year=? and a.month=? and a.emp_id=?" +
                " and a.emp_id NOT IN (SELECT x.emp_id from dsr_ac as x WHERE x.year=? and x.month=? and x.emp_id=?)" +
                " GROUP BY a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name),a.post_ac,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks"
            const params1 = [year, month, emp_id, year, month, emp_id, year, month, emp_id];
            const postData = await executeQuery(sqlStr1, params1);

            res.render('dsrAc/dsrAc-edit', { errors, empData: empData[0], postData: postData[0], expDate, yearMon });
            return;
        }

        try {
            // Update records from dsr_0
            const postFlag = chk_post_ac === undefined || chk_post_ac === null ? 'N' : 'Y';
            const sqlStr0 = "Update dsr_0 Set post_ac=? WHERE year=? and month=? and emp_id=?"
            const params0 = [postFlag, year, month, emp_id];
            await executeQuery(sqlStr0, params0);

            // Delete records from dsr_ac
            const sqlStr1 = "Select * FROM dsr_ac WHERE year=? and month=? and emp_id=?"
            const params1 = [year, month, emp_id];
            const acData = await executeQuery(sqlStr1, params1);
            if (acData.length > 0) {
                const sqlStr1 = "Delete FROM dsr_ac WHERE year=? and month=? and emp_id=?"
                const params1 = [year, month, emp_id];
                await executeQuery(sqlStr1, params1);
            }

            if (chk_post_ac === undefined || chk_post_ac === null) {
                res.redirect(`/dsrAc/view?mon_date=${yearMon}&alert=Records+unposted`)
            } else {
                // Insert record in dsr_ac as posted
                var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
                const sqlStr5 = "INSERT INTO dsr_ac (year,month,emp_id,post_ac,da,lodge,fare,stationary_val,postage_val,internet_val,other_val,remarks,u_at,u_by)" +
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
                const paramsAc = [year, month, emp_id, 'Y', da, lodge, fare, stationary_val, postage_val, internet_val, other_val, remarks, u_by];
                await executeQuery(sqlStr5, paramsAc);

                res.redirect(`/dsrAc/view?mon_date=${yearMon}&alert=Records+posted+successfully`)
            }

        } catch (err) {
            console.error(err);
            return res.render('dsrAc/dsrAc-view', { alert: `Internal server error` });
        }

    };

    static postExportCSV = async (req, res) => {
        const { exportCSV_type, exportCSV_curMon } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (exportCSV_curMon === null || exportCSV_curMon === undefined) {
                fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = moment(exportCSV_curMon + '-01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            var sqlStr = ""
            if (exportCSV_type === 'All') {
                sqlStr = "SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name," +
                    " d.desg_name,e.hq_name,CONCAT(f.last_name,' ',f.first_name,' ',f.middle_name) as boss_name,a.post_ac,a.da,a.lodge,a.fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,0 as total_amount,a.remarks,DATE_FORMAT(a.u_at,'%d/%m/%Y %H:%i:%s') as post_date" +
                    " FROM dsr_ac as a, employees as c, designations as d, hqs as e, employees as f" +
                    " WHERE a.emp_id=c.emp_id and a.year=? and a.month=?" +
                    " and c.desg_id=d.desg_id and c.hq_id=e.hq_id and c.boss_id=f.emp_id" +
                    " UNION" +
                    " SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name," +
                    " d.desg_name,e.hq_name,CONCAT(f.last_name,' ',f.first_name,' ',f.middle_name) as boss_name,a.post_ac,Sum(b.total_allow) as da,Sum(b.total_lodge) as lodge,Sum(b.total_exp) as fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,0 as total_amount,a.remarks,'' as post_date" +
                    " FROM dsr_0 as a, dsr_1 as b, employees as c, designations as d, hqs as e, employees as f" +
                    " WHERE a.year=Year(b.dsr_date) and a.month=Month(b.dsr_date) and a.emp_id=b.emp_id and a.emp_id=c.emp_id" +
                    " and a.post_mg='Y' and a.year=? and a.month=?" +
                    " and c.desg_id=d.desg_id and c.hq_id=e.hq_id and c.boss_id=f.emp_id" +
                    " and a.emp_id NOT IN (SELECT x.emp_id from dsr_ac as x WHERE x.year=? and x.month=?)" +
                    " GROUP BY a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name),a.post_ac,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks"
            } else if (exportCSV_type === 'Posted') {
                sqlStr = "SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name," +
                    " d.desg_name,e.hq_name,CONCAT(f.last_name,' ',f.first_name,' ',f.middle_name) as boss_name,a.post_ac,a.da,a.lodge,a.fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,0 as total_amount,a.remarks,DATE_FORMAT(a.u_at,'%d/%m/%Y %H:%i:%s') as post_date" +
                    " FROM dsr_ac as a, employees as c, designations as d, hqs as e, employees as f" +
                    " WHERE a.emp_id=c.emp_id and a.year=? and a.month=?" +
                    " and c.desg_id=d.desg_id and c.hq_id=e.hq_id and c.boss_id=f.emp_id"
            } else if (exportCSV_type === 'Not-Posted') {
                sqlStr = "SELECT a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name) as emp_name," +
                    " d.desg_name,e.hq_name,CONCAT(f.last_name,' ',f.first_name,' ',f.middle_name) as boss_name,a.post_ac,Sum(b.total_allow) as da,Sum(b.total_lodge) as lodge,Sum(b.total_exp) as fare,a.stationary_val,a.postage_val,a.internet_val,a.other_val,0 as total_amount,a.remarks,'' as post_date" +
                    " FROM dsr_0 as a, dsr_1 as b, employees as c, designations as d, hqs as e, employees as f" +
                    " WHERE a.year=Year(b.dsr_date) and a.month=Month(b.dsr_date) and a.emp_id=b.emp_id and a.emp_id=c.emp_id" +
                    " and a.post_mg='Y' and a.year=? and a.month=?" +
                    " and c.desg_id=d.desg_id and c.hq_id=e.hq_id and c.boss_id=f.emp_id" +
                    " and a.emp_id NOT IN (SELECT x.emp_id from dsr_ac as x WHERE x.year=? and x.month=?)" +
                    " GROUP BY a.year,a.month,a.emp_id,CONCAT(c.last_name,' ',c.first_name,' ',c.middle_name),a.post_ac,a.stationary_val,a.postage_val,a.internet_val,a.other_val,a.remarks"
            }
            // console.log('sqlstr ' + sqlStr)            
            const yr = fromDate.format('YYYY')
            const mn = fromDate.format('MM')
            const params = [yr, mn, yr, mn, yr, mn];
            const postData = await executeQuery(sqlStr, params);

            /***********************************************/
            const csvStream = csv.format({ headers: true });
            const fileName = 'Exp' + exportCSV_type + '_' + fromDate.format('MM-YYYY') + '.csv'
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName); // Replace "users.csv" with your desired filename
            res.set('Content-Type', 'text/csv');
            csvStream.pipe(res);
            // postData.forEach((row) => csvStream.write(row));
            postData.forEach((row) => {
                // Calculate the total for each expense field
                const totalDA = parseFloat(row.da);
                const totalLodge = parseFloat(row.lodge);
                const totalFare = parseFloat(row.fare);
                const totalStationary = parseFloat(row.stationary_val);
                const totalPostage = parseFloat(row.postage_val);
                const totalInternet = parseFloat(row.internet_val);
                const totalOther = parseFloat(row.other_val);
            
                // Add the total field to the row
                row.total_amount = totalDA + totalLodge + totalFare + totalStationary + totalPostage + totalInternet + totalOther;
            
                csvStream.write(row);
            });
            csvStream.end();

            const now = new Date().toLocaleString();
            console.log(`Employee expenses posting data exported as ${fileName} file!... user: '${res.locals.user.username} on '${now}'`);
            // console.log('Data exported successfully to CSV file!');

        } catch (err) {
            console.error(err);
        } finally {
            //conn.release
        }
    };

};

export default dsrAcController