import { executeQuery } from '../db.js';

class circularController {

    static getData = async (req, user) => {
        try {

            var user_role = user.user_role !== null && user.user_role !== undefined ? user.user_role : 'User';

            var sqlCust = "Select a.customer_id, a.customer_name, CONCAT(a.city,' ',a.pin_code) as city_pin, ext_code as SAP_Code" +
                " From customers as a" +
                " Where a.status='A' and a.customer_type = 'Vendor'";
            if (user_role !== "Admin") {
                sqlCust = sqlCust + ` and a.user_id=${user.user_id}`;
            }
            const customer_list = await executeQuery(sqlCust);
            return [customer_list];
        } catch (error) {
            console.error(error);
        }
    }

    static viewBlank = async (req, res) => {
        const [customer_list] = await this.getData(req, res.locals.user);
        res.render('circular/circular-create', { customer_list });
    }

    static create = async (req, res) => {
        const { circular_date, customer_id, circular_no, veh_allow, days_allow, km_perday, rent_perday, driver_perday, diesel_avg, toll_tax } = req.body;
        const data = req.body

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Vendor name is required' });
        }
        if (!circular_no) {
            errors.push({ message: 'Circular Number is required' });
        }
        if (!veh_allow) {
            errors.push({ message: 'Veh Allowance is required' });
        }
        const rows = await executeQuery('SELECT * FROM circular_mst WHERE circular_date=? and circular_no=? ', [circular_date, circular_no]);
        if (rows.length > 0) {
            errors.push({ message: 'Circular number is already exists with this date' });
        }

        try {
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

            const rowMaxId = await executeQuery(`SELECT Max(circular_id) AS maxNumber FROM circular_mst Where circular_date ='${circular_date}'`);
            var nextCircularNo = rowMaxId[0].maxNumber + 1;

            const sqlStr = "INSERT INTO circular_mst (circular_date, circular_id, customer_id, circular_no, veh_allow, days_allow, km_perday, " +
                "rent_perday, driver_perday, diesel_avg, toll_tax, c_at, c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP(),?)"
            const paramsCirc = [circular_date, nextCircularNo, customer_id, circular_no, veh_allow, days_allow, km_perday, rent_perday, driver_perday, diesel_avg, toll_tax, c_by];

            await executeQuery(sqlStr, paramsCirc);

            res.redirect('/circular/view');

        } catch (err) {
            console.error(err);
            return res.render('circular/circular-view', { alert: `Internal server error` });
        }
    };

    static viewAll = async (req, res) => {
        const alert = req.query.alert;
        try {

            const sqlStr = "Select a.circular_date, a.circular_id, a.customer_id, b.customer_name, a.circular_no, a.veh_allow, a.days_allow, a.km_perday, a.rent_perday," +
                " a.driver_perday, a.diesel_avg, a.toll_tax" +
                " From circular_mst as a, customers as b Where a.customer_id = b.customer_id ";
            const results = await executeQuery(sqlStr)//, params);

            res.render('circular/circular-view', { circular: results, alert });

        } catch (error) {
            console.error(error);
        }
    }

    static edit = async (req, res) => {
        const { circular_date, circular_id } = req.params;

        try {
            const sqlStr = "Select a.*, b.customer_name from circular_mst as a, customers as b " +
                " Where a.customer_id = b.customer_id and a.circular_date=? and a.circular_id=?";
            const params = [circular_date, circular_id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0]

            res.render('circular/circular-edit', { data: data1 });

        } catch (error) {
            console.error(error);
        }
    }

    static update = async (req, res) => {
        const { circular_date, circular_id } = req.params;
        const { customer_id, circular_no, veh_allow, days_allow, km_perday, rent_perday, driver_perday, diesel_avg, toll_tax } = req.body;

        var errors = [];
        if (!customer_id) {
            errors.push({ message: 'Vendor name is required' });
        }
        if (!circular_no) {
            errors.push({ message: 'Circular Number is required' });
        }
        if (!veh_allow) {
            errors.push({ message: 'Veh Allowance is required' });
        }
        const rows = await executeQuery('SELECT * FROM circular_mst WHERE circular_date=? and circular_no=? and circular_id<>?', [circular_date, circular_no, circular_id]);
        if (rows.length > 0) {
            errors.push({ message: 'Circular number is already exists with this date' });
        }

        try {
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE circular_mst Set customer_id=?,veh_allow=?,days_allow=?,km_perday=?,rent_perday=?,driver_perday=?,diesel_avg=?,toll_tax=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE circular_date=? and circular_id=?"
            const params = [circular_id, veh_allow, days_allow, km_perday, rent_perday, driver_perday, diesel_avg, toll_tax, u_by, circular_date, circular_id];
            await executeQuery(sqlStr, params);

            res.redirect('/circular/view');

        } catch (err) {
            console.error(err);
            return res.render('circular/circular-view', { alert: `Internal server error` });
        }
    };

};

export default circularController