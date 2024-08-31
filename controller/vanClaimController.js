import moment from 'moment/moment.js';
import { executeQuery } from '../db.js';
import PDFDocument from 'pdfkit-table';

class vanClaimController {

    static getData = async (req, user) => {

        try {
            var user_role = user.user_role !== null && user.user_role !== undefined ? user.user_role : 'User';

            //Get employee details
            const sqlEmp = "Select a.emp_id,a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day" +
                " FROM employees as a, designations as b, hqs as c" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.status='A' and a.user_id=?"
            const paramsEmp = [user.user_id];
            const empData = await executeQuery(sqlEmp, paramsEmp);
            if (empData.length === 0) {
                res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                return;
            }
            var sqlCust = "Select DISTINCT a.customer_id, a.customer_name, CONCAT(a.city,' ',a.pin_code) as city_pin, ext_code as SAP_Code " +
                " from customers as a, circular_mst as b" +
                " Where a.status='A' and a.customer_type = 'Vendor' " +
                " and a.customer_id  =  b.customer_id ";
            if (user_role !== "Admin") {
                sqlCust = sqlCust + ` and (a.user_id=${user.user_id} or a.mg_id = ${empData[0].emp_id} or a.se_id = ${empData[0].emp_id})`;
            }
            const customer_list = await executeQuery(sqlCust);

            // console.log('customer_list', customer_list, sqlCust)

            const ItemGroup_list = await executeQuery("SELECT category_id as item_id , category_name as itemgroup_name FROM categories as a Where a.status='A' order by category_name");

            var sqlVeh = "select a.reg_no as veh_no from cust_veh  as a, customers as b where a.customer_id = b.customer_id ";
            if (user_role !== "Admin") {
                sqlVeh = sqlVeh + ` and b.user_id=${user.user_id}`;
            }
            const Vehicle_list = await executeQuery(sqlVeh);

            var sqlsalesemp = "select a.sp_name as sp_name from cust_sp  as a, customers as b where a.customer_id = b.customer_id";
            if (user_role !== "Admin") {
                sqlsalesemp = sqlsalesemp + ` and b.user_id=${user.user_id}`;
            }
            const salesemp_list = await executeQuery(sqlsalesemp);

            var sqldriverrate = "select  customer_id, rent_perday, driver_perday from circular_mst";
            const driver_rate = await executeQuery(sqldriverrate);

            return [customer_list, ItemGroup_list, Vehicle_list, salesemp_list];

        } catch (error) {
            console.error(error);
        }

    };

    static getRentData = async (req, res) => {
        try {
            const { customer_id } = req.query;
            const sqlStr = "SELECT veh_rent, driver_rent" +
                " FROM circular_mst" +
                " WHERE customer_id=? and circular_date <= (Select max(circular_date) From circular_mst Where customer_id=?)";
            const rentData = await executeQuery(sqlStr, [customer_id, customer_id]);

            var sqlVehList = "Select a.reg_no as veh_no From cust_veh as a, customers as b Where a.customer_id=b.customer_id and a.customer_id=?";
            const vehList = await executeQuery(sqlVehList, [customer_id]);

            var sqlSP = "Select a.sp_name as emp_name From cust_sp as a, customers as b Where a.customer_id=b.customer_id and a.customer_id=?";
            const spList = await executeQuery(sqlSP, [customer_id]);

            res.json({ rentData: rentData[0], vehList, spList });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static viewBlank = async (req, res) => {

        const [customer_list, ItemGroup_list, Vehicle_list, salesemp_list] = await this.getData(req, res.locals.user);

        let sqlExp = "Select 1 as sr_no, CURDATE() as exp_date , '' as veh_no, '' as work_area, '' as from_km, " +
            " '' as to_km, '' as diesel_ltr,  '' as diesel_amt, '' as driver_rent, '' as vehicle_rent, " +
            " '' as emp_name, '' as other_amount From dual";
        let vehExp = await executeQuery(sqlExp);

        let sqlVanItem = "Select 1 as sr_no_item,  NULL as exp_date_item , '' as item_id, '' as item_qty, '' as item_value From dual";
        let vehItem = await executeQuery(sqlVanItem);

        res.render('vanClaim/vanClaim-create', { customer_list, vehExp, vehItem, ItemGroup_list, Vehicle_list, salesemp_list });
    }

    static view = async (req, res) => {
        const alert = req.query.alert;

        try {

            //Get employee details
            const sqlEmp = "Select a.emp_id,a.first_name,a.middle_name,a.last_name,a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day" +
                " FROM employees as a, designations as b, hqs as c" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.status='A' and a.user_id=?"
            const paramsEmp = [res.locals.user.user_id];
            const empData = await executeQuery(sqlEmp, paramsEmp);
            if (empData.length === 0) {
                res.status(404).send("<h1>This user has no mapping with an employee.</h1>");
                return;
            }

            let sqlStr = `SELECT a.claim_month, 
                DATE_FORMAT(a.claim_month, '%b-%Y') AS claim_mmyyy, 
                DATE_FORMAT(a.claim_month, '%Y-%m') AS claim_YM,
                b.customer_name, a.customer_id, b.ext_code, 
                SUM(c.driver_rent + c.veh_rent + c.diesel_amt + c.other_amt) AS claim_amount, 
                SUM(d.item_value) AS item_total
                FROM veh_claim AS a
                LEFT JOIN customers AS b ON a.customer_id = b.customer_id
                LEFT JOIN veh_exp AS c ON a.customer_id = c.customer_id AND a.claim_month = c.claim_month
                LEFT JOIN veh_item AS d ON a.customer_id = d.customer_id AND a.claim_month = d.claim_month
                GROUP BY a.claim_month, 
                DATE_FORMAT(a.claim_month, '%b-%Y'), 
                b.customer_name, a.customer_id, b.ext_code`
            if (!["Admin", "Support"].includes(res.locals.user.user_role)) {
                sqlStr = sqlStr + ` and (b.mg_id = ${empData[0].emp_id} or b.se_id = ${empData[0].emp_id})`;
            }

            const results = await executeQuery(sqlStr); //, paramsVeh);

            res.render("vanClaim/vanClaim-view", { vanClaim: results, alert });

        } catch (error) {
            console.error(error);
        }
    };

    static edit = async (req, res) => {
        const { customer_id, claim_month } = req.query;
        const claim_date = claim_month + '-01';

        try {
            const sqlVehList = "Select a.reg_no as veh_no From cust_veh as a, customers as b Where a.customer_id=b.customer_id and a.customer_id=?";
            const vehList = await executeQuery(sqlVehList, [customer_id]);
            const sqlSP = "Select a.sp_name From cust_sp as a, customers as b Where a.customer_id=b.customer_id and a.customer_id=?";
            const spList = await executeQuery(sqlSP, [customer_id]);
            const sqlCategory = "SELECT category_id, category_name FROM categories as a Where a.status='A' Order by category_name";
            const categoryList = await executeQuery(sqlCategory);
            const sqlRent = "SELECT rent_perday, driver_perday FROM circular_mst" +
                " WHERE customer_id=? and circular_date <= (Select max(circular_date) From circular_mst Where customer_id=?)";
            const rentData = await executeQuery(sqlRent, [customer_id, customer_id]);
            let vehRent = 0;
            let driverRent = 0;
            if (rentData.length > 0) {
                vehRent = rentData[0].rent_perday;
                driverRent = rentData[0].driver_perday;
            }

            let data1 = [];
            const sqlStr = "Select a.customer_id, b.customer_name, a.claim_month, DATE_FORMAT(a.claim_month,'%Y-%m') as claim_month" +
                " From veh_claim as a, customers as b" +
                " Where a.customer_id = b.customer_id and a.customer_id=? and claim_month=?";
            const params = [customer_id, claim_date];
            const claimData = await executeQuery(sqlStr, params);
            data1 = claimData[0];

            let sqlExp = null;
            let expData = null;
            let sqlItem = null;
            let itemData = null;

            if (claimData.length > 0) {
                //This code is for Vehicle information
                sqlExp = "Select sr_no, exp_date, veh_no, work_area, from_km, to_km, diesel_ltr, diesel_amt, driver_rent, veh_rent, emp_name, other_amt" +
                    " From veh_exp Where customer_id=? and claim_month=?";
                expData = await executeQuery(sqlExp, [customer_id, claim_date]);

                //This code is for Salesman information
                sqlItem = "Select a.sr_no as sr_no_item, a.exp_date as exp_date_item, a.item_id, b.category_name as item_group, a.item_qty, a.item_rate, a.item_value" +
                    " From veh_item as a, categories as b  Where a.item_id=b.category_id and a.customer_id=? and a.claim_month=?"
                itemData = await executeQuery(sqlItem, [customer_id, claim_date]);
            } else {
                let sqlCust = "Select customer_name from customers where customer_id=?";
                let custName = await executeQuery(sqlCust, [customer_id]);

                data1 = { customer_id: customer_id, claim_month: claim_month, customer_name: custName[0].customer_name };

                sqlExp = `Select 1 as sr_no, CURDATE() as exp_date, '' as veh_no, '' as work_area, 0 as from_km, 0 as to_km, 0 as diesel_ltr,` +
                    ` 0 as diesel_amt, ${driverRent} as driver_rent, ${vehRent} as veh_rent, '' as emp_name, 0 as other_amt From dual`;
                expData = await executeQuery(sqlExp);

                sqlItem = "Select 1 as sr_no_item, CURDATE() as exp_date_item, '' as item_id, 0 as item_qty, 0 as item_rate, 0 as item_value From dual";
                itemData = await executeQuery(sqlItem);
            }

            res.render("vanClaim/vanClaim-edit", { data: data1, expData, itemData, vehList, spList, categoryList, rentData });
        }
        catch (error) {
            console.error(error);
        }

    };

    static update = async (req, res) => {
        const { customer_id, claim_month } = req.params;

        const claim_date = claim_month + '-01';

        const { sr_no, exp_date, veh_no, work_area, from_km, to_km, diesel_ltr, diesel_amt, driver_rent, veh_rent, sp_name, other_amt, sr_no_item, exp_date_item, category_id, item_qty, item_value } = req.body;


        // const sr_no_val = Array.isArray(sr_no) ? sr_no : [sr_no];
        const exp_date_val = Array.isArray(exp_date) ? exp_date : [exp_date];
        const reg_no_val = Array.isArray(veh_no) ? veh_no : [veh_no];
        const work_area_val = Array.isArray(work_area) ? work_area : [work_area];
        const from_km_val = Array.isArray(from_km) ? from_km : [from_km];
        const to_km_val = Array.isArray(to_km) ? to_km : [to_km];
        const diesel_ltr_val = Array.isArray(diesel_ltr) ? diesel_ltr : [diesel_ltr];
        const diesel_amt_val = Array.isArray(diesel_amt) ? diesel_amt : [diesel_amt];
        const driver_rent_val = Array.isArray(driver_rent) ? driver_rent : [driver_rent];
        const veh_rent_val = Array.isArray(veh_rent) ? veh_rent : [veh_rent];
        const sp_name_val = Array.isArray(sp_name) ? sp_name : [sp_name];
        const other_amt_val = Array.isArray(other_amt) ? other_amt : [other_amt];

        const sr_no_item_val = Array.isArray(sr_no_item) ? sr_no_item : [sr_no_item || defaultValue];
        const exp_date_item_val = Array.isArray(exp_date_item) ? exp_date_item : [exp_date_item];
        const category_id_val = Array.isArray(category_id) ? category_id : [category_id];
        const item_qty_val = Array.isArray(item_qty) ? item_qty : [item_qty];
        const item_value_val = Array.isArray(item_value) ? item_value : [item_value];

        var errors = [];
        const sqlvehallow = "Select days_allow From circular_mst where customer_id=?";
        const paramsvehallow = [customer_id];
        const allowresult = await executeQuery(sqlvehallow, paramsvehallow);
        const daysAllow = allowresult[0].days_allow;

        if (sr_no.length > daysAllow) {
            errors.push({ message: 'Days Allowed exceeds Entered Days, Data not saved.' });
        }

        if (errors.length) {
            const sqlVehList = "Select a.reg_no as veh_no From cust_veh as a, customers as b Where a.customer_id=b.customer_id and a.customer_id=?";
            const vehList = await executeQuery(sqlVehList, [customer_id]);
            const sqlSP = "Select a.sp_name From cust_sp as a, customers as b Where a.customer_id=b.customer_id and a.customer_id=?";
            const spList = await executeQuery(sqlSP, [customer_id]);
            const sqlCategory = "SELECT category_id, category_name FROM categories as a Where a.status='A' Order by category_name";
            const categoryList = await executeQuery(sqlCategory);
            const sqlRent = "SELECT rent_perday, driver_perday FROM circular_mst" +
                " WHERE customer_id=? and circular_date <= (Select max(circular_date) From circular_mst Where customer_id=?)";
            const rentData = await executeQuery(sqlRent, [customer_id, customer_id]);
            let vehRent = 0;
            let driverRent = 0;
            if (rentData.length > 0) {
                vehRent = rentData[0].rent_perday;
                driverRent = rentData[0].driver_perday;
            }

            let data1 = [];
            const sqlStr = "Select a.customer_id, b.customer_name, a.claim_month, DATE_FORMAT(a.claim_month,'%Y-%m') as claim_month" +
                " From veh_claim as a, customers as b" +
                " Where a.customer_id = b.customer_id and a.customer_id=? and claim_month=?";
            const params = [customer_id, claim_date];
            const claimData = await executeQuery(sqlStr, params);
            data1 = claimData[0];

            //************ */
            let expData = null;
            let itemData = null;

            //************ */
            const reconstructedData = [];
            const expData1 = sr_no.map((sr, i) => ({
                sr_no: i + 1,
                exp_date: exp_date_val[i],
                reg_no: reg_no_val[i],
                work_area: work_area_val[i],
                from_km: from_km_val[i],
                to_km: to_km_val[i],
                diesel_ltr: diesel_ltr_val[i],
                diesel_amt: diesel_amt_val[i],
                driver_rent: driver_rent_val[i],
                veh_rent: veh_rent_val[i],
                sp_name: sp_name_val[i],
                other_amt: other_amt_val[i],
            }));
            reconstructedData.push(expData1);

            //************ */
            const itemData1 = sr_no_item.map((sr, j) => ({
                sr_no_item: j + 1,
                exp_date_item: exp_date_item_val[j],
                category_id: category_id_val[j],
                item_qty: item_qty_val[j],
                item_value: item_value_val[j],
            }));
            reconstructedData.push(itemData1);

            expData = expData1;
            itemData = itemData1;

            res.render("vanClaim/vanClaim-edit", { errors, data: data1, expData, itemData, vehList, spList, categoryList, rentData });
            return;
        }

        try {
            var upd_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlVeh = "DELETE FROM veh_exp WHERE customer_id = ? and claim_month = ?";
            const paramsVeh = [customer_id, claim_date];
            await executeQuery(sqlVeh, paramsVeh);
            for (let i = 0; i < sr_no.length; i++) {
                let sr_no_val = i + 1;
                const sqlVehU = "Insert into veh_exp (customer_id, claim_month, sr_no, exp_date, veh_no, work_area, from_km, to_km, diesel_ltr, diesel_amt, driver_rent, veh_rent  , emp_name, other_amt )" +
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,? )";
                const paramsDtU = [customer_id, claim_date, sr_no_val, exp_date_val[i], reg_no_val[i], work_area_val[i], from_km_val[i], to_km_val[i], diesel_ltr_val[i], diesel_amt_val[i], driver_rent_val[i], veh_rent_val[i], sp_name_val[i], other_amt_val[i]];
                await executeQuery(sqlVehU, paramsDtU);
            }

            // Delete records from veh Item
            const sqlVehI = "Delete FROM veh_item WHERE customer_id = ? and claim_month = ?";
            const paramsVehI = [customer_id, claim_date];
            await executeQuery(sqlVehI, paramsVehI);

            for (let j = 0; j < sr_no_item.length; j++) {
                const sqlStrIt = "INSERT INTO veh_item (customer_id, claim_month, sr_no,  exp_date, item_id, item_qty,  item_value )" +
                    " VALUES (?,?,?,?,?,?,? )";
                const paramsDtIt = [customer_id, claim_date, j + 1, exp_date_item_val[j], category_id_val[j], item_qty_val[j], item_value_val[j]];

                await executeQuery(sqlStrIt, paramsDtIt);
            }

            const sqlVehc = "delete from veh_claim where customer_id = ? and claim_month = ?";
            await executeQuery(sqlVehc, paramsVehI);

            const sqlVehCI = "INSERT INTO veh_claim (customer_id, claim_month, c_at ) " +
                " VALUES (?,?,CURRENT_DATE()) ";
            await executeQuery(sqlVehCI, paramsVehI);

            res.redirect("/vanClaim/view");
            // res.redirect('/customer/view?alert=Update+Customer+successfully');

        } catch (err) {
            console.error(err);
            return res.render("/vanClaim/vanClaim-view", { alert: `Internal server error` });
        }

    };

    static exportPDF = async (req, res) => {
        const { customer_id, claim_month } = req.query;
        const claim_date = claim_month + '-01';

        try {

            const paramsVeh = [customer_id, claim_date];
            const sqlVeh = "Select sr_no, DATE_FORMAT(exp_date,'%d-%m-%Y') as exp_date, veh_no, work_area, from_km, to_km, (from_km - to_km) as net_km, diesel_ltr, diesel_amt, " +
                " driver_rent, veh_rent, emp_name, other_amt " +
                " From veh_exp Where customer_id=? and claim_month=? " +
                " Order by 1 ";
            const vehData = await executeQuery(sqlVeh, paramsVeh);

            const sqlItem = "Select a.sr_no as sr_no_item, DATE_FORMAT(a.exp_date,'%d-%m-%Y') as exp_date_item, a.item_id, " +
                " b.category_name as item_group, a.item_qty, a.item_rate, a.item_value" +
                " From veh_item as a, categories as b  Where a.item_id=b.category_id and a.customer_id=? and a.claim_month=? " +
                " Order by 1  ";
            const itemData = await executeQuery(sqlItem, paramsVeh);

            const sqlv = "Select customer_name as vendor_name from customers where customer_id = ?";
            const venData = await executeQuery(sqlv, customer_id);

            let dieselltrsum = 0;
            let dieselamtsum = 0;
            let driverrentsum = 0;
            let vehrentsum = 0;

            vehData.forEach(row => {
                dieselltrsum += row.diesel_ltr;
                dieselamtsum += row.diesel_amt;
                driverrentsum += row.driver_rent;
                vehrentsum += row.veh_rent;
            });
            const totalRow = ['', 'Total ', '', '', '', '', '', dieselltrsum, dieselamtsum, driverrentsum, vehrentsum, ''];
            const tableDtlRows = [
                ...vehData.map(row => [
                    row.sr_no, row.exp_date, row.veh_no, row.work_area, row.from_km, row.to_km, row.net_km,
                    row.diesel_ltr, row.diesel_amt, row.driver_rent, row.veh_rent, row.emp_name
                ]),
                totalRow
            ];

            let itemvaluesum = 0;
            itemData.forEach(row => {
                itemvaluesum += row.item_value;
            });
            const totalItemRow = ['', '', 'Total', '', itemvaluesum];
            const tableDtlItemRows = [
                ...itemData.map(row => [
                    row.sr_no_item, row.exp_date_item, row.item_group, row.item_qty, row.item_value
                ]),
                totalItemRow
            ];

            let doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.info.Title = 'VAN Claim report';

            doc.table({
                title: { label: "VAN Claim for Vendor Name " + venData[0].vendor_name + "   Month " + claim_month },

                // subtitle: { label: subtitleLabel },
                headers: [
                    { label: "Sr No", width: 20, align: 'left' },
                    { label: "Date", width: 60, align: 'left' },
                    { label: "Veh No", width: 50, align: 'left' },
                    { label: "Work Area", width: 80, align: 'left' },
                    { label: "From KM", width: 30, align: 'left' },
                    { label: "To KM", width: 30, align: 'left' },
                    { label: "Net KM", width: 30, align: 'left' },
                    { label: "Diesel Ltr", width: 30, align: 'right' },
                    { label: "Diesel Amount", width: 40, align: 'right' },
                    { label: "Driver Rent", width: 30, align: 'right' },
                    { label: "Vehicle Rent", width: 30, align: 'right' },
                    { label: "Emp Name", width: 100, align: 'right' }
                ],
                rows: tableDtlRows,
                repeatingHeader: true // enable repeating headers
            });

            // Add the summary to the PDF document
            doc.moveDown(); // Move down to a new line

            //*******Attendance Report Start******/
            doc.moveDown(1);
            doc.table({
                // title: { label: "Attendance Details" },
                subtitle: { label: "Product Details" },
                headers: [
                    { label: "Sr No", width: 20, align: 'left' },
                    { label: "Exp Date", width: 60, align: 'right' },
                    { label: "Item Group", width: 50, align: 'right' },
                    { label: "Item Qty", width: 50, align: 'right' },
                    { label: "Item Value", width: 50, align: 'right' }
                ],
                rows: tableDtlItemRows,
                repeatingHeader: true, // enable repeating headers
            });
            //*******Attendance Report End******/

            //*******Summary Report Start******/
            doc.moveDown();
            //******Fare Report Start*****/
            doc.text('')

            doc.moveDown(10);

            doc.text('                Party Stamp and Sign                                                                        Approved By')

            // Set the response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=VanClaim.pdf');
            // Pipe the PDF document to the response
            doc.pipe(res);
            // End the PDF document
            doc.end();

            // console.log('Data exported successfully to PDF file!'); //add employee name here 
            const now = new Date().toLocaleString();
            console.log(`VAN Claim Report data exported successfully to PDF file!... user: '${res.locals.user.username} on '${now}'`);

        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    };

}

export default vanClaimController