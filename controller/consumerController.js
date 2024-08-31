import { executeQuery } from '../db.js';

class consumerController {

    static getData = async () => {
        try {
            const cities_list = await executeQuery("SELECT * FROM cities");
            return [cities_list];
        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }


    static viewBlank = async (req, res) => {
        const [cities_list] = await this.getData();
        res.render('consumers/consumer-create', { cities_list });
    }

    static create = async (req, res) => {
        const { consumer_name, nick_name, consumer_type, mobile_no, email_id, add1, add2, add3, city, pin_code, district, state, ext_code, geo_location, status } = req.body;
        const data = req.body
        const [cities_list] = await this.getData();

        var errors = [];
        if (!consumer_name) {
            errors.push({ message: 'Consumer name is required' });
        }
        // if (!nick_name) {
        //     errors.push({ message: 'Enter nick name of consumer' });
        // }
        if (!consumer_type) {
            errors.push({ message: "Select consumer's type" });
        }
        if (!mobile_no) {
            errors.push({ message: "Enter Mobile no for consumer" });
        }
        if (!city) {
            errors.push({ message: 'Select consumer city from list' });
        }
        
        const rows = await executeQuery('SELECT * FROM consumers WHERE consumer_name=? or mobile_no=?', [consumer_name, mobile_no]);
        if (rows.length > 0) {
            errors.push({ message: 'Consumer with this name or mobile no is already exists' });
        }

        if (errors.length) {
            const updatedData = { ...data };
            //
            res.render('consumers/consumer-create', { errors, data: updatedData, cities_list });
            return;
        }

        try {
            // Genrate max Consumer id
            const rows1 = await executeQuery('SELECT Max(consumer_id) AS maxNumber FROM consumers');
            var nextConsumerID = rows1[0].maxNumber + 1;

            // Insert new record into database
            var status_new = status !== null && status !== undefined ? status : 'A';
            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "INSERT INTO consumers (consumer_id,consumer_name,nick_name,consumer_type,mobile_no,email_id,add1,add2,add3,city,pin_code,district,state,ext_code,geo_location,status,c_at,c_by)" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
            const paramsCust = [nextConsumerID, consumer_name, nick_name, consumer_type, mobile_no, email_id, add1, add2, add3, city, pin_code, district, state, ext_code, geo_location, status_new, c_by];
            await executeQuery(sqlStr, paramsCust);

            res.redirect('/consumer/view');

        } catch (err) {
            console.error(err);
            return res.render('consumers/consumer-view', { alert: `Internal server error` });
        } 
    };

    static viewAll = async (req, res) => {
        const alert = req.query.alert;
        try {

            const sqlStr = "Select a.consumer_id,a.consumer_name,a.nick_name,a.consumer_type, mobile_no, CONCAT(a.city,' ',a.pin_code) as city_pin,a.district" +
                " From consumers as a"
            const results = await executeQuery(sqlStr)//, params);

            res.render('consumers/consumer-view', { consumers: results, alert });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static edit = async (req, res) => {
        const { id } = req.params;

        try {
            const [cities_list] = await this.getData();

            const sqlStr = "Select a.* From consumers as a " +
                " Where a.consumer_id= ?";
            const params = [id];
            const results = await executeQuery(sqlStr, params);
            let data1 = results[0]

            res.render('consumers/consumer-edit', { data: data1, cities_list });
        } catch (error) {
            console.error(error);
            // Handle the error
        } 
    }

    static update = async (req, res) => {
        const { id } = req.params;
        const { consumer_name, nick_name, consumer_type, mobile_no, email_id, add1, add2, add3, city, pin_code, district, state, ext_code, geo_location, status } = req.body;
        const data = req.body
        const [cities_list] = await this.getData();

        var errors = [];
        if (!consumer_name) {
            errors.push({ message: 'Consumer name is required' });
        }
        // if (!nick_name) {
        //     errors.push({ message: 'Enter nick name of consumer' });
        // }
        if (!consumer_type) {
            errors.push({ message: "Select consumer's type" });
        }
        if (!mobile_no) {
            errors.push({ message: "Enter Mobile no for consumer" });
        }
        if (!city) {
            errors.push({ message: 'Select consumer city from list' });
        }
        
        const rows = await executeQuery('SELECT * FROM consumers WHERE (consumer_name=? or mobile_no=?) and consumer_id<>?', [consumer_name, mobile_no, id]);
        
        if (rows.length > 0) {
            errors.push({ message: 'Consumer with this name or mobile no is already exists' });
        }
        if (errors.length) {
            const updatedData = { ...data };
            res.render('consumers/consumer-edit', { errors, data: updatedData, cities_list });
            return;
        }

        try {
            var status_new = status !== null && status !== undefined ? status : 'A';
            var u_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
            const sqlStr = "UPDATE consumers Set consumer_name=?,nick_name=?,consumer_type=?,add1=?,add2=?,add3=?,city=?,pin_code=?,district=?,state=?,ext_code=?,geo_location=?,status=?,u_at=CURRENT_TIMESTAMP,u_by=?" +
                " WHERE consumer_id=?"
            const params = [consumer_name, nick_name, consumer_type, add1, add2, add3, city, pin_code, district, state, ext_code, geo_location, status_new, u_by, id];
            await executeQuery(sqlStr, params);

            res.redirect('/consumer/view');

        } catch (err) {
            console.error(err);
            return res.render('consumers/consumer-view', { alert: `Internal server error` });
        } 
    };

    static delete = async (req, res) => {
        const { id } = req.params;
        try {
            // var errors = [];
            // const sqlStr3 = "Select * from po_hd Where consumer_id=?"
            // const params3 = [id];
            // const rows = await executeQuery(sqlStr3, params3);
            // if (rows.length > 0) {
            //     errors.push({ message: "Reference exist, master entry can't delete" });
            // }
            // //            
            // if (errors.length) {
            //     res.redirect(`/consumer/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
            //     return;
            // }
            
            // const sqlStr = "Delete from consumers WHERE consumer_id=?"
            // const params = [id];
            // await executeQuery(sqlStr, params);
            
            // res.redirect('/consumer/view?alert=consumer+deleted+successfully');
            res.redirect('/consumer/view?alert=consumer+delete+not+possible');

        } catch (err) {
            console.error(err);
            return res.render('consumers/consumer-view', { alert: `Internal server error` });
        } 
    };

};

export default consumerController