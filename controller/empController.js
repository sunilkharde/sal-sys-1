import { executeQuery } from '../db.js';

class EmployeeController {

    static getData = async () => {
        try {
            const desg_list = await executeQuery("SELECT * FROM designations Where status='A'");

            const hq_list = await executeQuery("SELECT * FROM hqs Where status='A'");

            const sqlStr = "Select a.emp_id as boss_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as boss_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day" +
                " FROM employees as a, designations as b, hqs as c" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.status='A' and a.desg_id IN (1,2,3,4,5)"
            const boss_list = await executeQuery(sqlStr)

            const bu_list = await executeQuery("SELECT bu_id, CONCAT(bu_code,' | ',bu_name) as bu_name FROM business_units Where status='A'")

            const users_list = await executeQuery("SELECT a.*, CONCAT(a.username, ' [', a.email_id,']') as map_user FROM users as a Where a.status='A' and a.user_role='Employee'");

            return [desg_list, hq_list, boss_list, bu_list, users_list];
        } catch (error) {
            console.error(error);
        }
    }

    static viewBlank = async (req, res) => {
        const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();
        res.render('emp/emp-create', { desg_list, hq_list, boss_list, bu_list, users_list });
    }

    static create = async (req, res) => {
        const { first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code } = req.body;
        const data = req.body
        const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();

        var errors = [];
        if (!first_name) {
            errors.push({ message: 'Employee first name is required' });
        }
        if (!last_name) {
            errors.push({ message: 'Employee last name is required' });
        }
        if (!desg_id) {
            errors.push({ message: "Select employee's designation" });
        }
        if (!hq_id) {
            errors.push({ message: "Select employee's headquarter" });
        }
        if (!boss_id) {
            errors.push({ message: "Select employee's boss" });
        }
        if (bu_id === undefined) {
            errors.push({ message: 'Select business unit' });
        }
        if (!user_id) {
            errors.push({ message: "Select login details for employee" });
        }

        const rows = await executeQuery('SELECT * FROM employees WHERE first_name=? and middle_name=? and last_name=?', [first_name, middle_name, last_name]);
        if (rows.length > 0) {
            errors.push({ message: 'Employee with this name is already exists' });
        }

        if (errors.length) {
            // const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
            //     " FROM employees as a Where a.emp_id=?"
            // const row1 = await executeQuery(sqlStr1, [boss_id]);
            // var mgName = ""
            // if (row1.length > 0) {
            //     mgName = row1[0].emp_name;
            // }
            // const updatedData = { ...data, boss_name: mgName};

            const updatedData = { ...data };
            //
            res.render('emp/emp-create', { errors, data: updatedData, desg_list, hq_list, boss_list, bu_list, users_list });
            return;
        }

        try {
            // Genrate max Employee id
            const rows1 = await executeQuery('SELECT Max(emp_id) AS maxNumber FROM employees');
            var nextEmployeeID = rows1[0].maxNumber + 1;

            // Insert new record into database
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO employees (emp_id, first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code, c_at, c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP(),?)"
            const paramsCust = [nextEmployeeID, first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status_new, user_id, vc_comp_code, vc_emp_code, ext_code, c_by];
            await executeQuery(sqlStr, paramsCust);

            res.redirect('/emp/view');

        } catch (err) {
            console.error(err);
            return res.render('emp/emp-view', { alert: `Internal server error` });
        }
    };

    static viewAll = async (req, res) => {
        const alert = req.query.alert;
        try {
            const sqlStr = "Select a.*, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " b.desg_name, c.hq_name, d.bu_code, d.bu_name," +
                " CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name" +
                " FROM employees as a " +
                " LEFT JOIN designations as b ON (a.desg_id=b.desg_id) " +
                " LEFT JOIN hqs as c ON (a.hq_id=c.hq_id) " +
                " LEFT JOIN business_units as d ON (a.bu_id=d.bu_id) " +
                " LEFT JOIN employees as e ON (a.boss_id=e.emp_id) "
            const results = await executeQuery(sqlStr);

            res.render('emp/emp-view', { employees: results, alert });

        } catch (error) {
            console.error(error);
        }
    }

    static edit = async (req, res) => {
        const { emp_id } = req.params;
        const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();

        try {
            const sqlStr = "Select a.*, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " b.desg_name, c.hq_name, d.bu_code, d.bu_name," +
                " CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name," +
                " CONCAT(f.username,' : ',f.email_id) as username" +
                " FROM employees as a " +
                " LEFT JOIN designations as b ON (a.desg_id=b.desg_id) " +
                " LEFT JOIN hqs as c ON (a.hq_id=c.hq_id) " +
                " LEFT JOIN business_units as d ON (a.bu_id=d.bu_id) " +
                " LEFT JOIN employees as e ON (a.boss_id=e.emp_id) " +
                " LEFT JOIN users as f ON (a.user_id=f.user_id) " +
                " Where a.emp_id=?"
            const params = [emp_id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0]

            res.render('emp/emp-edit', { data: data1, desg_list, hq_list, boss_list, bu_list, users_list });
        } catch (error) {
            console.error(error);
        }
    }

    static update = async (req, res) => {
        const { emp_id } = req.params;
        const { first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code } = req.body;
        const data = req.body
        const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();

        var errors = [];
        if (!first_name) {
            errors.push({ message: 'Employee first name is required' });
        }
        if (!last_name) {
            errors.push({ message: 'Employee last name is required' });
        }
        if (!desg_id) {
            errors.push({ message: "Select employee's designation" });
        }
        if (!hq_id) {
            errors.push({ message: "Select employee's headquarter" });
        }
        if (!boss_id) {
            errors.push({ message: "Select employee's boss" });
        }
        if (bu_id === undefined) {
            errors.push({ message: 'Select business unit' });
        }
        if (!user_id) {
            errors.push({ message: "Select login details for employee" });
        }

        const rows = await executeQuery('SELECT * FROM employees WHERE first_name=? and middle_name=? and last_name=? and emp_id<>?', [first_name, middle_name, last_name, emp_id]);
        if (rows.length > 0) {
            errors.push({ message: 'Employee with this name is already exists' });
        }

        if (errors.length) {
            // const sqlStr1 = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name" +
            //     " FROM employees as a Where a.emp_id=?"
            // const row1 = await executeQuery(sqlStr1, [boss_id]);
            // var mgName = ""
            // if (row1.length > 0) {
            //     mgName = row1[0].emp_name;
            // }
            // const updatedData = { ...data, boss_name: mgName};

            const updatedData = { ...data };

            res.render('emp/emp-edit', { errors, data: updatedData, desg_list, hq_list, boss_list, bu_list, users_list });
            return;
        }

        try {
            // Update record into database using emp_id
            //var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE employees Set first_name=?,middle_name=?,last_name=?,desg_id=?,hq_id=?,boss_id=?,bu_id=?,off_day=?,status=?,user_id=?,vc_comp_code=?,vc_emp_code=?,ext_code=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE emp_id=?"
            const params = [first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code, u_by, emp_id];
            await executeQuery(sqlStr, params);

            res.redirect('/emp/view');

        } catch (err) {
            console.error(err);
            return res.render('emp/emp-view', { alert: `Internal server error` });
        }
    };

    static delete = async (req, res) => {
        const { emp_id } = req.params;
        try {
            var errors = [];
            const sqlStr3 = "Select * from employees Where emp_id=?"
            const params3 = [emp_id];
            const rows = await executeQuery(sqlStr3, params3);
            if (rows.length > 0) {
                errors.push({ message: "Reference exist, master entry can't delete" });
            }
            //            
            if (errors.length) {
                res.redirect(`/emp/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }
            //
            const sqlStr = "Delete from employees WHERE emp_id=?"
            const params = [emp_id];
            await executeQuery(sqlStr, params);
            //
            res.redirect('/emp/view?alert=Employee+deleted+successfully');
        } catch (err) {
            console.error(err);
            return res.render('emp/emp-view', { alert: `Internal server error` });
        }
    }
};

export default EmployeeController