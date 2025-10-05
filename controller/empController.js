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
};

export default EmployeeController;