import { executeQuery } from '../db.js';
import moment from 'moment';
import jwt from 'jsonwebtoken';

// import multer from 'multer';
// import xlsx from 'xlsx';

// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

const TOKEN_KEY = '6rtfrg4rfkljfd54djhg6ecFcjikljds5rqtJfe4';


// const titleCase = (str) => {
//     return str
//         .toLowerCase()
//         .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
//         .trim() // Trim leading and trailing spaces
//         .split(' ')
//         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//         .join(' ');
// };

class apiController {

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

    static customerSpMapping = async (req, res) => {
        try {
            // const { allow_id, desg_id, atten_flag } = req.query;

            const sqlStr = "Select a.customer_id,a.customer_name,a.nick_name,a.add1,a.add2,a.add3,a.city,a.pin_code,a.district,a.state," +
                " a.user_id,a.ext_code,a.geo_location,a.customer_type,a.status,a.market_area_id,b.market_area," +
                " a.mg_id,CONCAT(c.first_name,' ',c.middle_name,' ',c.last_name) as manager_name," +
                " a.se_id,CONCAT(d.first_name,' ',d.middle_name,' ',d.last_name) as se_name,a.godown_area,a.total_counters,a.gst_no,a.cust_care_no" +
                " From customers as a LEFT JOIN market_area as b ON (a.market_area_id=b.market_area_id)" +
                " LEFT JOIN employees as c ON (c.emp_id=a.mg_id)" +
                " LEFT JOIN employees as d ON (d.emp_id=a.se_id)"

            const customerSpList = await executeQuery(sqlStr);

            res.status(200).json({ customerSpList, message: 'Customer with Salesperson mapping list' });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static employeeAttendance = async (req, res) => {
        try {
            const { attenMonth } = req.params;

            var fromDate = null;
            var toDate = null;
            if (attenMonth === null || attenMonth === undefined) {
                fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
                // empID = 0;
            } else {
                fromDate = moment(attenMonth + '-01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            const sqlStr = "SELECT DATE_FORMAT(a.dsr_date,'%d/%M/%Y') as `Att Date`,a.emp_id as `EmpID`, CONCAT(b.last_name, ' ', b.first_name, ' ', b.middle_name) AS `Emp Name`," +
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

            const params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')];
            const empAtten = await executeQuery(sqlStr, params);

            res.status(200).json({ empAtten });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static employeeRouteAndExp = async (req, res) => {
        try {
            const { attenMonth } = req.params;

            var fromDate = null;
            var toDate = null;
            if (attenMonth === null || attenMonth === undefined) {
                fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
                // empID = 0;
            } else {
                fromDate = moment(attenMonth + '-01', 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            let sqlStr = "SELECT a.emp_id,CONCAT(b.first_name,' ',b.middle_name,' ',b.last_name) as emp_name," +
                " DATE_FORMAT(a.dsr_date,'%d/%m/%Y') as dsr_date,IFNULL(a.atten_flag,'') as atten_flag,a.hr_flag," +
                " IFNULL(a.from_city,'') as plan_city,IFNULL(a.from_city,'') as from_city,IFNULL(a.to_city,'') as to_city,IFNULL(a.stay_city,'') as stay_city," +
                " a.total_allow as da_amt,a.total_lodge as lodge_amt,a.total_exp as fare_amt,a.post_mg" +
                " FROM dsr_1 as a, employees as b " +
                " WHERE a.emp_id=b.emp_id and a.dsr_date Between ? and ? " +
                " Order By a.emp_id,a.dsr_date"
            const params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')];
            const dsrData = await executeQuery(sqlStr, params);

            res.status(200).json({ dsrData });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }


    static verifyApiToken = (req, res, next) => {
        const token = req.headers['authorization'];
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }
        try {
            //   const decoded = verify(token, process.env.JWT_SECRET);
            // const decoded = verify(token, TOKEN_KEY);
            // req.user = decoded;
            if (token !== TOKEN_KEY) {
                return res.status(400).json({ message: 'Invalid token.' });
            }
            next();
        } catch (error) {
            res.status(400).json({ message: 'Invalid token.' });
        }
    };

    static employeeLocation = async (req, res) => {
        try {

            // const { attenMonth } = req.params;
            // var fromDate = null;
            // var toDate = null;
            // if (attenMonth === null || attenMonth === undefined) {
            //     fromDate = moment('2000-01-01').startOf('month'); //moment().startOf('month');
            //     toDate = fromDate.clone().endOf('month');
            //     // empID = 0;
            // } else {
            //     fromDate = moment(attenMonth + '-01', 'YYYY-MM-DD');
            //     toDate = fromDate.clone().endOf('month');
            // }

            let { fromDate, toDate } = req.query;
            let validatedFromDate = moment(fromDate, 'YYYY-MM-DD', true);
            let validatedToDate = moment(fromDate, 'YYYY-MM-DD', true);
            if (!validatedFromDate.isValid() || !validatedToDate.isValid()) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = moment(fromDate, 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            let sqlStr = "SELECT a.emp_id,CONCAT(b.first_name,' ',b.middle_name,' ',b.last_name) as emp_name," +
                " DATE_FORMAT(a.loc_date,'%d/%m/%Y %H:%i:%s') as loc_date,a.loc_lat,a.loc_lng,a.loc_name,a.loc_add," +
                " b.ext_code, CONCAT(c.first_name,' ',c.middle_name,' ',c.last_name) as boss_name" +
                " FROM dsr_loc as a, employees as b, employees as c" +
                " WHERE a.emp_id=b.emp_id and a.loc_date Between ? and ? " +
                " and b.boss_id=c.emp_id" +
                " Order By a.emp_id,a.loc_date"
            const params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')];
            const dsrData = await executeQuery(sqlStr, params);
            // ", customers as d, customers as e and b.mg_id=d.emp_id and b.se_id=e.emp_id" +
            res.status(200).json({ dsrData });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static employeeRoute = async (req, res) => {
        try {

            let { fromDate, toDate } = req.query;
            let validatedFromDate = moment(fromDate, 'YYYY-MM-DD', true);
            let validatedToDate = moment(fromDate, 'YYYY-MM-DD', true);
            if (!validatedFromDate.isValid() || !validatedToDate.isValid()) {
                fromDate = moment().startOf('month');
                toDate = fromDate.clone().endOf('month');
            } else {
                fromDate = moment(fromDate, 'YYYY-MM-DD');
                toDate = fromDate.clone().endOf('month');
            }

            let sqlStr = "SELECT a.emp_id, CONCAT(b.first_name,' ',b.middle_name,' ',b.last_name) as emp_name," +
                " dsr_date, atten_flag , hr_flag, tp_route, from_city, to_city, stay_city, total_allow, total_lodge, total_exp, post_mg, post_ac" +
                " FROM dsr_1 as a, employees as b" +
                " WHERE a.emp_id=b.emp_id and a.dsr_date Between ? and ? " +
                " Order By a.emp_id, a.dsr_date"
            const params = [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')];
            const tpData = await executeQuery(sqlStr, params);
            // ", customers as d, customers as e and b.mg_id=d.emp_id and b.se_id=e.emp_id" +
            res.status(200).json({ tpData });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

};

export default apiController