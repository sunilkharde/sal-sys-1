// controller/dsrTpController.js

import { executeQuery } from '../db.js';
import moment from 'moment';

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


class dsrTpController {

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


    /***** TP Routes Start */
    static viewPM = async (req, res) => {
        try {
            const { next_month } = req.query; // Flag to indicate next month view

            const sqlStr = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open.</h1>");
                return;
            }

            // Adjust month for next month planning
            let displayMonData = { ...monData[0] };
            let isNextMonth = false;

            if (next_month === 'true') {
                const from_date = moment(monData[0].month_date).add(1, 'month');
                displayMonData = {
                    ...monData[0],
                    month_date: from_date.toDate(),
                    month_name: from_date.format('MMMM'),
                    month: from_date.format('M'),
                    year: from_date.format('YYYY')
                };
                isNextMonth = true;
            }

            const from_date = moment(displayMonData.month_date);
            const to_date = from_date.clone().endOf('month');

            // Get login user details
            const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const mgData = await executeQuery(sqlStr1, params);
            let mgID = 0;
            if (mgData.length > 0) {
                mgID = mgData[0].emp_id;
            }

            // Get manager team list
            var sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name, IFNULL(COUNT(e.tp_route), 0) as tp_count" +
                " FROM employees as a LEFT JOIN designations as b ON (a.desg_id=b.desg_id)" +
                " LEFT JOIN hqs as c ON (a.hq_id=c.hq_id)" +
                " LEFT JOIN employees as d ON (a.boss_id=d.emp_id)" +
                " LEFT JOIN dsr_1 as e ON (a.emp_id=e.emp_id and e.dsr_date Between ? and ?)" +
                " Where a.status='A'"
            const sqlGroupBy = " Group By a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name)," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day,a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name)"
            if (!["Admin", "Read", "Support"].includes(res.locals.user.user_role)) {
                sqlStr2 = sqlStr2 + ` and (a.boss_id=${mgID})`;
            }

            const params2 = [from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD')];
            const empList = await executeQuery(sqlStr2 + sqlGroupBy, params2);

            res.render('dsrTp/dsrTp-view-pm', {
                layout: 'mobile',
                monData: displayMonData,
                mgData: mgData[0],
                empList,
                teamSize: empList.length,
                isNextMonth
            });

        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }

    // Cache for frequently accessed data
    static cache = new Map();

    static CACHE_TTL = 300000; // 5 minutes

    static getCacheKey(prefix, params = '') {
        return `${prefix}_${JSON.stringify(params)}`;
    }

    static async getCachedData(key, fetchFunction) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }

        const data = await fetchFunction();
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
    }

    static clearCache() {
        this.cache.clear();
    };

    static async createEmptyRecords(emp_id, from_date, to_date, user) {
        const numDays = to_date.diff(from_date, 'days');
        const c_by = user?.user_id || 0;

        const insertValues = [];
        const currentDate = from_date.clone();

        for (let i = 0; i <= numDays; i++) {
            insertValues.push([emp_id, currentDate.format('YYYY-MM-DD'), c_by]);
            currentDate.add(1, 'day');
        }

        if (insertValues.length > 0) {
            const placeholders = insertValues.map(() => '(?, ?, CURRENT_TIMESTAMP(), ?)').join(',');
            const bulkInsertSql = `INSERT INTO dsr_1 (emp_id, dsr_date, c_at, c_by) VALUES ${placeholders}`;
            const flattenedValues = insertValues.flat();
            await executeQuery(bulkInsertSql, flattenedValues);
        }

    };

    static calculateRouteStats(tpData) {
        const total = tpData.length;
        const filled = tpData.filter(route => route.tp_id && route.tp_name).length;
        const empty = total - filled;
        const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

        return { total, filled, empty, percentage };
    };

    static edit = async (req, res) => {
        const { emp_id, year, month } = req.params;
        const { next_month } = req.query;

        try {
            // Validate parameters
            if (!emp_id || !year || !month) {
                return res.status(400).send('Missing required parameters');
            }

            const paddedMonth = month.toString().padStart(2, '0');
            const month_date = moment(`${year}-${paddedMonth}-01`).format('YYYY-MM-DD');
            const month_name = moment(month_date).format('MMMM');

            const monData = {
                year: parseInt(year),
                month: parseInt(month),
                month_name,
                month_date
            };

            const from_date = moment(monData.month_date);
            const to_date = from_date.clone().endOf('month');
            const isNextMonth = next_month === 'true';

            // Execute all database queries in parallel
            const [
                countResult,
                empData,
                districts,
                tpData
            ] = await Promise.all([
                // Check existing records
                executeQuery(
                    "SELECT COUNT(*) as count FROM dsr_1 WHERE emp_id=? AND dsr_date BETWEEN ? AND ?",
                    [emp_id, from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD')]
                ),
                // Get employee details
                executeQuery(
                    `SELECT 
                        a.emp_id, 
                        CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name,
                        a.desg_id, b.desg_name, a.hq_id, c.hq_name, a.off_day,
                        a.boss_id, 
                        CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name
                    FROM employees as a 
                    JOIN designations as b ON a.desg_id=b.desg_id 
                    JOIN hqs as c ON a.hq_id=c.hq_id 
                    JOIN employees as d ON a.boss_id=d.emp_id 
                    WHERE a.status='A' AND a.emp_id=?`,
                    [emp_id]
                ),
                // Get districts from cache
                this.getCachedData(
                    this.getCacheKey('districts'),
                    () => executeQuery("SELECT DISTINCT dist FROM tp_routes WHERE tp_status = 'A' ORDER BY dist")
                ),
                // Get TP data
                executeQuery(
                    `SELECT 
                        a.emp_id, a.dsr_date, a.post_mg, a.tp_1 as tp_id,
                        COALESCE(d.from, IF(a.tp_route IS NULL, c.hq_name, a.from_city)) AS from_city,
                        COALESCE(d.to, a.to_city) AS to_city,
                        DATE_FORMAT(a.dsr_date, '%a') AS tp_day,
                        DATE_FORMAT(a.dsr_date, '%d') AS tp_date,
                        b.off_day, c.hq_name,
                        CONCAT(COALESCE(d.from, ''), ' To ', COALESCE(d.to, '')) as tp_name
                    FROM dsr_1 AS a 
                    JOIN employees AS b ON a.emp_id = b.emp_id 
                    JOIN hqs AS c ON b.hq_id = c.hq_id 
                    LEFT JOIN tp_routes AS d ON a.tp_1 = d.tp_id 
                    WHERE a.dsr_date BETWEEN ? AND ? AND a.emp_id = ? 
                    ORDER BY a.dsr_date`,
                    [from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD'), emp_id]
                )
            ]);

            // Validate data
            if (empData.length === 0) {
                return res.status(404).send('Employee not found');
            }

            // Create records only if they don't exist (for next month planning)
            if (countResult[0].count === 0 && isNextMonth) {
                await this.createEmptyRecords(emp_id, from_date, to_date, res.locals.user);
            }

            // Calculate route statistics
            const routeStats = this.calculateRouteStats(tpData);

            res.render('dsrTp/dsrTp-edit', {
                layout: 'mobile',
                monData,
                empData: empData[0],
                tpData,
                districts,
                isNextMonth,
                routeStats
            });

        } catch (error) {
            console.error('Error in edit:', error);
            res.status(500).send('Internal Server Error');
        }
    };

    static update = async (req, res) => {
        const { emp_id, year, month } = req.params;
        const { next_month } = req.query;
        const { dsr_date, from_city, to_city, tp_id } = req.body;

        try {
            const u_by = res.locals.user?.user_id || 0;

            // Convert to arrays if single values
            const dsr_date_val = Array.isArray(dsr_date) ? dsr_date : [dsr_date];
            const from_city_val = Array.isArray(from_city) ? from_city : [from_city];
            const to_city_val = Array.isArray(to_city) ? to_city : [to_city];
            const tp_id_val = Array.isArray(tp_id) ? tp_id : [tp_id];

            // Process updates in batches for better performance
            const updatePromises = dsr_date_val.map((date, index) => {
                const from_city_title = from_city_val[index] ? titleCase(from_city_val[index]) : null;
                const to_city_title = to_city_val[index] ? titleCase(to_city_val[index]) : null;

                return executeQuery(
                    "UPDATE dsr_1 SET tp_route=?, from_city=?, to_city=?, tp_1=?, tp_2=?, u_at=CURRENT_TIMESTAMP, u_by=? WHERE dsr_date=? AND emp_id=?",
                    [to_city_title, from_city_title, to_city_title, tp_id_val[index], tp_id_val[index], u_by, date, emp_id]
                );
            });

            await Promise.all(updatePromises);

            // Clear cache to ensure fresh data
            this.clearCache();

            const redirectPath = next_month === 'true'
                ? '/dsrTp/view-pm?next_month=true&alert=Update+Records+successfully'
                : '/dsrTp/view-pm?alert=Update+Records+successfully';

            res.redirect(redirectPath);

        } catch (err) {
            console.error('Error in update:', err);
            res.status(500).send('Internal Server Error');
        }
    };

    static getDistinctDistricts = async (req, res) => {
        try {
            const districts = await this.getCachedData(
                this.getCacheKey('districts'),
                () => executeQuery("SELECT DISTINCT dist FROM tp_routes WHERE tp_status = 'A' ORDER BY dist")
            );

            res.set('Cache-Control', 'public, max-age=300');
            res.json({ success: true, districts });
        } catch (error) {
            console.error('Error fetching districts:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch districts' });
        }
    };

    static getDistinctCities = async (req, res) => {
        try {
            const { dist } = req.query;
            const cacheKey = this.getCacheKey('cities', dist);

            const cities = await this.getCachedData(cacheKey, async () => {
                let sql = `SELECT DISTINCT city FROM tp_routes WHERE tp_status = 'A'`;
                const params = [];

                if (dist) {
                    sql += ` AND dist = ?`;
                    params.push(dist);
                }

                sql += ` ORDER BY city`;
                return await executeQuery(sql, params);
            });

            res.set('Cache-Control', 'public, max-age=300');
            res.json({ success: true, cities });
        } catch (error) {
            console.error('Error fetching cities:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch cities' });
        }
    };

    static getAllRoutes = async (req, res) => {
        try {
            const routes = await this.getCachedData(
                this.getCacheKey('all_routes'),
                () => executeQuery(`
                    SELECT tp_id, \`from\`, \`to\`, 
                           CONCAT(\`from\`, ' To ', \`to\`) as tp_name, 
                           dist, city 
                    FROM tp_routes 
                    WHERE tp_status = 'A'
                    ORDER BY \`from\`, \`to\`
                `)
            );

            res.set('Cache-Control', 'public, max-age=300');
            res.json({ success: true, routes });
        } catch (error) {
            console.error('Error fetching all routes:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch routes' });
        }
    };

    static copyPreviousMonth = async (req, res) => {
        try {
            const { year, month, emp_id, next_month } = req.body;

            if (!year || !month || !emp_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameters'
                });
            }

            // Calculate previous month
            const currentMonth = moment(`${year}-${month.padStart(2, '0')}-01`);
            const prevMonth = currentMonth.clone().subtract(1, 'month');

            const prevYear = prevMonth.year();
            const prevMonthNum = prevMonth.month() + 1; // moment months are 0-indexed

            // Get previous month's TP data
            const fromDate = prevMonth.clone().startOf('month');
            const toDate = prevMonth.clone().endOf('month');

            const sqlStr = `
            SELECT dsr_date, tp_1, tp_2, tp_route, from_city, to_city 
            FROM dsr_1 
            WHERE emp_id = ? 
            AND dsr_date BETWEEN ? AND ?
            AND (tp_1 IS NOT NULL OR tp_route IS NOT NULL)
        `;

            const prevMonthData = await executeQuery(sqlStr, [
                emp_id,
                fromDate.format('YYYY-MM-DD'),
                toDate.format('YYYY-MM-DD')
            ]);

            if (prevMonthData.length === 0) {
                return res.json({
                    success: false,
                    message: 'No tour plan found for previous month'
                });
            }

            // Get current month date range
            const currentFromDate = currentMonth.clone().startOf('month');
            const currentToDate = currentMonth.clone().endOf('month');

            // Check if records exist for current month
            const checkSql = `
            SELECT COUNT(*) as count 
            FROM dsr_1 
            WHERE emp_id = ? 
            AND dsr_date BETWEEN ? AND ?
        `;

            const countResult = await executeQuery(checkSql, [
                emp_id,
                currentFromDate.format('YYYY-MM-DD'),
                currentToDate.format('YYYY-MM-DD')
            ]);

            // Create records if they don't exist
            if (countResult[0].count === 0) {
                await this.createEmptyRecords(emp_id, currentFromDate, currentToDate, res.locals.user);
            }

            // Copy TP data
            const u_by = res.locals.user?.user_id || 0;
            let updatedCount = 0;

            for (const record of prevMonthData) {
                const currentDate = currentMonth.clone().date(moment(record.dsr_date).date());

                // Only update if the date exists in current month
                if (currentDate.month() === currentMonth.month()) {
                    const updateSql = `
                    UPDATE dsr_1 
                    SET tp_1 = ?, tp_2 = ?, tp_route = ?, from_city = ?, to_city = ?,
                        u_at = CURRENT_TIMESTAMP, u_by = ?
                    WHERE emp_id = ? AND dsr_date = ?
                `;

                    await executeQuery(updateSql, [
                        record.tp_1,
                        record.tp_2,
                        record.tp_route,
                        record.from_city,
                        record.to_city,
                        u_by,
                        emp_id,
                        currentDate.format('YYYY-MM-DD')
                    ]);

                    updatedCount++;
                }
            }

            // Clear cache
            this.clearCache();

            res.json({
                success: true,
                message: `Successfully copied ${updatedCount} tour plan entries from previous month`,
                count: updatedCount
            });

        } catch (error) {
            console.error('Error in copyPreviousMonth:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while copying tour plan'
            });
        }
    };
    /***** TP Routes End */


    static getFixRoutes = async (req, res) => {
        const { dist, city } = req.query;
        try {
            // console.log('Fetching TP routes for:', dist, city);
            const sqlStr1 = `SELECT a.tp_id, CONCAT(a.from,' --to-- ', a.to) as tp_name
                FROM tp_routes as a WHERE a.dist=? AND a.city=?`
            // Union Select '' as tp_id, '(Select)' as tp_name from dual`
            const params = [dist, city];
            const tp_list = await executeQuery(sqlStr1, params);
            // console.log('TP routes fetched:', tp_list);
            res.json(tp_list);
        } catch (error) {
            console.error('Error fetching TP routes:', error);
            res.status(500).json({ error: 'An error occurred while fetching TP routes' });
        }
    }

    static getTP = async (req, res) => {
        const { emp_id, year, month } = req.params;
        try {
            const sqlStr0 = "Select year, month, DATE_FORMAT(STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y'),'%M') as month_name," +
                " STR_TO_DATE(CONCAT('1/',month,'/',year),'%d/%m/%Y') as month_date" +
                " FROM month_open Where status='O'"
            const monData = await executeQuery(sqlStr0);
            if (monData.length === 0) {
                res.status(404).send("<h1>Month is not open</h1>");
                return;
            }

            const sqlStr1 = "Select * From dsr_0 Where emp_id=? and year=? and month=? and post_mg='Y'"
            const params1 = [emp_id, year, month];
            const dsrMonData = await executeQuery(sqlStr1, params1);
            if (dsrMonData.length > 0) {
                res.status(404).send("<h1>Month is posted; Can't change</h1>");
                return;
            }

            const from_date = moment(monData[0].month_date);
            const to_date = from_date.clone().endOf('month');
            const from_date_lm = moment(from_date).subtract(1, 'months');
            const to_date_lm = from_date_lm.clone().endOf('month');

            //Get employee details
            const sqlStr2 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.emp_id=?"
            const params2 = [emp_id];
            const empData = await executeQuery(sqlStr2, params2);

            const sqlTp = "Select a.emp_id, a.dsr_date, a.post_mg, d.from_city, d.to_city," +
                " DATE_FORMAT(a.dsr_date,'%a') as tp_day, DATE_FORMAT(a.dsr_date,'%d') as tp_date," +
                " b.off_day, c.hq_name, d.tp_1 as tp_id, CONCAT(e.from, ' To ', e.to) as tp_name " +
                " FROM dsr_1 as a LEFT JOIN employees as b ON (a.emp_id=b.emp_id)" +
                " LEFT JOIN hqs as c ON (b.hq_id=c.hq_id)" +
                " LEFT JOIN dsr_1 as d ON (a.emp_id=d.emp_id and d.dsr_date Between ? and ?" +
                " and DATE_FORMAT(a.dsr_date,'%d')=DATE_FORMAT(d.dsr_date,'%d'))" +
                " LEFT JOIN tp_routes AS e ON d.tp_1 = e.tp_id " +
                " Where a.dsr_date Between ? and ? and a.emp_id=?" +
                " Order By a.dsr_date";
            const paramsTp = [from_date_lm.format('YYYY-MM-DD'), to_date_lm.format('YYYY-MM-DD'),
            from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD'), emp_id];
            const tpData = await executeQuery(sqlTp, paramsTp);

            res.render('dsrTp/dsrTp-edit', { layout: 'mobile', monData: monData[0], empData: empData[0], tpData });

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

            let sqlStr3 = "SELECT a.emp_id,CONCAT(b.last_name,' ',b.first_name,' ',b.middle_name) as emp_name," +
                " a.dsr_date,b.vc_comp_code,b.vc_emp_code,a.atten_flag,a.hr_flag,a.post_mg" +
                " FROM dsr_1 as a, employees as b WHERE a.emp_id=b.emp_id and a.dsr_date Between ? and ?"
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

            let sqlStr3 = "SELECT DATE_FORMAT(a.dsr_date,'%d/%M/%Y') as dsr_date,a.emp_id,CONCAT(b.last_name,' ',b.first_name,' ',b.middle_name) as emp_name," +
                " CONCAT(\"'\", b.vc_comp_code) as vc_comp_code,b.vc_emp_code,a.atten_flag,a.hr_flag,a.post_mg" +
                " FROM dsr_1 as a, employees as b WHERE a.emp_id=b.emp_id and a.dsr_date Between ? and ?"
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

};

export default dsrTpController