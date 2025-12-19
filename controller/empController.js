import { executeQuery } from '../db.js';
import moment from 'moment';


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
        try {
            const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();

            // Create empty data object for create form
            const emptyData = {
                first_name: '',
                middle_name: '',
                last_name: '',
                desg_id: '',
                hq_id: '',
                hq_name: '',
                boss_id: '',
                boss_name: '',
                bu_id: '',
                off_day: 'Sun',
                status: 'A',
                user_id: '',
                username: '',
                vc_comp_code: '',
                vc_emp_code: '',
                ext_code: '',
                card_no: ''
            };

            res.render('emp/emp-form', {
                data: emptyData,
                desg_list,
                hq_list,
                boss_list,
                bu_list,
                users_list,
                formType: 'create'
            });
        } catch (error) {
            console.error(error);
            res.status(500).render('error', { error: 'Failed to load employee form' });
        }
    }

    static create = async (req, res) => {
        const { first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code, card_no } = req.body;
        const data = req.body;

        try {
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
            if (!bu_id) {
                errors.push({ message: 'Select business unit' });
            }
            if (!user_id) {
                errors.push({ message: "Select login details for employee" });
            }

            // Check for duplicate employee name
            const rows = await executeQuery(
                'SELECT * FROM employees WHERE first_name=? and middle_name=? and last_name=?',
                [first_name, middle_name, last_name]
            );
            if (rows.length > 0) {
                errors.push({ message: 'Employee with this name already exists' });
            }

            if (errors.length > 0) {
                return res.render('emp/emp-form', {
                    errors,
                    data: { ...data },
                    desg_list,
                    hq_list,
                    boss_list,
                    bu_list,
                    users_list,
                    formType: 'create'
                });
            }

            // Generate new Employee ID
            const rows1 = await executeQuery('SELECT MAX(emp_id) AS maxNumber FROM employees');
            var nextEmployeeID = (rows1[0].maxNumber || 0) + 1;

            // Insert new record
            var status_new = status || 'A';
            var c_by = res.locals.user?.user_id || 0;

            const sqlStr = `INSERT INTO employees (
                emp_id, first_name, middle_name, last_name, desg_id, hq_id, boss_id, 
                bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code, card_no, c_at, c_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)`;

            const params = [
                nextEmployeeID, first_name, middle_name, last_name, desg_id, hq_id,
                boss_id, bu_id, off_day, status_new, user_id, vc_comp_code,
                vc_emp_code, ext_code, card_no, c_by
            ];

            await executeQuery(sqlStr, params);

            // Redirect with success message in query parameter
            res.redirect('/emp/view?alert=Employee created successfully');

        } catch (err) {
            console.error('Error creating employee:', err);
            const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();
            res.render('emp/emp-form', {
                errors: [{ message: 'Internal server error. Please try again.' }],
                data: { ...data },
                desg_list,
                hq_list,
                boss_list,
                bu_list,
                users_list,
                formType: 'create'
            });
        }
    };

    static viewAll = async (req, res) => {
        // Get alert from query parameter instead of session
        const alert = req.query.alert;

        try {
            const sqlStr = `SELECT 
                a.*, 
                CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name,
                b.desg_name, 
                c.hq_name, 
                d.bu_code, 
                d.bu_name,
                CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name
            FROM employees as a 
            LEFT JOIN designations as b ON (a.desg_id=b.desg_id) 
            LEFT JOIN hqs as c ON (a.hq_id=c.hq_id) 
            LEFT JOIN business_units as d ON (a.bu_id=d.bu_id) 
            LEFT JOIN employees as e ON (a.boss_id=e.emp_id)`;

            const results = await executeQuery(sqlStr);
            res.render('emp/emp-view', { employees: results, alert });

        } catch (error) {
            console.error('Error fetching employees:', error);
            res.render('emp/emp-view', {
                employees: [],
                alert: 'Error loading employees'
            });
        }
    }

    static edit = async (req, res) => {
        const { emp_id } = req.params;

        try {
            const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();

            const sqlStr = `SELECT 
                a.*, 
                CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name,
                b.desg_name, 
                c.hq_name, 
                d.bu_code, 
                d.bu_name,
                CONCAT(e.last_name,' ',e.first_name,' ',e.middle_name) as boss_name,
                CONCAT(f.username,' : ',f.email_id) as username
            FROM employees as a 
            LEFT JOIN designations as b ON (a.desg_id=b.desg_id) 
            LEFT JOIN hqs as c ON (a.hq_id=c.hq_id) 
            LEFT JOIN business_units as d ON (a.bu_id=d.bu_id) 
            LEFT JOIN employees as e ON (a.boss_id=e.emp_id) 
            LEFT JOIN users as f ON (a.user_id=f.user_id) 
            WHERE a.emp_id=?`;

            const results = await executeQuery(sqlStr, [emp_id]);

            if (results.length === 0) {
                // Use query parameter for error message
                return res.redirect('/emp/view?alert=Employee not found');
            }

            let data = results[0];

            res.render('emp/emp-form', {
                data,
                desg_list,
                hq_list,
                boss_list,
                bu_list,
                users_list,
                formType: 'edit'
            });
        } catch (error) {
            console.error('Error loading employee for edit:', error);
            res.redirect('/emp/view?alert=Error loading employee data');
        }
    }

    static update = async (req, res) => {
        const { emp_id } = req.params;
        const { first_name, middle_name, last_name, desg_id, hq_id, boss_id, bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code, ext_code, card_no } = req.body;
        const data = req.body;

        try {
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
            if (!bu_id) {
                errors.push({ message: 'Select business unit' });
            }
            if (!user_id) {
                errors.push({ message: "Select login details for employee" });
            }

            // Check for duplicate employee name (excluding current employee)
            const rows = await executeQuery(
                'SELECT * FROM employees WHERE first_name=? AND middle_name=? AND last_name=? AND emp_id<>?',
                [first_name, middle_name, last_name, emp_id]
            );
            if (rows.length > 0) {
                errors.push({ message: 'Another employee with this name already exists' });
            }

            if (errors.length > 0) {
                // Add emp_name for display in case of errors
                const currentData = await executeQuery(
                    'SELECT CONCAT(last_name," ",first_name," ",middle_name) as emp_name FROM employees WHERE emp_id=?',
                    [emp_id]
                );

                return res.render('emp/emp-form', {
                    errors,
                    data: { ...data, emp_name: currentData[0]?.emp_name },
                    desg_list,
                    hq_list,
                    boss_list,
                    bu_list,
                    users_list,
                    formType: 'edit'
                });
            }

            // Update record
            var u_by = res.locals.user?.user_id || 0;

            const sqlStr = `UPDATE employees SET 
                first_name=?, middle_name=?, last_name=?, desg_id=?, hq_id=?, boss_id=?, 
                bu_id=?, off_day=?, status=?, user_id=?, vc_comp_code=?, vc_emp_code=?, 
                ext_code=?, card_no=?, u_at=CURRENT_TIMESTAMP, u_by=?
            WHERE emp_id=?`;

            const params = [
                first_name, middle_name, last_name, desg_id, hq_id, boss_id,
                bu_id, off_day, status, user_id, vc_comp_code, vc_emp_code,
                ext_code, card_no, u_by, emp_id
            ];

            await executeQuery(sqlStr, params);

            // Redirect with success message
            res.redirect('/emp/view?alert=Employee updated successfully');

        } catch (err) {
            console.error('Error updating employee:', err);
            const [desg_list, hq_list, boss_list, bu_list, users_list] = await this.getData();

            // Get current employee name for display
            const currentData = await executeQuery(
                'SELECT CONCAT(last_name," ",first_name," ",middle_name) as emp_name FROM employees WHERE emp_id=?',
                [emp_id]
            );

            res.render('emp/emp-form', {
                errors: [{ message: 'Internal server error. Please try again.' }],
                data: { ...data, emp_name: currentData[0]?.emp_name },
                desg_list,
                hq_list,
                boss_list,
                bu_list,
                users_list,
                formType: 'edit'
            });
        }
    };

    static delete = async (req, res) => {
        const { emp_id } = req.params;
        try {
            // Check if employee has any dependent records
            const checks = [
                // Add any foreign key checks here based on your database schema
            ];

            let hasDependencies = false;
            for (const checkSql of checks) {
                const results = await executeQuery(checkSql, [emp_id]);
                if (results.length > 0) {
                    hasDependencies = true;
                    break;
                }
            }

            if (hasDependencies) {
                return res.redirect('/emp/view?alert=Cannot delete employee: Reference exists in other records');
            }

            // Delete employee
            await executeQuery("DELETE FROM employees WHERE emp_id=?", [emp_id]);

            res.redirect('/emp/view?alert=Employee deleted successfully');

        } catch (err) {
            console.error('Error deleting employee:', err);
            res.redirect('/emp/view?alert=Error deleting employee');
        }
    }

    static travelReport = async (req, res) => {
        try {
            // Get filter parameters from query string
            const { mon_date, emp_id, hq_id } = req.query;

            // Parse month_date (format: YYYY-MM)
            let reportYear, reportMonth;
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;

            if (mon_date) {
                const [year, month] = mon_date.split('-');
                reportYear = parseInt(year);
                reportMonth = parseInt(month);
            } else {
                // Default to current month
                reportYear = currentYear;
                reportMonth = currentMonth;
            }

            // Calculate min and max dates for the month picker (last 2 years to current month)
            const minDate = `${currentYear - 2}-01`;
            const maxDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

            // Format current month for display
            const curMon = `${reportYear}-${String(reportMonth).padStart(2, '0')}`;

            // Build WHERE clause dynamically
            let whereClause = `WHERE a.year = ?`;
            const params = [reportYear];

            whereClause += ` AND a.month = ?`;
            params.push(reportMonth);

            if (emp_id && emp_id !== 'all') {
                whereClause += ` AND a.emp_id = ?`;
                params.push(emp_id);
            }

            if (hq_id && hq_id !== 'all') {
                whereClause += ` AND e.hq_id = ?`;
                params.push(hq_id);
            }

            // SQL query with dynamic WHERE clause
            const sqlStr = `
            SELECT
                a.year,
                a.month,
                a.emp_id,
                CONCAT(c.last_name, ' ', c.first_name, ' ', c.middle_name) AS emp_name,
                d.desg_name,
                e.hq_name,
                CONCAT(f.last_name, ' ', f.first_name, ' ', f.middle_name) AS boss_name,
                a.post_ac,
                a.da,
                a.lodge,
                a.fare,
                a.stationary_val,
                a.postage_val,
                a.internet_val,
                a.other_val,
                (a.da + a.lodge + a.fare + a.stationary_val + a.postage_val + a.internet_val + a.other_val) AS total_amount,
                a.remarks,
                DATE_FORMAT(a.u_at, '%d/%m/%Y %H:%i:%s') AS post_date,
                c.card_no,

                /* -------- Travel KM Added -------- */
                IFNULL(t.travel_km, 0) AS travel_km,

                /* -------- Calls Made Added -------- */
                IFNULL(x.total_calls, 0) AS total_calls

            FROM dsr_ac a
            JOIN employees c ON a.emp_id = c.emp_id
            JOIN designations d ON c.desg_id = d.desg_id
            JOIN hqs e ON c.hq_id = e.hq_id
            JOIN employees f ON c.boss_id = f.emp_id

            /* ----------------- Travel KM Monthly Summary ------------------- */
            LEFT JOIN (
                SELECT 
                    emp_id,
                    YEAR(dsr_date) AS yr,
                    MONTH(dsr_date) AS mn,
                    SUM(to_km - from_km) AS travel_km
                FROM dsr_2
                GROUP BY emp_id, YEAR(dsr_date), MONTH(dsr_date)
            ) AS t 
            ON t.emp_id = a.emp_id AND t.yr = a.year AND t.mn = a.month

            /* ------------------ Calls Monthly Summary ----------------------- */
            LEFT JOIN (
                SELECT
                    emp_id,
                    YEAR(loc_date) AS yr,
                    MONTH(loc_date) AS mn,
                    COUNT(*) AS total_calls
                FROM dsr_loc
                GROUP BY emp_id, YEAR(loc_date), MONTH(loc_date)
            ) AS x 
            ON x.emp_id = a.emp_id AND x.yr = a.year AND x.mn = a.month

            ${whereClause}
            ORDER BY a.emp_id
        `;

            // Execute query
            const results = await executeQuery(sqlStr, params);

            // Get filter data
            const employees = await executeQuery("SELECT emp_id, CONCAT(last_name, ' ', first_name, ' ', middle_name) as emp_name FROM employees WHERE status='A' ORDER BY last_name");
            const hqs = await executeQuery("SELECT hq_id, hq_name FROM hqs WHERE status='A' ORDER BY hq_name");

            // Calculate totals
            const totals = results.reduce((acc, row) => {
                acc.da += parseFloat(row.da) || 0;
                acc.lodge += parseFloat(row.lodge) || 0;
                acc.fare += parseFloat(row.fare) || 0;
                acc.stationary_val += parseFloat(row.stationary_val) || 0;
                acc.postage_val += parseFloat(row.postage_val) || 0;
                acc.internet_val += parseFloat(row.internet_val) || 0;
                acc.other_val += parseFloat(row.other_val) || 0;
                acc.total_amount += parseFloat(row.total_amount) || 0;
                acc.travel_km += parseInt(row.travel_km) || 0;
                acc.total_calls += parseInt(row.total_calls) || 0;
                return acc;
            }, {
                da: 0,
                lodge: 0,
                fare: 0,
                stationary_val: 0,
                postage_val: 0,
                internet_val: 0,
                other_val: 0,
                total_amount: 0,
                travel_km: 0,
                total_calls: 0
            });

            // Get month name using moment
            const monthName = moment(`${reportYear}-${String(reportMonth).padStart(2, '0')}-01`).format('MMMM');

            // Render the report
            res.render('emp/travel-report', {
                reportData: results,
                employees,
                hqs,
                filters: {
                    mon_date: curMon,
                    emp_id: emp_id || 'all',
                    hq_id: hq_id || 'all'
                },
                totals,
                currentYear: currentYear,
                currentMonth: currentMonth,
                minDate: minDate,
                maxDate: maxDate,
                curMon: curMon,
                monthName: monthName,
                reportYear: reportYear,
                reportMonth: reportMonth
            });

        } catch (error) {
            console.error('Error generating travel report:', error);
            res.status(500).render('error', {
                error: 'Failed to generate travel report'
            });
        }
    };


};

export default EmployeeController;