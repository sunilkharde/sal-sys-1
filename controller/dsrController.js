import { executeQuery } from '../db.js';
import moment from 'moment';
import { join } from 'path';
import fs from 'fs';

// import xlsx from 'xlsx';
import csv from 'fast-csv';
import PDFDocument from 'pdfkit-table';
// import ftp from 'basic-ftp';

const titleCase = (str) => {
    return str
        .toLowerCase()
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .trim() // Trim leading and trailing spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

class dsrController {

    static getData = async (req, user) => {
        try {
            // var user_role = user.user_role !== null && user.user_role !== undefined ? user.user_role : 'User';
            var ppSql = "";
            const sqlStr1 = `SELECT emp_id, desg_id FROM employees Where user_id=${user.user_id}`
            const row = await executeQuery(sqlStr1);
            if (row.length > 0 && ![1, 2, 3, 4, 5].includes(row[0].desg_id)) {
                ppSql = " and atten_flag <> 'PP'";
            }

            const sqlStr = "SELECT atten_flag,atten_desc,hr_flag FROM atten_flags Where status='A' " + ppSql
            const atten_flag_list = await executeQuery(sqlStr);

            // const sqlStr2 = "SELECT allow_id,allow_name FROM allowances Where a.status='A'"
            // const allow_list = await executeQuery(sqlStr2);

            return [atten_flag_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static getDailyAllow = async (req, res) => {
        try {
            const { desg_id, atten_flag } = req.query;

            const sqlStr = "SELECT allow_id, desg_id, atten_flag, amount FROM allow_pricelist" +
                " WHERE allow_id='1' and desg_id=? and atten_flag=?";
            const daRate = await executeQuery(sqlStr, [desg_id, atten_flag]);

            const sqlStr1 = "SELECT allow_id, desg_id, atten_flag, amount FROM allow_pricelist" +
                " WHERE allow_id='7' and desg_id=? and atten_flag=?";
            const lodgeRate = await executeQuery(sqlStr1, [desg_id, atten_flag]);

            // let allowRate = { allowDA: daRate[0].amount, stationaryRate: 0, postageRate: 0, internetRate: 0, otherRate: 0 };
            let allowDA = {
                daRate: daRate.length > 0 ? daRate[0].amount : 0,
                lodgeRate: lodgeRate.length > 0 ? lodgeRate[0].amount : 0
            };

            res.json({ allowDA });
            // res.json({ allowDA: allowPricelist[0] });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static getAllowData = async (req, res) => {
        try {
            const { allow_id, desg_id, atten_flag } = req.query;

            const sqlStr = "SELECT allow_id, desg_id, atten_flag, amount, type, If(km_rate Is Null,0,km_rate) as km_rate" +
                " FROM allow_pricelist" +
                " WHERE allow_id=? and desg_id=?" +
                " and atten_flag In ('XX',?)";
            const allowPricelist = await executeQuery(sqlStr, [allow_id, desg_id, atten_flag]);

            res.json({ allowData: allowPricelist[0] });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static viewBlank = async (req, res) => {
        const [customer_list, bu_list] = await this.getData(req, res.locals.user);

        try {
            const row = await executeQuery("SELECT CURRENT_DATE() as dsr_date;")
            const poDate = row[0].dsr_date
            const minDate = moment(poDate);
            const maxDate = moment(poDate).add(15, 'days');
            const data = { dsr_date: poDate, emp_id: '*****', exp_date: minDate, minDate, maxDate };
            res.render('dsr/dsr-create', { customer_list, bu_list, data });
        } catch (err) {
            //conn.release();
            console.error(err);
            return res.render('dsr/dsr-create', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    }

    static create = async (req, res) => {
        //const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, 'sr_no[]': sr_no, 'bu_ids[]': bu_ids, 'bu_names[]': bu_names, 'allow_id[]': allow_id, 'product_name[]': product_name, 'qty[]': qty, 'rate[]': rate, 'amount[]': amount } = req.body;
        const { customer_id, customer_name, exp_date, bu_id_hdn, bu_name, posted, ftp_date, status, sr_no, bu_ids, bu_names, allow_id, product_name, qty, rate, amount } = req.body;
        const data = req.body  //dsr_date, emp_id, po_no_new, 
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
        const row = await executeQuery("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as dsr_date;")
        //conn.release
        var sysDate = row[0].dsr_date;
        if (exp_date < sysDate) {
            errors.push({ message: 'Expected date should greater than today' });
        }
        //
        if (errors.length) {
            res.render('dsr/dsr-create', { errors, data, customer_list, bu_list });
            return;
        }

        try {
            // Get CURRENT_DATE
            //const conn1 = await pool.getConnection();
            const row = await executeQuery("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') as dsr_date;")
            // conn1.release
            const curDate = row[0].dsr_date;
            // Genrate max Customer id
            // const conn2 = await pool.getConnection();
            const rows1 = await executeQuery(`SELECT Max(emp_id) AS maxNumber FROM po_hd Where dsr_date='${curDate}'`);
            // conn2.release
            var nextPoNo = rows1[0].maxNumber + 1;
            var poNoNew = 'NJ' + curDate.replace(/-/g, '') + nextPoNo.toString().padStart(3, '0');

            // Insert new record into database
            // const conn3 = await pool.getConnection();
            // await conn3.beginTransaction();
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO po_hd (dsr_date,emp_id,po_no_new,customer_id,exp_date,bu_id,posted,ftp_date,status,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const params = [curDate, nextPoNo, poNoNew, customer_id, exp_date, bu_id_hdn, 'Y', ftp_date, status_new, c_by];
            await executeQuery(sqlStr, params);
            // await conn3.commit();
            // conn3.release

            const allow_id_val = Array.isArray(allow_id) ? allow_id : [allow_id];
            const qty_val = Array.isArray(qty) ? qty : [qty];
            const rate_val = Array.isArray(rate) ? rate : [rate];
            const amount_val = Array.isArray(amount) ? amount : [amount];
            for (let i = 0; i < allow_id_val.length; i++) {
                let sr_no_val = (i + 1) * 10;
                const sqlStr2 = "INSERT INTO po_dt (dsr_date, emp_id, sr_no, bu_id, allow_id, qty, rate, amount)" +
                    " VALUES (?,?,?,?,?,?,?,?)"
                const paramsDt = [curDate, nextPoNo, sr_no_val, bu_id_hdn, allow_id_val[i], qty_val[i], rate_val[i], amount_val[i]];
                await executeQuery(sqlStr2, paramsDt); //const [result2] =
            }

            // await conn4.commit();
            // conn4.release

            //return res.render('dsr/dsr-view', { alert: `Save Customer successfully` });
            res.redirect('/dsr/view');
            //res.redirect('/');

        } catch (err) {
            console.error(err);
            return res.render('dsr/dsr-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static viewPM = async (req, res) => {
        try {
            const sqlStr = "Select a.emp_id,a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day" +
                " FROM employees as a, designations as b, hqs as c" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const results = await executeQuery(sqlStr, params);
            if (results.length === 0) {
                res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                return;
            }

            const sqlStr2 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const results2 = await executeQuery(sqlStr2);
            if (results2.length === 0) {
                res.status(404).send("<h1>Month is not open.</h1>");
                return;
            }

            const sqlStr3 = "Select * From dsr_1 Where emp_id=? and dsr_date=?"
            const params3 = [results[0].emp_id, results2[0].month_date];
            const results3 = await executeQuery(sqlStr3, params3);
            if (results3.length === 0) {
                const from_date = moment(results2[0].month_date);
                const to_date = from_date.clone().endOf('month');

                const numDays = to_date.diff(from_date, 'days');
                var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

                for (let i = 0; i <= numDays; i++) {
                    const sqlStr = "INSERT INTO dsr_1 (emp_id,dsr_date,c_at,c_by)" +
                        " VALUES (?,?,CURRENT_TIMESTAMP( ),?)"
                    const paramsDt = [results[0].emp_id, from_date.format('YYYY-MM-DD'), c_by];
                    await executeQuery(sqlStr, paramsDt);
                    // console.log('Insert Query : ' + paramsDt)
                    from_date.add(1, 'day');
                }
            }

            const monthDate = results2[0].month_date;
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth() + 1;
            const sqlStr4 = "Select * From dsr_0 Where emp_id=? and year=? and month=?"
            const params4 = [results[0].emp_id, year, month];
            const results4 = await executeQuery(sqlStr4, params4);
            if (results4.length === 0) {
                //Get monthly allowance pricelist 
                let monAllow = { monPost: 'N', stationaryRate: 0, postageRate: 0, internetRate: 0, otherRate: 0 };
                if (results.length > 0) {

                    const sqlStr8 = "SELECT * FROM allow_pricelist WHERE allow_id = 8 AND desg_id = ?";
                    const params8 = [results[0].desg_id];
                    const row8 = await executeQuery(sqlStr8, params8);

                    const sqlStr9 = "SELECT * FROM allow_pricelist WHERE allow_id = 9 AND desg_id = ?";
                    const params9 = [results[0].desg_id];
                    const row9 = await executeQuery(sqlStr9, params9);

                    const sqlStr10 = "SELECT * FROM allow_pricelist WHERE allow_id = 10 AND desg_id = ?";
                    const params10 = [results[0].desg_id];
                    const row10 = await executeQuery(sqlStr10, params10);

                    monAllow = {
                        monPost: 'N',
                        stationaryRate: row8.length > 0 ? row8[0].amount : 0,
                        postageRate: row9.length > 0 ? row9[0].amount : 0,
                        internetRate: row10.length > 0 ? row10[0].amount : 0,
                        otherRate: 0,
                        monRemarks: ''
                    };

                    var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
                    const sqlStr4 = "INSERT INTO dsr_0 (year,month,emp_id,post_mg,post_ac,stationary_val,postage_val,internet_val,other_val,remarks,c_at,c_by)" +
                        " VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
                    const params4 = [results2[0].year, results2[0].month, results[0].emp_id, monAllow.monPost, 'N', monAllow.stationaryRate, monAllow.postageRate, monAllow.internetRate, monAllow.otherRate, monAllow.monRemarks, c_by];
                    await executeQuery(sqlStr4, params4);

                }
            }

            //******Notification******
            const sqlStr5 = "SELECT a.emp_id, a.dsr_date, a.total_exp, Sum(b.amount) as amount" +
                " FROM dsr_1 as a LEFT JOIN dsr_2 as b ON (a.dsr_date=b.dsr_date and a.emp_id=b.emp_id)" +
                " WHERE YEAR(a.dsr_date)=? and MONTH(a.dsr_date)=? and a.emp_id=?" +
                " GROUP By a.emp_id, a.dsr_date, a.total_exp" +
                " HAVING a.total_exp > 0 and (a.total_exp <> Sum(b.amount) or Sum(b.amount) Is Null)"
            const params5 = [year, month, results[0].emp_id];
            const dataNote = await executeQuery(sqlStr5, params5);
            let showNote = 'N';
            if (dataNote.length > 0) {
                showNote = 'Y'
            }
            //******Notification End******

            //Get route location names
            const sqlStr6 = "Select DISTINCT loc_name" +  //emp_id, loc_date, loc_lat, loc_lng,
                " From dsr_loc Where emp_id=? and loc_date >= CURRENT_DATE()" +
                " Order By loc_date";
            const params6 = [results[0].emp_id];
            const routeData = await executeQuery(sqlStr6, params6);
            let locNames = "";
            if (routeData.length > 0) {
                locNames = "Route: " + routeData.map(row => row.loc_name).join(' > ');
            }
            //
            const sqlStr7 = "Select DATE_FORMAT(Max(loc_date), '%Y-%m-%d %H:%i:%s') as loc_date" +  //emp_id, loc_date, loc_lat, loc_lng,
                " From dsr_loc Where emp_id=? and loc_date >= CURRENT_DATE()" +
                " Order By loc_date";
            const params7 = [results[0].emp_id];
            const locData = await executeQuery(sqlStr7, params7);
            const toDate = locData[0].loc_date ? moment(locData[0].loc_date).format('YYYY-MM-DD HH:mm:ss') : moment('2000-01-01 12:00:00').format('YYYY-MM-DD HH:mm:ss');
            //
            res.render('dsr/dsr-view-pm', { layout: 'mobile', data: results[0], data2: results2[0], dataNote, showNote: showNote, googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locNames, toDate });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static viewAll = async (req, res) => {
        const alert = req.query.alert;
        try {
            const sqlStr3 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const results3 = await executeQuery(sqlStr3);
            if (results3.length === 0) {
                res.status(404).send("<h1>Month is not open.</h1>");
                return;
            }

            const openMon = { year: results3[0].year, month: results3[0].month }
            const from_date = moment(results3[0].month_date);
            const to_date = moment();
            let daysDiff = 28 - to_date.diff(from_date, 'days');
            if (daysDiff <= 0) {
                daysDiff = 0;
            }

            //Get employee details
            const sqlStr = "Select a.emp_id,a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day" +
                " FROM employees as a, designations as b, hqs as c" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const results = await executeQuery(sqlStr, params);
            if (results.length === 0) {
                res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                return;
            }

            //Get monthly allowance pricelist and post flag
            let monAllow = { monPost: null, stationaryRate: 0, postageRate: 0, internetRate: 0, otherRate: 0 };
            if (results.length > 0) {
                const sqlStr1 = "Select * FROM dsr_0 as a Where year=? and month=? and emp_id=?"
                const params1 = [openMon.year, openMon.month, results[0].emp_id];
                const monAllowPost = await executeQuery(sqlStr1, params1);

                const sqlStr8 = "SELECT * FROM allow_pricelist WHERE allow_id = 8 AND desg_id = ?";
                const params8 = [results[0].desg_id];
                const row8 = await executeQuery(sqlStr8, params8);

                const sqlStr9 = "SELECT * FROM allow_pricelist WHERE allow_id = 9 AND desg_id = ?";
                const params9 = [results[0].desg_id];
                const row9 = await executeQuery(sqlStr9, params9);

                const sqlStr10 = "SELECT * FROM allow_pricelist WHERE allow_id = 10 AND desg_id = ?";
                const params10 = [results[0].desg_id];
                const row10 = await executeQuery(sqlStr10, params10);

                monAllow = { //Value pick from pricelist
                    monPost: monAllowPost.length > 0 ? monAllowPost[0].post_mg : 'N',
                    stationaryRate: row8.length > 0 ? row8[0].amount : 0,
                    postageRate: row9.length > 0 ? row9[0].amount : 0,
                    internetRate: row10.length > 0 ? row10[0].amount : 0,
                    monRemarks: monAllowPost.length > 0 ? monAllowPost[0].remarks : ''
                };

                if (monAllowPost.length > 0) {
                    // if (monAllowPost[0].stationary_val > 0 || monAllowPost[0].postage_val > 0 || monAllowPost[0].internet_val > 0 || monAllowPost[0].other_val > 0 ) {
                    monAllow = {  //Value pick from saved in dsr_0
                        monPost: monAllowPost.length > 0 ? monAllowPost[0].post_mg : 'N',
                        stationaryRate: monAllowPost[0].stationary_val,
                        postageRate: monAllowPost[0].postage_val,
                        internetRate: monAllowPost[0].internet_val,
                        otherRate: monAllowPost[0].other_val,
                        monRemarks: monAllowPost.length > 0 ? monAllowPost[0].remarks : ''
                    };
                    // }
                }
            }

            const sqlStr2 = "Select * From dsr_1 Where dsr_date Between ? and ? and emp_id=?"
            const params2 = [from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD'), results[0].emp_id];
            const results2 = await executeQuery(sqlStr2, params2);

            res.render('dsr/dsr-view', { layout: 'mobile', data: results2, data2: results[0], monAllow, daysDiff, openMon });


        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static edit = async (req, res) => {
        const { dsr_date, emp_id } = req.params;
        const { postFlag } = req.query;
        try {
            const [atten_flag_list] = await this.getData(req, res.locals.user);

            const formattedDate = moment(dsr_date).format('YYYY-MM');
            const empTpSql = "Select a.emp_id,a.dsr_date,a.tp_1 as tp_id, CONCAT(b.from,' --to-- ',b.to) as tp_name " +
                " FROM dsr_1 as a" +
                " JOIN tp_routes as b ON (a.tp_1=b.tp_id)" +
                " Where DATE_FORMAT(a.dsr_date, '%Y-%m') = ? and a.emp_id=?";
            const empTpParams = [formattedDate, emp_id];
            const empTpRoutes = await executeQuery(empTpSql, empTpParams);
            // console.log('empTpRoutes...', empTpRoutes)

            const sqlStr = "Select a.emp_id,a.dsr_date,a.atten_flag,a.hr_flag,a.from_city,a.to_city,a.stay_city,a.total_allow,total_lodge,a.total_exp,a.post_mg,a.post_ac," +
                " a.tp_2 as tp_id, CONCAT(b.from,' --to-- ',b.to) as tp_name " +
                " FROM dsr_1 as a" +
                " LEFT JOIN tp_routes as b ON (a.tp_2=b.tp_id)" +
                " Where a.dsr_date=? and a.emp_id=?";
            const params = [dsr_date, emp_id];
            const results = await executeQuery(sqlStr, params);

            const sqlStr3 = "Select a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.first_name,' ',d.middle_name,' ',d.last_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params3 = [emp_id];
            const results3 = await executeQuery(sqlStr3, params3);
            if (results3.length === 0) {
                res.status(404).send("<h1>Designation not found for this employee.</h1>");
                return;
            }

            let sqlStr2 = "Select a.sr_no,a.allow_id,b.allow_name,a.amount,a.from_km,a.to_km,a.photo_path,c.type,c.km_rate" +
                " FROM dsr_2 as a, allowances as b, allow_pricelist as c" +
                " Where a.allow_id=b.allow_id and b.allow_id=c.allow_id" +
                " and a.dsr_date=? and a.emp_id=? and c.desg_id=? and c.atten_flag IN ('XX',?) Order By a.sr_no";
            let params2 = [dsr_date, emp_id, results3[0].desg_id, results[0].atten_flag];
            let results2 = await executeQuery(sqlStr2, params2);
            if (results2.length === 0) {
                sqlStr2 = "Select '10' as sr_no,'2' as allow_id,'Train' as allow_name,0 as amount,0 as from_km,0 as to_km,'' as photo_path,'Fix' as type,0 as km_rate" +
                    " FROM dual";
                results2 = await executeQuery(sqlStr2);
            }

            const sqlStr4 = "SELECT a.allow_id,a.allow_name FROM allowances as a" +
                " Where a.status='A' and a.allow_group='B'" +
                " and a.allow_id In (Select DISTINCT b.allow_id From allow_pricelist as b Where b.desg_id=?)"
            const allow_list = await executeQuery(sqlStr4, [results3[0].desg_id]);

            if (postFlag === 'Y') {
                res.render('dsr/dsr-edit', { data: results[0], data2: results2, data3: results3[0], atten_flag_list, allow_list, postFlag, empTpRoutes });
            } else {
                res.render('dsr/dsr-edit', { layout: 'mobile', data: results[0], data2: results2, data3: results3[0], atten_flag_list, allow_list, empTpRoutes });
            }

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static saveLeaveData = async (req, res) => {
        var { dsr_date, emp_id, leave_flag } = req.body;

        try {
            let sqlStr1 = "Select a.atten_flag, a.hr_flag" +
                " FROM dsr_1 as a Where dsr_date=? and emp_id=?"
            let params1 = [dsr_date, emp_id];
            let results1 = await executeQuery(sqlStr1, params1);
            if (results1.length > 0) {
                if (!(results1[0].atten_flag === 'XX' || results1[0].atten_flag === null || results1[0].atten_flag === undefined || results1[0].atten_flag === '')) {
                    leave_flag = 'P';
                }
            }

            const sqlStr = "Update dsr_1 Set hr_flag=?" +
                " WHERE dsr_date=? and emp_id=?";
            await executeQuery(sqlStr, [leave_flag, dsr_date, emp_id]);
            res.status(200).send('Leave data saved successfully');

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    };

    static update = async (req, res) => {
        const { dsr_date, emp_id } = req.params;
        const { atten_flag, tp_id, from_city, to_city, stay_city, total_allow, total_lodge, total_exp, sr_no, allow_id, amount, from_km, to_km, type, km_rate } = req.body;
        const data = req.body
        const [atten_flag_list] = await this.getData(req, res.locals.user);
        const { postFlag } = req.query;

        const sqlStr4 = "SELECT a.allow_id,a.allow_name FROM allowances as a" +
            " Where a.status='A' and a.allow_group='B'" +
            " and a.allow_id In (Select DISTINCT b.allow_id From allow_pricelist as b Where b.desg_id=?)"
        const allow_list = await executeQuery(sqlStr4, [data.desg_id]);

        var errors = [];
        // if (!atten_flag || atten_flag === 'XX') {
        //     errors.push({ message: 'Attendance (Status) flag is required' });
        // }
        // if (!from_city) {
        //     errors.push({ message: 'Select from city' });
        // }
        // if (!to_city) {
        //     errors.push({ message: 'Select to city' });
        // }

        if (!allow_id || allow_id.length === undefined) {
            errors.push({ message: 'You have not select proper values.' });
            console.log('Allowance not selected.... emp_id ' + emp_id);
            // return;
        } else {
            //Check duplicate item entry
            // const allowIDVal = Array.isArray(allow_id) ? allow_id : [allow_id];
            // for (let i = 0; i < allow_id.length; i++) {
            //     for (let j = i + 1; j < allow_id.length; j++) {
            //         if (allowIDVal[i] === allowIDVal[j]) {
            //             errors.push({ message: `Duplicate entry found for row no ${i + 1} and row no ${j + 1}.` });
            //         }
            //     }
            // }

            //Check allowance with price list whether it allowed or not
            // const allow_id_val = Array.isArray(allow_id) ? allow_id : [allow_id];
            // const type_val = Array.isArray(type) ? type : [type];
            // for (let i = 0; i < allow_id.length; i++) {
            //     const sqlStr = "Select a.allow_id,b.allow_name,a.desg_id,a.atten_flag,a.type,a.km_rate" +
            //         " FROM allow_pricelist as a, allowances as b" +
            //         " Where a.allow_id=b.allow_id and a.allow_id=? and a.desg_id=? and a.atten_flag IN ('XX',?) and a.type=?";
            //     let params = [allow_id_val[i], data.desg_id, atten_flag, type_val[i]];
            //     let results = await executeQuery(sqlStr, params);
            //     if (results.length === 0) {
            //         errors.push({ message: `Status (Atten Flag: '${atten_flag}') with row no ${i + 1} is not allowed.` });
            //     }
            // }
        }

        if (errors.length) {
            const formattedDate = moment(dsr_date).format('YYYY-MM');
            const empTpSql = "Select a.emp_id,a.dsr_date,a.tp_1 as tp_id, CONCAT(b.from,' --to-- ',b.to) as tp_name " +
                " FROM dsr_1 as a" +
                " LEFT JOIN tp_routes as b ON (a.tp_1=b.tp_id)" +
                " Where DATE_FORMAT(a.dsr_date, '%Y-%m') = ? and a.emp_id=?";
            const empTpParams = [formattedDate, emp_id];
            const empTpRoutes = await executeQuery(empTpSql, empTpParams);

            const sqlStr3 = "Select a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.first_name,' ',d.middle_name,' ',d.last_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params3 = [emp_id];
            const results3 = await executeQuery(sqlStr3, params3);

            let sqlStr2 = "Select a.sr_no,a.allow_id,b.allow_name,a.amount,a.from_km,a.to_km,a.photo_path,c.type,c.km_rate" +
                " FROM dsr_2 as a, allowances as b, allow_pricelist as c" +
                " Where a.allow_id=b.allow_id and b.allow_id=c.allow_id" +
                " and a.dsr_date=? and a.emp_id=? and c.desg_id=? Order By a.sr_no";
            let params2 = [dsr_date, emp_id, results3[0].desg_id];
            let results2 = await executeQuery(sqlStr2, params2);
            if (results2.length === 0) {
                sqlStr2 = "Select '10' as sr_no,'2' as allow_id,'Train' as allow_name,0 as amount,0 as from_km,0 as to_km,'' as photo_path,'Fix' as type,0 as km_rate" +
                    " FROM dual";
                results2 = await executeQuery(sqlStr2);
            }

            res.render('dsr/dsr-edit', { layout: 'mobile', errors, data, data2: results2, data3: results3[0], atten_flag_list, allow_list, postFlag, empTpRoutes });
            return;
        }

        try {
            //sr_no, allow_id, allow_name, amount, from_km, to_km
            var hr_flag = !atten_flag || atten_flag.length === undefined || atten_flag === 'XX' ? 'A' : 'P';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const from_city_title = from_city ? titleCase(from_city) : null;
            const to_city_title = to_city ? titleCase(to_city) : null;
            const stay_city_title = stay_city ? titleCase(stay_city) : null;

            const sqlStr = "UPDATE dsr_1 Set atten_flag=?,hr_flag=?, tp_2=?, from_city=?,to_city=?,stay_city=?,total_allow=?,total_lodge=?,total_exp=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE dsr_date=? and emp_id=?"
            const params = [atten_flag, hr_flag, tp_id, from_city_title, to_city_title, stay_city_title, total_allow, total_lodge, total_exp, u_by, dsr_date, emp_id];
            await executeQuery(sqlStr, params);

            // Delete records from dsr_2
            const sqlStr3 = "Delete FROM dsr_2 WHERE dsr_date=? and emp_id=?"
            const params3 = [dsr_date, emp_id];
            await executeQuery(sqlStr3, params3);

            const allow_id_val = Array.isArray(allow_id) ? allow_id : [allow_id];
            const amount_val = Array.isArray(amount) ? amount : [amount];
            const from_km_val = Array.isArray(from_km) ? from_km : [from_km];
            const to_km_val = Array.isArray(to_km) ? to_km : [to_km];

            for (let i = 0; i < allow_id.length; i++) {
                if (amount_val[i] > 0) {
                    let sr_no_val = (i + 1) * 10;
                    const sqlStr2 = "INSERT INTO dsr_2 (dsr_date, emp_id, sr_no, allow_id, amount, from_km, to_km)" +
                        " VALUES (?,?,?,?,?,?,?)"
                    const paramsDt = [dsr_date, emp_id, sr_no_val, allow_id_val[i], amount_val[i], from_km_val[i], to_km_val[i]];
                    await executeQuery(sqlStr2, paramsDt);
                }
            }

            // res.redirect('/dsr/view?alert=Update+Records+successfully');
            if (postFlag === 'Y') {
                res.redirect(`/dsr/post-edit?selectedEmpID=${emp_id}`);
            } else {
                res.redirect('/dsr/view');
            }


        } catch (err) {
            console.error(err);
            return res.render('dsr/dsr-view', { alert: `Internal server error` });
        }
    };

    static postPM = async (req, res) => {
        try {
            const sqlStr = "Select a.emp_id as boss_code, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as boss_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const bossData = await executeQuery(sqlStr, params);
            if (bossData.length === 0) {
                res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                return;
            }

            const sqlStr1 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr1);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open</h1>");
                return;
            }

            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.boss_id=?"
            const params2 = [bossData[0].boss_code];
            const empList = await executeQuery(sqlStr2, params2);

            res.render('dsr/dsr-post-pm', { bossData: bossData[0], monData: monData[0], emp_list: empList });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static postEdit = async (req, res) => {
        const { selectedEmpID } = req.query;
        try {
            const sqlStr = "Select a.emp_id as boss_code, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as boss_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const bossData = await executeQuery(sqlStr, params);
            if (bossData.length === 0) {
                res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                return;
            }

            const sqlStr1 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr1);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open</h1>");
                return;
            }
            const from_date = moment(monData[0].month_date);
            const to_date = from_date.clone().endOf('month');
            const openMon = { year: monData[0].year, month: monData[0].month }
            let daysDiff = 25 - to_date.diff(from_date, 'days');
            if (daysDiff <= 0) {
                daysDiff = 0;
            }

            //Get employee details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [selectedEmpID];
            const empData = await executeQuery(sqlStr2, params2);

            //Get monthly allowance saved pricelist and post flag
            let monAllow = { monPost: null, stationaryRate: 0, postageRate: 0, internetRate: 0, otherRate: 0, remarksVal: null };
            if (empData.length > 0) {
                const sqlStr1 = "Select * FROM dsr_0 as a Where year=? and month=? and emp_id=?"
                const params1 = [openMon.year, openMon.month, selectedEmpID];
                const monAllowPost = await executeQuery(sqlStr1, params1);

                monAllow = {  //Value pick from pricelist
                    monPost: monAllowPost.length > 0 ? monAllowPost[0].post_mg : 'N',
                    monRemarks: monAllowPost.length > 0 ? monAllowPost[0].remarks : '',
                };//Needs to check whether it's required or not

                if (monAllowPost.length > 0) {
                    // if (monAllowPost[0].stationary_val > 0 || monAllowPost[0].postage_val > 0 || monAllowPost[0].internet_val > 0 || monAllowPost[0].other_val > 0) {
                    monAllow = {  //Value pick from saved table dsr_0
                        monPost: monAllowPost.length > 0 ? monAllowPost[0].post_mg : 'N',
                        stationaryRate: monAllowPost[0].stationary_val,
                        postageRate: monAllowPost[0].postage_val,
                        internetRate: monAllowPost[0].internet_val,
                        otherRate: monAllowPost[0].other_val,
                        monRemarks: monAllowPost.length > 0 ? monAllowPost[0].remarks : '',
                    };
                    // }
                }

            }

            const sqlStr3 = "Select * From dsr_1 Where emp_id=? and dsr_date Between ? and ?"
            const params3 = [selectedEmpID, from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD')];
            const dsrData = await executeQuery(sqlStr3, params3);

            res.render('dsr/dsr-post', { bossData: bossData[0], monData: monData[0], empData: empData[0], dsrData, monAllow, daysDiff, openMon });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static saveMonAllow = async (req, res) => {
        var { dsrYear, dsrMonth, empID, stationaryVal, postageVal, internetVal, otherVal, remarksVal } = req.body;
        try {
            const sqlStr1 = "Select * FROM dsr_0 Where year=? and month=? and emp_id=?"
            const params1 = [dsrYear, dsrMonth, empID];
            const row1 = await executeQuery(sqlStr1, params1);
            if (row1.length > 0) {
                if (row1[0].post_mg === 'Y') {
                    //res.status(404).send('Account post');
                    res.json({ postMgFlag: row1[0].post_mg });
                    return
                }
            }

            if (row1.length > 0) {
                var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
                const sqlStr5 = "Update dsr_0 Set stationary_val=?,postage_val=?,internet_val=?,other_val=?,remarks=?,u_at=CURRENT_TIMESTAMP(),u_by=?" +
                    " Where year=? and month=? and emp_id=?"
                const params5 = [stationaryVal, postageVal, internetVal, otherVal, remarksVal, u_by, dsrYear, dsrMonth, empID];
                await executeQuery(sqlStr5, params5);
            } else {
                var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
                const sqlStr6 = "INSERT INTO dsr_0 (year,month,emp_id,post_mg,post_ac,stationary_val,postage_val,internet_val,other_val, remarks,c_at,c_by)" +
                    " VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
                const params6 = [dsrYear, dsrMonth, empID, 'N', 'N', stationaryVal, postageVal, internetVal, otherVal, remarksVal, c_by];
                await executeQuery(sqlStr6, params6);
            }

            res.json({ message: 'Monthly allowance data saved successfully' });
            //res.status(200).send('Montly allowance data saved successfully');
            //errors.push({ message: 'Montly allowance data saved successfully' });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    };

    static postMonAllow = async (req, res) => {
        var { dsrYear, dsrMonth, empID, stationaryVal, postageVal, internetVal, otherVal, remarksVal } = req.body;
        try {
            const sqlStr1 = "Select * FROM dsr_0 Where year=? and month=? and emp_id=?"
            const params1 = [dsrYear, dsrMonth, empID];
            const row1 = await executeQuery(sqlStr1, params1);
            if (row1.length > 0) {
                if (row1[0].post_ac === 'Y') {
                    //res.status(404).send('Account post');
                    res.json({ postAcFlag: row1[0].post_ac });
                    return
                }
            }

            let sqlStr4 = "Update dsr_1 Set post_mg='Y' Where DATE_FORMAT(dsr_date,'%Y')=? and DATE_FORMAT(dsr_date,'%m')=? and emp_id=?"
            let params4 = [parseInt(dsrYear), parseInt(dsrMonth), empID];
            await executeQuery(sqlStr4, params4);

            if (row1.length > 0) {
                var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
                const sqlStr5 = "Update dsr_0 Set post_mg='Y',stationary_val=?,postage_val=?,internet_val=?,other_val=?,remarks=?,u_at=CURRENT_TIMESTAMP(),u_by=?" +
                    " Where year=? and month=? and emp_id=?"
                const params5 = [stationaryVal, postageVal, internetVal, otherVal, remarksVal, u_by, dsrYear, dsrMonth, empID];
                await executeQuery(sqlStr5, params5);
            } else {
                var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
                const sqlStr6 = "INSERT INTO dsr_0 (year,month,emp_id,post_mg,post_ac,stationary_val,postage_val,internet_val,other_val,remarks,c_at,c_by)" +
                    " VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
                const params6 = [dsrYear, dsrMonth, empID, 'Y', 'N', stationaryVal, postageVal, internetVal, otherVal, remarksVal, c_by];
                await executeQuery(sqlStr6, params6);
            }

            res.json({ message: 'Monthly allowance post successfully' });
            // res.status(200).send('Montly allowance post successfully');

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    };

    static empReport = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        const { emp_id, mon_date } = req.query;
        try {
            const empID = emp_id === null || emp_id === undefined ? 0 : emp_id;

            var fromDate = null;
            var toDate = null;
            if (mon_date === null || mon_date === undefined) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = moment(mon_date + '01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr0);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open</h1>");
                return;
            }
            const minDate = moment(monData[0].month_date).subtract(2, 'months');
            const maxDate = moment(monData[0].month_date);

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            let logUserID = 0;
            if (logUser.length > 0) {
                logUserID = logUser[0].emp_id;
                //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                //     return;
            }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUserID} or a.boss_id=${logUserID})`;
            }
            // const params1 = [logUserID, logUserID];
            const empList = await executeQuery(sqlStr1) //, params1);

            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlStr3 = "SELECT a.emp_id,a.dsr_date,a.atten_flag,a.hr_flag,a.from_city,a.to_city,a.stay_city," +
                " a.total_allow,a.total_lodge,a.total_exp,a.post_mg" +
                " FROM dsr_1 as a WHERE a.dsr_date Between ? and ? and a.emp_id=?" +
                " Order By a.emp_id,a.dsr_date"
            const params3 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            const dsrData = await executeQuery(sqlStr3, params3);

            let sqlStr4 = "SELECT DATE_FORMAT(b.dsr_date, '%b-%Y') AS mon_year, a.atten_flag, COUNT(b.dsr_date) as atten_cnt" +
                " FROM atten_flags AS a" +
                " LEFT JOIN dsr_1 AS b ON a.atten_flag = b.atten_flag" +
                " and b.dsr_date Between ? and ? and b.emp_id=?" +
                " GROUP BY DATE_FORMAT(b.dsr_date, '%b-%Y'), a.atten_flag;"
            const params4 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            const dsrAtten = await executeQuery(sqlStr4, params4);

            let sqlStr5 = "Select a.year, a.month, a.emp_id, a.post_mg, a.post_ac, a.stationary_val, a.postage_val, a.internet_val, a.other_val, a.remarks" +
                " From dsr_0 as a" +
                " Where a.year=? and a.month=? and a.emp_id=?";
            const params5 = [fromDate.format('YYYY'), fromDate.format('MM'), empID];
            const dsrSum = await executeQuery(sqlStr5, params5);

            res.render('dsr/dsr-report', { emp_list: empList, empData: empData[0], dsrData, dsrAtten, dsrSum: dsrSum[0], minDate, maxDate, curMon: mon_date, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static exportPdf = async (req, res) => {
        const { exportPDF_empID, exportPDF_curMon } = req.query;
        try {
            const empID = exportPDF_empID === null || exportPDF_empID === undefined ? 0 : exportPDF_empID;

            var fromDate = null;
            var toDate = null;
            if (exportPDF_curMon === null || exportPDF_curMon === undefined) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = moment(exportPDF_curMon + '01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            //Get emp company details
            const sqlStr1 = "Select a.vc_comp_code, b.vc_comp_name" +
                " FROM employees as a LEFT JOIN emp_comp as b ON (a.vc_comp_code=b.vc_comp_code)" +
                " Where a.emp_id=?"
            const params1 = [empID];
            const compData = await executeQuery(sqlStr1, params1);
            let comp_name = null;
            if (compData.length > 0) {
                comp_name = compData[0].vc_comp_name;
            }

            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlStr3 = "SELECT a.emp_id,DATE_FORMAT(a.dsr_date,'%d/%m/%Y') as dsr_date,IFNULL(a.atten_flag,'') as atten_flag,a.hr_flag," +
                " IFNULL(a.from_city,'') as from_city,IFNULL(a.to_city,'') as to_city,IFNULL(a.stay_city,'') as stay_city," +
                " a.total_allow,a.total_lodge,a.total_exp,a.post_mg" +
                " FROM dsr_1 as a WHERE a.dsr_date Between ? and ? and a.emp_id=?" +
                " Order By a.emp_id,a.dsr_date"
            const params3 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            const dsrData = await executeQuery(sqlStr3, params3);

            let sqlStr4 = "SELECT DATE_FORMAT(b.dsr_date, '%b-%Y') AS mon_year, IFNULL(a.atten_flag,'') as atten_flag, COUNT(b.dsr_date) as atten_cnt" +
                " FROM atten_flags AS a" +
                " LEFT JOIN dsr_1 AS b ON a.atten_flag = b.atten_flag" +
                " and b.dsr_date Between ? and ? and b.emp_id=?" +
                " GROUP BY DATE_FORMAT(b.dsr_date, '%b-%Y'), a.atten_flag;"
            const params4 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            const dsrAtten = await executeQuery(sqlStr4, params4);

            let sqlStr5 = "Select a.year, a.month, a.emp_id, a.post_mg, a.post_ac, a.stationary_val, a.postage_val, a.internet_val, a.other_val, a.remarks" +
                " From dsr_0 as a" +
                " Where a.year=? and a.month=? and a.emp_id=?";
            const params5 = [fromDate.format('YYYY'), fromDate.format('MM'), empID];
            const dsrSum = await executeQuery(sqlStr5, params5);

            let sqlStr6 = "Select a.allow_id, b.allow_name, Sum(a.amount) as allow_amt" +
                " From dsr_2 as a, allowances as b" +
                " WHERE a.allow_id=b.allow_id and a.dsr_date Between ? and ? and a.emp_id=?" +
                " Group By a.allow_id, b.allow_name";
            const params6 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            const dsrFare = await executeQuery(sqlStr6, params6);

            let sqlStr7 = "SELECT a.emp_id,DATE_FORMAT(a.dsr_date,'%d/%m/%Y') as dsr_date,IFNULL(a.atten_flag,'') as atten_flag,a.hr_flag," +
                " IFNULL(a.from_city,'') as from_city,IFNULL(a.to_city,'') as to_city,IFNULL(a.stay_city,'') as stay_city," +
                " a.total_allow,a.total_lodge,a.total_exp,a.post_mg," +
                " b.allow_id,c.allow_name,b.amount,b.from_km,b.to_km" +
                " FROM dsr_1 as a, dsr_2 as b,allowances as c" +
                " WHERE a.emp_id=b.emp_id and a.dsr_date=b.dsr_date and b.allow_id=c.allow_id and a.dsr_date Between ? and ? and a.emp_id=?" +
                " Order By a.emp_id,a.dsr_date"
            const params7 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            const dsrDtlData = await executeQuery(sqlStr7, params7);

            //Export to PDF
            let doc = new PDFDocument({ margin: 40, size: 'A4' });

            doc.info.Title = 'Expenses details report';
            // Align the title and subtitle
            // doc.fontSize(14).text('Expenses report for Month :' + fromDate.format('MMM-YYYY') , { align: 'left' });
            // doc.fontSize(10).text('Employee : ' + empData[0].emp_name, { align: 'left' });
            // doc.fontSize(10).text('Approved By : ' + empData[0].boss_name, { align: 'left' });

            // const subtitles = [
            //     { label: "Expenses details report for Month: " + fromDate.format('MMM-YYYY') },
            //     { label: "Employee: " + empData[0].emp_name, align: 'left' },
            //     { label: "Approved By: " + empData[0].boss_name, align: 'right' }
            // ];
            // subtitles.forEach(subtitle => {
            //     doc.text(subtitle.label, { align: subtitle.align || 'left' });
            // });
            // doc.text('');

            // const employeeName = empData[0].emp_name;
            // const approvedBy = empData[0].boss_name;
            // const subtitleLabel = `Employee: ${employeeName} ${" ".repeat(85 - employeeName.length)}Approved By: ${approvedBy}`;

            doc.table({
                title: { label: comp_name + " :  Expenses Report for " + fromDate.format('MMMM YYYY') },
                subtitle: { label: "Employee: " + empData[0].emp_name + "     Desg: " + empData[0].desg_name + "     HQ: " + empData[0].hq_name + "     Approved By: " + empData[0].boss_name },
                // subtitle: { label: subtitleLabel },
                headers: [
                    { label: "Date", width: 50, align: 'left' },
                    { label: "Status", width: 30, align: 'left' },
                    { label: "HR", width: 30, align: 'left' },
                    { label: "From City", width: 100, align: 'left' },
                    { label: "To City", width: 130, align: 'left' },
                    { label: "Stay", width: 80, align: 'left' },
                    { label: "Lodge", width: 30, align: 'right' },
                    { label: "DA", width: 30, align: 'right' },
                    { label: "Fare", width: 30, align: 'right' }
                ],
                rows: dsrData.map(row => [row.dsr_date, row.atten_flag, row.hr_flag,
                row.from_city.substr(0, 22), row.to_city.substr(0, 22), row.stay_city.substr(0, 22),
                row.total_lodge, row.total_allow, row.total_exp]),
                // header: headerOpts,
                repeatingHeader: true // enable repeating headers
            });


            //*******Attendance Report Start******/
            doc.moveDown(1);
            // doc.addPage();
            // doc.text('')
            const startX = 10;
            let startY = doc.y;

            // Calculate the total
            let totalDays = 0;
            dsrAtten.forEach(row => {
                totalDays += row.atten_cnt;
            });
            // Create the total row manually
            const totalRow = ['Total', totalDays];
            // Append the total row to the dsrAtten array
            const tableRows = [...dsrAtten.map(row => [row.atten_flag, row.atten_cnt]), totalRow];

            doc.table({
                // title: { label: "Attendance Details" },
                subtitle: { label: "Attendance Details" },
                headers: [
                    { label: "Status", width: 80, align: 'left' },
                    { label: "Days", width: 40, align: 'right' }
                ],
                rows: tableRows, //dsrAtten.map(row => [row.atten_flag, row.atten_cnt]),
                // header: headerOpts,
                repeatingHeader: false, // enable repeating headers
                startX,
                startY
            });
            //*******Attendance Report End******/

            //*******Summary Report Start******/
            doc.moveDown();
            const attenTableWidth = doc.x - startX;
            const sumStartX = startX + attenTableWidth + 150; // Adjust the value as per your requirement
            doc.text('', sumStartX, startY);
            const summaryTableY = doc.y; // Store the Y position of the summary table

            // Calculate the total
            let totalDA = 0;
            let totalLodge = 0;
            let totalFare = 0;
            let GTotal = 0;
            dsrData.forEach(row => {
                totalDA += row.total_allow;
                totalLodge += row.total_lodge;
                totalFare += row.total_exp;
            });
            GTotal = totalDA + totalLodge + totalFare + dsrSum[0].stationary_val + dsrSum[0].postage_val + dsrSum[0].internet_val + dsrSum[0].other_val

            doc.table({
                // title: { label: "Summary" },
                subtitle: { label: "Summary Report" },
                headers: [
                    { label: "Particulars", width: 80, align: 'left' },
                    { label: "Amount", width: 40, align: 'right' }
                ],
                rows: [
                    ["Total DA", totalDA],
                    ["Total Lodging", totalLodge],
                    ["Total Fare", totalFare],
                    ["Stationary", dsrSum[0].stationary_val],
                    ["Postage", dsrSum[0].postage_val],
                    ["Internet", dsrSum[0].internet_val],
                    ["Other", dsrSum[0].other_val],
                    ["Total Amount", GTotal]//,
                    //["Remarks", dsrSum[0].remarks]
                ],
                repeatingHeader: false, // enable repeating headers
                startX: sumStartX,
                startY: summaryTableY // Use the stored Y position
            });
            doc.text('Remarks: ' + dsrSum[0].remarks, sumStartX, summaryTableY + 170);
            //*******Summary Report End******/


            //******Fare Report Start*****/
            doc.moveDown();
            const fareTableWidth = doc.x - startX;
            const fareStartX = sumStartX + fareTableWidth - 30; // Adjust the value as per your requirement
            doc.text('', fareStartX, startY);
            const fareTableY = doc.y; // Store the Y position of the summary table

            // Calculate the total
            let totalFareAmt = 0;
            dsrFare.forEach(row => {
                totalFareAmt += row.allow_amt;
            });
            // Create the total row manually
            const totalFareRow = ['Total Fare', totalFareAmt];
            // Append the total row to the dsrAtten array
            const tableFareRows = [...dsrFare.map(row => [row.allow_name, row.allow_amt]), totalFareRow];

            doc.table({
                // title: { label: "Fare Details" },
                subtitle: { label: "Fare Details" },
                headers: [
                    { label: "Fare Details", width: 80, align: 'left' },
                    { label: "Amount", width: 40, align: 'right' }
                ],
                rows: tableFareRows, //dsrAtten.map(row => [row.atten_flag, row.atten_cnt]),
                // header: headerOpts,
                repeatingHeader: false, // enable repeating headers
                startX: fareStartX,
                startY: fareTableY
            });
            //*******Fare Report End*******/


            //*******DSR Details Report Start*******/
            doc.addPage();
            doc.text('')
            const startX1 = 10;
            let startY1 = doc.y;

            // Calculate the total and sum of km differences
            let totalDtlFareAmt = 0;
            let totalKmDifference = 0;
            dsrDtlData.forEach(row => {
                totalDtlFareAmt += row.amount;
                const fromKm = row.from_km !== null && row.from_km !== undefined ? row.from_km : 0;
                const toKm = row.to_km !== null && row.to_km !== undefined ? row.to_km : 0;
                row.kmDifference = toKm - fromKm;
                totalKmDifference += row.kmDifference;
            });

            // Create the total row manually
            const totalDtlFareRow = ['Total Fare/Km', '', '', '', '', '', totalDtlFareAmt, '', '', totalKmDifference];
            // const totalDtlFareRow = ['Total Fare', totalDtlFareAmt];
            // const totalKmDifferenceRow = ['Total Km', totalKmDifference];

            // Append the total row and total km difference row to the dsrAtten array
            const tableDtlRows = [
                ...dsrDtlData.map(row => [
                    row.dsr_date, row.atten_flag,
                    row.from_city, row.to_city, row.stay_city,
                    row.allow_name, row.amount, row.from_km, row.to_km, row.kmDifference
                ]),
                totalDtlFareRow //,
                //totalKmDifferenceRow
            ];

            doc.table({
                title: { label: comp_name + " :  Expenses Detail Report for " + fromDate.format('MMMM YYYY') },
                subtitle: { label: "Employee: " + empData[0].emp_name + "     Desg: " + empData[0].desg_name + "     HQ: " + empData[0].hq_name + "     Approved By: " + empData[0].boss_name },
                // subtitle: { label: "Expenses Details" },
                headers: [
                    { label: "Date", width: 50, align: 'left' },
                    { label: "Status", width: 30, align: 'left' },
                    { label: "From City", width: 80, align: 'left' },
                    { label: "To City", width: 80, align: 'left' },
                    { label: "Stay", width: 80, align: 'left' },
                    { label: "Transport", width: 40, align: 'left' },
                    { label: "Amount", width: 40, align: 'right' },
                    { label: "From Km", width: 40, align: 'right' },
                    { label: "To Km", width: 40, align: 'right' },
                    { label: "Total Km", width: 40, align: 'right' }
                ],
                rows: tableDtlRows, //dsrAtten.map(row => [row.atten_flag, row.atten_cnt]),
                // header: headerOpts,
                repeatingHeader: true, // enable repeating headers
                startX1,
                startY1
            });
            //*******DSR Details Report End*******/

            // Set the response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=ExpensesDetails.pdf');
            // Pipe the PDF document to the response
            doc.pipe(res);
            // End the PDF document
            doc.end();

            // console.log('Data exported successfully to PDF file!'); //add employee name here 
            const now = new Date().toLocaleString();
            console.log(`TA/DA Report data exported successfully to PDF file!... user: '${res.locals.user.username} on '${now}'`);

        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    };

    static reportAtten = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        const { emp_id, mon_date } = req.query;
        try {
            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;

            var fromDate = null;
            var toDate = null;
            if (mon_date === null || mon_date === undefined) {
                fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
                empID = 0;
            } else {
                fromDate = moment(mon_date + '01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr0);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open</h1>");
                return;
            }
            const minDate = moment(monData[0].month_date).subtract(2, 'months');
            const maxDate = moment(monData[0].month_date);

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            // const params1 = [logUser[0].emp_id, logUser[0].emp_id];
            const empList = await executeQuery(sqlStr1) //, params1);

            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            // let sqlStr3 = "SELECT a.emp_id,CONCAT(b.last_name,' ',b.first_name,' ',b.middle_name) as emp_name," +
            //     " a.dsr_date,b.vc_comp_code,b.vc_emp_code,a.atten_flag,a.hr_flag,a.post_mg," +
            //     " c.in_time, d.out_time, c.loc_name as in_city, d.loc_name as out_city, CONCAT(c.loc_lat,',',c.loc_lng) as in_LatLng, CONCAT(d.loc_lat,',',d.loc_lng) as out_LatLng" +
            //     " FROM dsr_1 as a LEFT JOIN employees AS b ON a.emp_id = b.emp_id" +
            //     " LEFT JOIN (SELECT x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d') AS loc_date, DATE_FORMAT(MIN(x.loc_date),'%H:%i') AS in_time, x.loc_name, x.loc_lat, x.loc_lng FROM dsr_loc AS x GROUP BY x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d')) AS c ON a.emp_id = c.emp_id AND a.dsr_date = c.loc_date" +
            //     " LEFT JOIN (SELECT x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d') AS loc_date, DATE_FORMAT(MAX(x.loc_date),'%H:%i') AS out_time, x.loc_name, x.loc_lat, x.loc_lng FROM dsr_loc AS x GROUP BY x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d')) AS d ON a.emp_id = d.emp_id AND a.dsr_date = d.loc_date" +
            //     " WHERE a.dsr_date BETWEEN ? AND ?";

            let sqlStr3 = "SELECT a.emp_id, CONCAT(b.last_name, ' ', b.first_name, ' ', b.middle_name) AS emp_name,  a.dsr_date," +
                " b.vc_comp_code, b.vc_emp_code, a.atten_flag, a.hr_flag, a.post_mg, c.in_time, c.in_city, c.in_LatLng, d.out_time, d.out_city, d.out_LatLng" +
                " FROM dsr_1 AS a LEFT JOIN employees AS b ON a.emp_id = b.emp_id" +
                " LEFT JOIN (SELECT x.emp_id, x.loc_date AS in_loc_date, DATE_FORMAT(x.loc_date, '%Y-%m-%d') AS loc_date," +
                " DATE_FORMAT(x.loc_date, '%H:%i') AS in_time, x.loc_name AS in_city, CONCAT(x.loc_lat, ',', x.loc_lng) AS in_LatLng" +
                " FROM dsr_loc AS x WHERE x.loc_date = (SELECT MIN(loc_date) FROM dsr_loc AS y WHERE y.emp_id = x.emp_id AND DATE(y.loc_date) = DATE(x.loc_date))" +
                " ) AS c ON a.emp_id = c.emp_id AND a.dsr_date = c.loc_date" +
                " LEFT JOIN (SELECT x.emp_id, x.loc_date AS out_loc_date, DATE_FORMAT(x.loc_date, '%Y-%m-%d') AS loc_date," +
                " DATE_FORMAT(x.loc_date, '%H:%i') AS out_time, x.loc_name AS out_city, CONCAT(x.loc_lat, ',', x.loc_lng) AS out_LatLng" +
                " FROM dsr_loc AS x WHERE x.loc_date = (SELECT MAX(loc_date) FROM dsr_loc AS y WHERE y.emp_id = x.emp_id AND DATE(y.loc_date) = DATE(x.loc_date))" +
                " ) AS d ON a.emp_id = d.emp_id AND a.dsr_date = d.loc_date" +
                " WHERE a.dsr_date BETWEEN ? AND ? "

            if (empID !== 0) {
                sqlStr3 = sqlStr3 + ` and a.emp_id=${empID}`;
            }

            // console.log('Query: ' + sqlStr3)

            const params3 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')];
            const attenData = await executeQuery(sqlStr3, params3);

            // let sqlStr4 = "SELECT DATE_FORMAT(b.dsr_date, '%b-%Y') AS mon_year, a.atten_flag, COUNT(b.dsr_date) as atten_cnt" +
            //     " FROM atten_flags AS a" +
            //     " LEFT JOIN dsr_1 AS b ON a.atten_flag = b.atten_flag" +
            //     " and b.dsr_date Between ? and ? and b.emp_id=?" +
            //     " GROUP BY DATE_FORMAT(b.dsr_date, '%b-%Y'), a.atten_flag;"
            // const params4 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            // const dsrAtten = await executeQuery(sqlStr4, params4);

            let sqlStr5 = "Select a.year, a.month, a.emp_id, a.post_mg, a.post_ac, a.stationary_val, a.postage_val, a.internet_val, a.other_val, a.remarks" +
                " From dsr_0 as a" +
                " Where a.year=? and a.month=? and a.emp_id=?";
            const params5 = [fromDate.format('YYYY'), fromDate.format('MM'), empID];
            const dsrSum = await executeQuery(sqlStr5, params5);

            res.render('dsr/dsr-report-atten', { emp_list: empList, empData: empData[0], attenData, dsrSum: dsrSum[0], minDate, maxDate, curMon: mon_date, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static attenExportCSV = async (req, res) => {
        const { exportCSV_empID, exportCSV_curMon } = req.query;
        try {
            var empID = exportCSV_empID === null || exportCSV_empID === undefined || exportCSV_empID === '' ? 0 : exportCSV_empID;

            var fromDate = null;
            var toDate = null;
            if (exportCSV_curMon === null || exportCSV_curMon === undefined) {
                fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
                empID = 0;
            } else {
                fromDate = moment(exportCSV_curMon + '01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr0);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open</h1>");
                return;
            }

            // const minDate = moment(monData[0].month_date).subtract(2, 'months');
            // const maxDate = moment(monData[0].month_date);

            // //Get current login user details
            // const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
            //     " FROM employees as a" +
            //     " Where a.status='A' and a.user_id=?"
            // const params = [res.locals.user.user_id];
            // const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            // //Get emp list (boss and under emp)
            // var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
            //     " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
            //     " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
            //     " FROM employees as a, designations as b, hqs as c, employees as d" +
            //     " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            // // if (res.locals.user.user_role !== "Admin" && res.locals.user.user_role !== "Support") {
            // if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
            //     sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            // }
            // // const params1 = [logUser[0].emp_id, logUser[0].emp_id];
            // const empList = await executeQuery(sqlStr1) //, params1);

            // //Get emp details with boss details
            // const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
            //     " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
            //     " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
            //     " FROM employees as a, designations as b, hqs as c, employees as d" +
            //     " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            // const params2 = [empID];
            // const empData = await executeQuery(sqlStr2, params2);

            // let sqlStr3 = "SELECT DATE_FORMAT(a.dsr_date,'%d/%M/%Y') as dsr_date,a.emp_id,CONCAT(b.last_name,' ',b.first_name,' ',b.middle_name) as emp_name," +
            //     " CONCAT(\"'\", b.vc_comp_code) as vc_comp_code,b.vc_emp_code,a.atten_flag,a.hr_flag,a.post_mg," +
            //     " c.in_time, d.out_time, c.loc_name as in_city, d.loc_name as out_city, CONCAT(c.loc_lat,',',c.loc_lng) as in_LatLng, CONCAT(d.loc_lat,',',d.loc_lng) as out_LatLng" +
            //     " FROM dsr_1 as a LEFT JOIN employees AS b ON a.emp_id = b.emp_id" +
            //     " LEFT JOIN (SELECT x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d') AS loc_date, DATE_FORMAT(MIN(x.loc_date),'%H:%i') AS in_time, x.loc_name, x.loc_lat, x.loc_lng FROM dsr_loc AS x GROUP BY x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d')) AS c ON a.emp_id = c.emp_id AND a.dsr_date = c.loc_date" +
            //     " LEFT JOIN (SELECT x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d') AS loc_date, DATE_FORMAT(MAX(x.loc_date),'%H:%i') AS out_time, x.loc_name, x.loc_lat, x.loc_lng FROM dsr_loc AS x GROUP BY x.emp_id, DATE_FORMAT(x.loc_date,'%Y-%m-%d')) AS d ON a.emp_id = d.emp_id AND a.dsr_date = d.loc_date" +
            //     " WHERE a.dsr_date BETWEEN ? AND ?";
            let sqlStr3 = "SELECT DATE_FORMAT(a.dsr_date,'%d/%M/%Y') as `Att Date`,a.emp_id as `EmpID`, CONCAT(b.last_name, ' ', b.first_name, ' ', b.middle_name) AS `Emp Name`," +
                " CONCAT(\"'\", b.vc_comp_code) as `ERP Comp`, b.vc_emp_code as `ERP Emp`, a.atten_flag as `Status`, a.hr_flag as `HR Flag`, a.post_mg as `Post`," +
                " c.in_time as `In Time`, d.out_time  as `Out Time`, c.in_city as `In City`, d.out_city as `Out City`, c.in_LatLng as `In LatLng`, d.out_LatLng as `Out LatLng`" +
                " FROM dsr_1 AS a LEFT JOIN employees AS b ON a.emp_id = b.emp_id" +
                " LEFT JOIN (SELECT x.emp_id, x.loc_date AS in_loc_date, DATE_FORMAT(x.loc_date, '%Y-%m-%d') AS loc_date," +
                " DATE_FORMAT(x.loc_date, '%H:%i') AS in_time, x.loc_name AS in_city, CONCAT(x.loc_lat, ',', x.loc_lng) AS in_LatLng" +
                " FROM dsr_loc AS x WHERE x.loc_date = (SELECT MIN(loc_date) FROM dsr_loc AS y WHERE y.emp_id = x.emp_id AND DATE(y.loc_date) = DATE(x.loc_date))" +
                " ) AS c ON a.emp_id = c.emp_id AND a.dsr_date = c.loc_date" +
                " LEFT JOIN (SELECT x.emp_id, x.loc_date AS out_loc_date, DATE_FORMAT(x.loc_date, '%Y-%m-%d') AS loc_date," +
                " DATE_FORMAT(x.loc_date, '%H:%i') AS out_time, x.loc_name AS out_city, CONCAT(x.loc_lat, ',', x.loc_lng) AS out_LatLng" +
                " FROM dsr_loc AS x WHERE x.loc_date = (SELECT MAX(loc_date) FROM dsr_loc AS y WHERE y.emp_id = x.emp_id AND DATE(y.loc_date) = DATE(x.loc_date))" +
                " ) AS d ON a.emp_id = d.emp_id AND a.dsr_date = d.loc_date" +
                " WHERE a.dsr_date BETWEEN ? AND ? "
            if (empID !== 0) {
                sqlStr3 = sqlStr3 + ` and a.emp_id=${empID}`;
            }
            const params3 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')];
            const attenData = await executeQuery(sqlStr3, params3);

            // let sqlStr4 = "SELECT DATE_FORMAT(b.dsr_date, '%b-%Y') AS mon_year, a.atten_flag, COUNT(b.dsr_date) as atten_cnt" +
            //     " FROM atten_flags AS a" +
            //     " LEFT JOIN dsr_1 AS b ON a.atten_flag = b.atten_flag" +
            //     " and b.dsr_date Between ? and ? and b.emp_id=?" +
            //     " GROUP BY DATE_FORMAT(b.dsr_date, '%b-%Y'), a.atten_flag;"
            // const params4 = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD'), empID];
            // const dsrAtten = await executeQuery(sqlStr4, params4);

            // let sqlStr5 = "Select a.year, a.month, a.emp_id, a.post_mg, a.post_ac, a.stationary_val, a.postage_val, a.internet_val, a.other_val, a.remarks" +
            //     " From dsr_0 as a" +
            //     " Where a.year=? and a.month=? and a.emp_id=?";
            // const params5 = [fromDate.format('YYYY'), fromDate.format('MM'), empID];
            // const dsrSum = await executeQuery(sqlStr5, params5);

            /***********************************************/
            const csvStream = csv.format({ headers: true });
            const fileName = 'Atd_' + fromDate.format('MM-YYYY') + '.csv'
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName); // Replace "users.csv" with your desired filename
            res.set('Content-Type', 'text/csv');
            csvStream.pipe(res);
            // const modifiedAttenData = attenData.map((row) => {
            //     return {...row,vc_comp_code: `'${row.vc_comp_code}`, };
            //   });
            // modifiedAttenData.forEach((row) => csvStream.write(row));
            attenData.forEach((row) => csvStream.write(row));
            csvStream.end();

            const now = new Date().toLocaleString();
            console.log(`Employee attendance data exported as ${fileName} file!... user: '${res.locals.user.username} on '${now}'`);
            // console.log('Data exported successfully to CSV file!');

        } catch (err) {
            console.error(err);
        } finally {
            //conn.release
        }
    };

    static delete = async (req, res) => {
        const { dsr_date, emp_id } = req.params;
        try {
            var errors = [];
            //const conn = await pool.getConnection();
            const sqlStr3 = "Select * from po_hd Where dsr_date=? and emp_id=? and posted='Y'"
            const params3 = [dsr_date, emp_id];
            const rows = await executeQuery(sqlStr3, params3);
            //conn.release
            if (rows.length > 0) {
                errors.push({ message: "Posted entry can't delete" });
            }
            //            
            if (errors.length) {
                //res.render('dsr/dsr-view', { errors });
                res.redirect(`/dsr/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            //
            const params = [dsr_date, emp_id];
            //const conn1 = await pool.getConnection();
            // await conn1.beginTransaction();
            const sqlStr1 = "Delete FROM po_dt WHERE dsr_date=? and emp_id=?"
            await executeQuery(sqlStr1, params);
            //
            const sqlStr2 = "Delete FROM po_hd WHERE dsr_date=? and emp_id=?"
            await executeQuery(sqlStr2, params);
            // await conn1.commit();
            // conn1.release
            //
            //res.redirect('/dsr/view');
            res.redirect('/dsr/view?alert=customer+deleted+successfully');

        } catch (err) {
            console.error(err);
            return res.render('dsr/dsr-view', { alert: `Internal server error` });
        } finally {
            //conn.release();
        }
    };

    static saveLocation = async (req, res) => {
        var { empID, locLat, locLng, locName, saveLocFlag, locAdd, dataURL1, dataURL2, dataURL3 } = req.body;

        try {
            const row = await executeQuery("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS current_datetime;");
            const curDatetime = row[0].current_datetime;
            const frDt = moment(curDatetime).subtract(10, 'minutes')//10
            const fromDate = frDt.format('YYYY-MM-DD HH:mm:ss');
            const toDate = moment(curDatetime).format('YYYY-MM-DD HH:mm:ss');
            if (saveLocFlag === 'Y') {
                const sqlStr = "Select * from dsr_loc" +
                    " Where emp_id=? and loc_date Between ? and ?"; // and loc_lat=? and loc_lng=? 
                const params = [empID, fromDate, toDate]; //locLat, locLng, 
                const locData = await executeQuery(sqlStr, params);
                if (locData.length === 0) {
                    const sqlStr2 = "INSERT INTO dsr_loc (emp_id,loc_date,loc_lat,loc_lng,loc_name,loc_add)" +
                        " VALUES(?,?,?,?,?,?)"; //CURRENT_TIMESTAMP
                    const params2 = [empID, toDate, locLat, locLng, locName, locAdd];
                    await executeQuery(sqlStr2, params2);

                    await this.uploadSelfie(req, res, dataURL1, dataURL2, dataURL3, toDate, empID);
                    // console.log('Save Location:  EmpID: ' + empID + ' Lat: ' + locLat + ' Lng: ' + locLng + ' Location: ' + locName)

                } else {
                    console.log('Not Save Location:  EmpID: ' + empID + ' Lat: ' + locLat + ' Lng: ' + locLng + ' Location: ' + locName)
                }
            }

            const sqlStr1 = "Select DISTINCT loc_name" +  //emp_id, loc_date, loc_lat, loc_lng,
                " From dsr_loc Where emp_id=? and loc_date >= CURRENT_DATE()" +
                " Order By loc_date";
            const params1 = [empID, locLat, locLng, locName];
            const routeData = await executeQuery(sqlStr1, params1);
            let locNames = "";
            if (routeData.length > 0) {
                locNames = "Route: " + routeData.map(row => row.loc_name).join(' > ');
            }

            res.status(200).json({ message: 'Location data saved successfully', locNames, toDate }); //toDate-for prevent next click

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal server error to save location');
        }
    };

    //******uploadSelfie */
    static uploadSelfie = async (req, res, dataURL1, dataURL2, dataURL3, toDate, empID) => {
        try {
            // const { dataURL1, dataURL2 } = req.body;
            const photo1 = 'A_' + empID + moment(toDate).format('_YYYY-MM-DD HH.mm.ss');
            const photo2 = 'B_' + empID + moment(toDate).format('_YYYY-MM-DD HH.mm.ss');
            const photo3 = 'X_' + empID + moment(toDate).format('_YYYY-MM-DD HH.mm.ss');

            // Create directory path with year+month format
            const yearMonthDir = moment(toDate).format('YYYYMM');
            const baseDir = join(process.cwd(), 'public', 'userData', yearMonthDir);

            // Create directory if it doesn't exist
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }

            const imagePath1 = join(baseDir, photo1 + '.jpeg');
            const imagePath2 = join(baseDir, photo2 + '.jpeg');
            const imagePath3 = join(baseDir, photo3 + '.jpeg');

            let filesSavedCount = 0;

            if (dataURL1) {
                const base64Data1 = dataURL1.replace(/^data:image\/\w+;base64,/, '');
                const buffer1 = Buffer.from(base64Data1, 'base64');

                fs.writeFile(imagePath1, buffer1, (err) => {
                    if (err) {
                        console.error('Error saving selfie:', err);
                        return res.status(500).json({ error: 'Error saving selfie' });
                    } else {
                        // console.log('Selfie saved successfully');
                        filesSavedCount++;

                        /*if (filesSavedCount === 2) {
                            console.log('2 Images saved successfully')
                            // return res.status(200).json({ message: 'Images saved successfully' });
                        }*/
                    }
                });
            } else {
                // console.log('dataURL1 is empty, skipping saving selfie');
            }

            if (dataURL2) {
                const base64Data2 = dataURL2.replace(/^data:image\/\w+;base64,/, '');
                const buffer2 = Buffer.from(base64Data2, 'base64');

                fs.writeFile(imagePath2, buffer2, (err) => {
                    if (err) {
                        console.error('Error saving km image:', err);
                        return res.status(500).json({ error: 'Error saving km image' });
                    } else {
                        //console.log('KM image saved successfully');
                        filesSavedCount++;

                        /*if (filesSavedCount === 2) {
                            console.log('2 Images saved successfully')
                            // return res.status(200).json({ message: 'Images saved successfully' });
                        }*/
                    }
                });
            } else {
                // console.log('dataURL2 is empty, skipping saving KM image');
            }

            if (dataURL3) {
                const base64Data3 = dataURL3.replace(/^data:image\/\w+;base64,/, '');
                const buffer3 = Buffer.from(base64Data3, 'base64');

                fs.writeFile(imagePath3, buffer3, (err) => {
                    if (err) {
                        console.error('Error saving invoice image:', err);
                        return res.status(500).json({ error: 'Error saving invoice image' });
                    } else {
                        // console.log('Invoice image saved successfully');
                        filesSavedCount++;

                        /*if (filesSavedCount === 3) {
                            console.log('3 Images saved successfully')
                            // return res.status(500).json({ message: 'Images saved successfully' });
                        }*/
                    }
                });
            } else {
                // console.log('dataURL3 is empty, skipping saving invoice image');
            }

        } catch (error) {
            console.error('Error uploading images:', error);
            return res.status(500).json({ error: 'Error uploading images' });
        }
    };

    static uploadSelfie_Old = async (req, res, dataURL1, dataURL2, dataURL3, toDate, empID) => {
        try {
            // const { dataURL1, dataURL2 } = req.body;
            const photo1 = 'A_' + empID + moment(toDate).format('_YYYY-MM-DD HH.mm.ss');
            const photo2 = 'B_' + empID + moment(toDate).format('_YYYY-MM-DD HH.mm.ss');
            const photo3 = 'X_' + empID + moment(toDate).format('_YYYY-MM-DD HH.mm.ss');

            const imagePath1 = join(process.cwd(), 'public', 'userData', photo1 + '.jpeg');
            const imagePath2 = join(process.cwd(), 'public', 'userData', photo2 + '.jpeg');
            const imagePath3 = join(process.cwd(), 'public', 'userData', photo3 + '.jpeg');

            let filesSavedCount = 0;

            if (dataURL1) {
                const base64Data1 = dataURL1.replace(/^data:image\/\w+;base64,/, '');
                const buffer1 = Buffer.from(base64Data1, 'base64');

                fs.writeFile(imagePath1, buffer1, (err) => {
                    if (err) {
                        console.error('Error saving selfie:', err);
                        return res.status(500).json({ error: 'Error saving selfie' });
                    } else {
                        // console.log('Selfie saved successfully');
                        filesSavedCount++;

                        /*if (filesSavedCount === 2) {
                            console.log('2 Images saved successfully')
                            // return res.status(200).json({ message: 'Images saved successfully' });
                        }*/
                    }
                });
            } else {
                // console.log('dataURL1 is empty, skipping saving selfie');
            }

            if (dataURL2) {
                const base64Data2 = dataURL2.replace(/^data:image\/\w+;base64,/, '');
                const buffer2 = Buffer.from(base64Data2, 'base64');

                fs.writeFile(imagePath2, buffer2, (err) => {
                    if (err) {
                        console.error('Error saving km image:', err);
                        return res.status(500).json({ error: 'Error saving km image' });
                    } else {
                        //console.log('KM image saved successfully');
                        filesSavedCount++;

                        /*if (filesSavedCount === 2) {
                            console.log('2 Images saved successfully')
                            // return res.status(200).json({ message: 'Images saved successfully' });
                        }*/
                    }
                });
            } else {
                // console.log('dataURL2 is empty, skipping saving KM image');
            }

            if (dataURL3) {
                const base64Data3 = dataURL3.replace(/^data:image\/\w+;base64,/, '');
                const buffer3 = Buffer.from(base64Data3, 'base64');

                fs.writeFile(imagePath3, buffer3, (err) => {
                    if (err) {
                        console.error('Error saving invoice image:', err);
                        return res.status(500).json({ error: 'Error saving invoice image' });
                    } else {
                        // console.log('Invoice image saved successfully');
                        filesSavedCount++;

                        /*if (filesSavedCount === 3) {
                            console.log('3 Images saved successfully')
                            // return res.status(200).json({ message: 'Images saved successfully' });
                        }*/
                    }
                });
            } else {
                // console.log('dataURL3 is empty, skipping saving invoice image');
            }

        } catch (error) {
            console.error('Error uploading images:', error);
            return res.status(500).json({ error: 'Error uploading images' });
        }
    };

    static reportLocation = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        const { emp_id, loc_date } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (loc_date === null || loc_date === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment().format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(loc_date).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(loc_date).format('YYYY-MM-DD HH:mm');
            }

            // const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
            //     " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
            //     " FROM month_open Where status='O'"
            // const monData = await executeQuery(sqlStr0);
            // if (monData.length === 0) {
            //     res.status(404).send("<h1>Month is not open</h1>");
            //     return;
            // }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            const empList = await executeQuery(sqlStr1);

            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;
            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlEmp = ""
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            }

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " a.loc_date,a.loc_lat,a.loc_lng,a.loc_name,DATE_FORMAT(a.loc_date,'%H:%i') as loc_time" +
                " FROM dsr_loc as a, employees as b" +
                " WHERE a.emp_id=b.emp_id " + sqlEmp +
                " and a.loc_date = (Select Max(x.loc_date) as loc_date From dsr_loc as x" +
                " Where x.emp_id=a.emp_id and x.loc_date Between ? and ? )"
            const params3 = [fromDate, toDate];
            const locData = await executeQuery(sqlStr3, params3);

            res.render('dsr/dsr-report-loc', { layout: 'mobile', locToDate: toDate, emp_list: empList, empData: empData[0], alert, googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locations: JSON.stringify(locData) });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static reportLocationTrack = async (req, res) => {
        // retrieve the alert message from the query parameters
        const alert = req.query.alert;
        const { emp_id, loc_date } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (loc_date === null || loc_date === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                // toDate = moment().format('YYYY-MM-DD HH:mm');
                toDate = moment().endOf('day').format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(loc_date).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(loc_date).format('YYYY-MM-DD HH:mm');
            }

            // const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
            //     " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
            //     " FROM month_open Where status='O'"
            // const monData = await executeQuery(sqlStr0);
            // if (monData.length === 0) {
            //     res.status(404).send("<h1>Month is not open</h1>");
            //     return;
            // }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            const empList = await executeQuery(sqlStr1);

            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;
            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            // let sqlEmp = ""
            // if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
            //     sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            // }
            let sqlStr3 = "SELECT DISTINCT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " a.loc_date,a.loc_lat,a.loc_lng,a.loc_name,DATE_FORMAT(a.loc_date,'%H:%i') as loc_time" +
                " FROM dsr_loc as a, employees as b" +
                " WHERE a.emp_id=b.emp_id and b.emp_id=? and a.loc_date Between ? and ?"
            const params3 = [empID, fromDate, toDate];
            const locData = await executeQuery(sqlStr3, params3);

            res.render('dsr/dsr-report-loc2', { layout: 'mobile', locToDate: toDate, emp_list: empList, empData: empData[0], alert, googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locations: JSON.stringify(locData) });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static reportLocationRegular = async (req, res) => {
        const alert = req.query.alert;
        const { emp_id, loc_date } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (loc_date === null || loc_date === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                // toDate = moment().format('YYYY-MM-DD HH:mm');
                toDate = moment().endOf('day').format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(loc_date).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(loc_date).format('YYYY-MM-DD HH:mm');
            }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            const empList = await executeQuery(sqlStr1);

            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;
            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlEmp = ""
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            }

            let seleEmp = "";
            if (emp_id && emp_id !== null && emp_id !== undefined) {
                seleEmp = ` and a.emp_id=${emp_id}`;
            }
            // console.log('emp id...', emp_id, ' seleEmp... ', seleEmp)

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " a.loc_date,a.loc_lat,a.loc_lng,a.loc_name,a.loc_add,DATE_FORMAT(a.loc_date,'%H:%i') as loc_time," +
                " b.desg_id,c.desg_name,b.hq_id,d.hq_name,b.off_day," +
                " b.boss_id, CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name," +
                " CONCAT('/userData/', DATE_FORMAT(a.loc_date,'%Y%m'), '/A_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img1," +
                " CONCAT('/userData/', DATE_FORMAT(a.loc_date,'%Y%m'), '/B_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img2," +
                " CONCAT('/userData/', DATE_FORMAT(a.loc_date,'%Y%m'), '/X_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img3" +
                " FROM dsr_loc as a, employees as b, designations as c, hqs as d, employees as e" +
                " WHERE a.emp_id=b.emp_id " + sqlEmp + seleEmp +
                " and a.loc_date Between ? and ? " +
                " and b.desg_id=c.desg_id and b.hq_id=d.hq_id and b.boss_id=e.emp_id "
            // console.log('sql', sqlStr3, fromDate, toDate)

            const params3 = [fromDate, toDate];
            const locData = await executeQuery(sqlStr3, params3);
            // console.log('Data', locData)

            res.render('dsr/dsr-report-loc3', { layout: 'mobile', locToDate: toDate, emp_list: empList, empData: empData[0], alert, locData }); // googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locations: JSON.stringify(locData) 

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static reportLocationRegular_Old = async (req, res) => {
        const alert = req.query.alert;
        const { emp_id, loc_date } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (loc_date === null || loc_date === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                // toDate = moment().format('YYYY-MM-DD HH:mm');
                toDate = moment().endOf('day').format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(loc_date).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(loc_date).format('YYYY-MM-DD HH:mm');
            }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            const empList = await executeQuery(sqlStr1);

            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;
            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlEmp = ""
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            }

            let seleEmp = "";
            if (emp_id && emp_id !== null && emp_id !== undefined) {
                seleEmp = ` and a.emp_id=${emp_id}`;
            }
            // console.log('emp id...', emp_id, ' seleEmp... ', seleEmp)

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " a.loc_date,a.loc_lat,a.loc_lng,a.loc_name,a.loc_add,DATE_FORMAT(a.loc_date,'%H:%i') as loc_time," +
                " b.desg_id,c.desg_name,b.hq_id,d.hq_name,b.off_day," +
                " b.boss_id, CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name," +
                " CONCAT('/userData/A_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img1," +
                " CONCAT('/userData/B_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img2," +
                " CONCAT('/userData/X_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img3" +
                " FROM dsr_loc as a, employees as b, designations as c, hqs as d, employees as e" +
                " WHERE a.emp_id=b.emp_id " + sqlEmp + seleEmp +
                " and a.loc_date Between ? and ? " +
                " and b.desg_id=c.desg_id and b.hq_id=d.hq_id and b.boss_id=e.emp_id "
            // console.log('sql', sqlStr3, fromDate, toDate)

            const params3 = [fromDate, toDate];
            const locData = await executeQuery(sqlStr3, params3);
            // console.log('Data', locData)

            res.render('dsr/dsr-report-loc3', { layout: 'mobile', locToDate: toDate, emp_list: empList, empData: empData[0], alert, locData }); // googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locations: JSON.stringify(locData) 

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static exportCSVLocationRegular = async (req, res) => {
        const { exportCSV_locDate, exportCSV_empID } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (exportCSV_locDate === null || exportCSV_locDate === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment().endOf('day').format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(exportCSV_locDate).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(exportCSV_locDate).format('YYYY-MM-DD HH:mm');
            }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            let sqlEmp = ""
            if (["Employee"].includes(res.locals.user.user_role)) {
                sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            }
            let seleEmp = "";
            if (exportCSV_empID && exportCSV_empID !== null && exportCSV_empID !== undefined) {
                seleEmp = ` and a.emp_id=${exportCSV_empID}`;
            }

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " DATE_FORMAT(a.loc_date,'%d/%M/%Y') as loc_date, DATE_FORMAT(a.loc_date,'%H:%i') as loc_time," +
                " a.loc_lat, a.loc_lng, a.loc_name, a.loc_add," +
                " b.desg_id, c.desg_name, b.hq_id, d.hq_name, b.off_day," +
                " b.boss_id, CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name" +
                " FROM dsr_loc as a, employees as b, designations as c, hqs as d, employees as e" +
                " WHERE a.emp_id=b.emp_id " + sqlEmp + seleEmp +
                " and a.loc_date Between ? and ? " +
                " and b.desg_id=c.desg_id and b.hq_id=d.hq_id and b.boss_id=e.emp_id "
            const params3 = [fromDate, toDate];
            const rows = await executeQuery(sqlStr3, params3);

            const fileName = `EmpLoc_${moment().format('YYYYMMDDHHmm')}.csv`
            const csvStream = csv.format({ headers: true });
            res.setHeader('Content-disposition', `attachment; filename=${fileName}`); // Replace "users.csv" with your desired filename
            res.set('Content-Type', 'text/csv');
            csvStream.pipe(res);
            rows.forEach((row) => csvStream.write(row));
            csvStream.end();

            const now = new Date().toLocaleString();
            console.log(`User location data exported successfully to CSV file!... user: '${res.locals.user.username} on '${moment().format('DD-MMM-YYYY HH:mm')}'`);

        } catch (err) {
            console.error(err);
        }
    };

    static reportLocationEmployee = async (req, res) => {
        const alert = req.query.alert;
        const { emp_id, loc_date } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (loc_date === null || loc_date === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment().endOf('day').format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(loc_date).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(loc_date).format('YYYY-MM-DD HH:mm');
            }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            const empList = await executeQuery(sqlStr1);

            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;
            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlEmp = ""
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            }

            let seleEmp = "";
            if (emp_id && emp_id !== null && emp_id !== undefined) {
                seleEmp = ` and a.emp_id=${emp_id}`;
            }

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " a.loc_date,a.loc_lat,a.loc_lng,a.loc_name,a.loc_add,DATE_FORMAT(a.loc_date,'%H:%i') as loc_time," +
                " b.desg_id,c.desg_name,b.hq_id,d.hq_name,b.off_day," +
                " b.boss_id, CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name," +
                " CONCAT('/userData/', DATE_FORMAT(a.loc_date,'%Y%m'), '/A_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img1," +
                " CONCAT('/userData/', DATE_FORMAT(a.loc_date,'%Y%m'), '/B_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img2," +
                " CONCAT('/userData/', DATE_FORMAT(a.loc_date,'%Y%m'), '/X_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img3" +
                " FROM dsr_loc as a, employees as b, designations as c, hqs as d, employees as e" +
                " WHERE a.emp_id=b.emp_id " + sqlEmp + seleEmp +
                " and a.loc_date Between ? and ? " +
                " and b.desg_id=c.desg_id and b.hq_id=d.hq_id and b.boss_id=e.emp_id "
            const params3 = [fromDate, toDate];
            const locData = await executeQuery(sqlStr3, params3);

            res.render('dsr/dsr-report-loc-emp', { layout: 'mobile', locToDate: toDate, emp_list: empList, empData: empData[0], alert, locData });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static reportLocationEmployee_Old = async (req, res) => {//This function is copy of 'reportLocationRegular'
        const alert = req.query.alert;
        const { emp_id, loc_date } = req.query;
        try {

            var fromDate = null;
            var toDate = null;
            if (loc_date === null || loc_date === undefined) {
                fromDate = moment().startOf('day').format('YYYY-MM-DD HH:mm');
                // toDate = moment().format('YYYY-MM-DD HH:mm');
                toDate = moment().endOf('day').format('YYYY-MM-DD HH:mm');
            } else {
                fromDate = moment(loc_date).startOf('day').format('YYYY-MM-DD HH:mm');
                toDate = moment(loc_date).format('YYYY-MM-DD HH:mm');
            }

            //Get current login user details
            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
                " FROM employees as a" +
                " Where a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const logUser = await executeQuery(sqlStr, params);
            // if (logUser.length === 0) {
            //     res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
            //     return;
            // }

            //Get emp list (boss and under emp)
            var sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A'"
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlStr1 = sqlStr1 + ` and (a.emp_id=${logUser[0].emp_id} or a.boss_id=${logUser[0].emp_id})`;
            }
            const empList = await executeQuery(sqlStr1);

            var empID = emp_id === null || emp_id === undefined || emp_id === '' ? 0 : emp_id;
            //Get emp details with boss details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [empID];
            const empData = await executeQuery(sqlStr2, params2);

            let sqlEmp = ""
            if (!["Admin", "Read", "Support", "Audit", "Account"].includes(res.locals.user.user_role)) {
                sqlEmp = ` and (b.emp_id=${logUser[0].emp_id} or b.boss_id=${logUser[0].emp_id})`;
            }

            let seleEmp = "";
            if (emp_id && emp_id !== null && emp_id !== undefined) {
                seleEmp = ` and a.emp_id=${emp_id}`;
            }
            // console.log('emp id...', emp_id, ' seleEmp... ', seleEmp)

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.first_name, ' ', b.last_name) as emp_name," +
                " a.loc_date,a.loc_lat,a.loc_lng,a.loc_name,a.loc_add,DATE_FORMAT(a.loc_date,'%H:%i') as loc_time," +
                " b.desg_id,c.desg_name,b.hq_id,d.hq_name,b.off_day," +
                " b.boss_id, CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name," +
                " CONCAT('/userData/A_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img1," +
                " CONCAT('/userData/B_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img2," +
                " CONCAT('/userData/X_',a.emp_id,'_',DATE_FORMAT(a.loc_date,'%Y-%m-%d %H.%i.%s'),'.jpeg') as img3" +
                " FROM dsr_loc as a, employees as b, designations as c, hqs as d, employees as e" +
                " WHERE a.emp_id=b.emp_id " + sqlEmp + seleEmp +
                " and a.loc_date Between ? and ? " +
                " and b.desg_id=c.desg_id and b.hq_id=d.hq_id and b.boss_id=e.emp_id "
            // console.log('sql', sqlStr3, fromDate, toDate)
            const params3 = [fromDate, toDate];
            const locData = await executeQuery(sqlStr3, params3);
            // console.log('Data', locData)

            res.render('dsr/dsr-report-loc-emp', { layout: 'mobile', locToDate: toDate, emp_list: empList, empData: empData[0], alert, locData }); // googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locations: JSON.stringify(locData) 

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }


    static reportArea = async (req, res) => {
        const { emp_id, from_date, to_date } = req.query;
        const alert = req.query.alert;

        try {
            // Date handling with proper defaults
            const defaultStart = moment().startOf('day');
            const defaultEnd = moment().endOf('day');

            let fromDate = from_date ?
                moment(from_date.includes('T') ? from_date : `${from_date}T00:00`) :
                defaultStart;

            let toDate = to_date ?
                moment(to_date.includes('T') ? to_date : `${to_date}T23:59`) :
                defaultEnd;

            // Validate dates
            if (!fromDate.isValid()) fromDate = defaultStart;
            if (!toDate.isValid()) toDate = defaultEnd;

            // Get all active employees
            const empList = await executeQuery(
                `SELECT emp_id, CONCAT(last_name,' ',first_name,' ',middle_name) as emp_name 
             FROM employees WHERE status='A'`
            );

            // First check the count of locations to prevent overloading
            let countSql = `
                SELECT COUNT(DISTINCT loc_name) as location_count
                FROM dsr_loc
                WHERE loc_date BETWEEN ? AND ?
                ${emp_id > 0 ? 'AND emp_id = ?' : ''}`;

            const countParams = [
                fromDate.format('YYYY-MM-DD HH:mm:ss'),
                toDate.format('YYYY-MM-DD HH:mm:ss')
            ];

            if (emp_id) countParams.push(emp_id);

            const countResult = await executeQuery(countSql, countParams);
            const locationCount = countResult[0]?.location_count || 0;

            // console.log('locationCount...', locationCount)

            // If too many locations, ask user to narrow date range
            if (locationCount > 5000) { //1999
                return res.render('dsr/dsr-report-area-2', {
                    layout: 'mobile',
                    fromDate: fromDate.format('YYYY-MM-DDTHH:mm'),
                    toDate: toDate.format('YYYY-MM-DDTHH:mm'),
                    emp_list: empList,
                    empData: { emp_id: emp_id || 0, emp_name: emp_id ? '' : 'All Employees' },
                    uniqueLocations: locationCount,
                    showMap: false,
                    alert: 'too-many-locations',
                    googleApiKey: process.env.GOOGLE_MAPS_API_KEY
                });
            }

            // Query to get distinct locations visited
            let locationSql = `
            SELECT 
                loc_name,
                loc_lat,
                loc_lng,
                loc_add
            FROM (
                SELECT 
                    loc_name,
                    loc_lat,
                    loc_lng,
                    loc_add,
                    ROW_NUMBER() OVER (PARTITION BY loc_name ORDER BY loc_date) as rn
                FROM dsr_loc
                WHERE loc_date BETWEEN ? AND ?
                ${emp_id > 0 ? 'AND emp_id = ?' : ''}
            ) t
            WHERE rn = 1
            ORDER BY loc_name`;

            const params = [
                fromDate.format('YYYY-MM-DD HH:mm:ss'),
                toDate.format('YYYY-MM-DD HH:mm:ss')
            ];

            if (emp_id) params.push(emp_id);

            const locData = await executeQuery(locationSql, params);

            // Get selected employee details or default to "All"
            const empID = emp_id || 0;
            const empData = empID ?
                await executeQuery(
                    `SELECT emp_id, CONCAT(last_name,' ',first_name,' ',middle_name) as emp_name 
                 FROM employees WHERE status='A' AND emp_id=?`,
                    [empID]
                ) :
                [{ emp_id: 0, emp_name: "All Employees" }];

            // Prepare data for map
            const locDataForMap = locData.map(loc => ({
                loc_lat: parseFloat(loc.loc_lat),
                loc_lng: parseFloat(loc.loc_lng),
                loc_name: loc.loc_name,
                // loc_add: loc.loc_add
            }));

            res.render('dsr/dsr-report-area-2', {
                layout: 'mobile',
                fromDate: fromDate.format('YYYY-MM-DDTHH:mm'),
                toDate: toDate.format('YYYY-MM-DDTHH:mm'),
                emp_list: empList,
                empData: empData[0],
                locations: JSON.stringify(locDataForMap),
                locationsArray: locDataForMap,
                uniqueLocations: locData.length,
                showMap: locData.length > 0,
                alert,
                googleApiKey: process.env.GOOGLE_MAPS_API_KEY
            });

        } catch (error) {
            console.error('Error in reportArea:', error);
            res.status(500).render('error', {
                message: 'Failed to generate report',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    };

};

export default dsrController