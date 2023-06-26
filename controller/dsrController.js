//import { json } from 'express';
import { executeQuery } from '../db.js';
import moment from 'moment';

class poController {

    static getData = async (req, user) => {
        try {
            // var user_role = user.user_role !== null && user.user_role !== undefined ? user.user_role : 'User';
            const sqlStr = "SELECT atten_flag,atten_desc,hr_flag FROM atten_flags Where status='A'"
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
            const allowPricelist = await executeQuery(sqlStr, [desg_id, atten_flag]);

            res.json({ allowDA: allowPricelist[0] });

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

            // console.log('User............. ' + res.locals.user.user_id)
            // console.log('Emp ID............. ' + results.length + '   ' + results2[0].month_date )

            const sqlStr3 = "Select * From dsr_1 Where emp_id=? and dsr_date=?"
            const params3 = [results[0].emp_id, results2[0].month_date];
            const results3 = await executeQuery(sqlStr3, params3);
            if (results3.length === 0) {
                const from_date = moment(results2[0].month_date);
                const to_date = from_date.clone().endOf('month');

                // console.log('From Date ' + from_date.format('YYYY-MM-DD'));
                // console.log('To Date ' + to_date.format('YYYY-MM-DD'));

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

            res.render('dsr/dsr-view-pm', { layout: 'mobile', data: results[0], data2: results2[0] });

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
            const from_date = moment(results3[0].month_date);
            const to_date = moment();

            // console.log('From Date ' + from_date.format('YYYY-MM-DD'));
            // console.log('To Date ' + to_date.format('YYYY-MM-DD'));

            const sqlStr = "Select a.emp_id,a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day" +
                " FROM employees as a, designations as b, hqs as c" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.status='A' and a.user_id=?"
            const params = [res.locals.user.user_id];
            const results = await executeQuery(sqlStr, params);

            const sqlStr2 = "Select * From dsr_1 Where dsr_date Between ? and ? and emp_id=?"
            // const sqlStr2 = `Select * From dsr_1 Where dsr_date Between '${from_date.format('YYYY-MM-DD')}' and '${to_date.format('YYYY-MM-DD')}' and emp_id='${results[0].emp_id}'`
            const params2 = [from_date.format('YYYY-MM-DD'), to_date.format('YYYY-MM-DD'), results[0].emp_id];
            const results2 = await executeQuery(sqlStr2, params2);

            // const maxLDate = moment();
            // const minLDate = moment(maxLDate).add(-2, 'days');

            res.render('dsr/dsr-view', { layout: 'mobile', data: results2, data2: results[0] });

        } catch (error) {
            console.error(error);
            // Handle the error
        } finally {
            //conn.release();
        }
    }

    static edit = async (req, res) => {
        const { dsr_date, emp_id } = req.params;
        try {
            const [atten_flag_list] = await this.getData(req, res.locals.user);

            const sqlStr = "Select a.emp_id,a.dsr_date,a.atten_flag,a.hr_flag,a.from_city,a.to_city,a.stay_city,a.total_allow,a.total_exp,a.post_mg,a.post_ac" +
                " FROM dsr_1 as a" +
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

            res.render('dsr/dsr-edit', { layout: 'mobile', data: results[0], data2: results2, data3: results3[0], atten_flag_list, allow_list });

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
            if (results1[0].atten_flag) {
                leave_flag = 'P';
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

    static saveLeaveData_old = async (req, res) => {
        try {
            const { dsr_date, emp_id } = req.query;

            const sqlStr = "Update dsr_1 Set hr_flag='L'" +
                " WHERE dsr_date=? and emp_id=?";
            await executeQuery(sqlStr, [dsr_date.format('YYYY-MM-DD'), emp_id]);
            res.status(200).send('Leave data saved successfully');

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static update = async (req, res) => {
        const { dsr_date, emp_id } = req.params;
        const { atten_flag, from_city, to_city, stay_city, total_allow, total_exp, sr_no, allow_id, amount, from_km, to_km, type, km_rate } = req.body;
        const data = req.body
        const [atten_flag_list] = await this.getData(req, res.locals.user);

        const sqlStr4 = "SELECT a.allow_id,a.allow_name FROM allowances as a" +
            " Where a.status='A' and a.allow_group='B'" +
            " and a.allow_id In (Select DISTINCT b.allow_id From allow_pricelist as b Where b.desg_id=?)"
        const allow_list = await executeQuery(sqlStr4, [data.desg_id]);

        var errors = [];
        if (!atten_flag || atten_flag === 'XX') {
            errors.push({ message: 'Attendance (Status) flag is required' });
        }
        if (!from_city) {
            errors.push({ message: 'Select from city' });
        }
        if (!to_city) {
            errors.push({ message: 'Select to city' });
        }

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
            const allow_id_val = Array.isArray(allow_id) ? allow_id : [allow_id];
            const type_val = Array.isArray(type) ? type : [type];
            for (let i = 0; i < allow_id.length; i++) {
                const sqlStr = "Select a.allow_id,b.allow_name,a.desg_id,a.atten_flag,a.type,a.km_rate" +
                    " FROM allow_pricelist as a, allowances as b" +
                    " Where a.allow_id=b.allow_id and a.allow_id=? and a.desg_id=? and a.atten_flag IN ('XX',?) and a.type=?";
                let params = [allow_id_val[i], data.desg_id, atten_flag, type_val[i]];
                let results = await executeQuery(sqlStr, params);
                if (results.length === 0) {
                    errors.push({ message: `Status (Atten Flag: '${atten_flag}') with row no ${i + 1} is not allowed.` });
                }
            }
        }

        if (errors.length) {
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

            res.render('dsr/dsr-edit', { layout: 'mobile', errors, data, data2: results2, data3: results3[0], atten_flag_list, allow_list });
            return;
        }

        try {
            //sr_no, allow_id, allow_name, amount, from_km, to_km
            const hr_flag = 'P';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE dsr_1 Set atten_flag=?,hr_flag=?,from_city=?,to_city=?,stay_city=?,total_allow=?,total_exp=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE dsr_date=? and emp_id=?"
            const params = [atten_flag, hr_flag, from_city, to_city, stay_city, total_allow, total_exp, u_by, dsr_date, emp_id];
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
                let sr_no_val = (i + 1) * 10;
                const sqlStr2 = "INSERT INTO dsr_2 (dsr_date, emp_id, sr_no, allow_id, amount, from_km, to_km)" +
                    " VALUES (?,?,?,?,?,?,?)"
                const paramsDt = [dsr_date, emp_id, sr_no_val, allow_id_val[i], amount_val[i], from_km_val[i], to_km_val[i]];
                await executeQuery(sqlStr2, paramsDt);
            }

            // res.redirect('/dsr/view?alert=Update+Records+successfully');
            res.redirect('/dsr/view');

        } catch (err) {
            console.error(err);
            return res.render('dsr/dsr-view', { alert: `Internal server error` });
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

export default poController