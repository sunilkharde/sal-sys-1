import { executeQuery } from '../db.js';

class custDetailController {
    static getData = async () => {
        try {
            // Get Dealers (customer_type='Dealer')
            const dealer_list = await executeQuery("SELECT customer_id, customer_name, nick_name, ext_code FROM customers WHERE customer_type='Dealer' AND status='A'");
            
            // Get Sub-Dealers (customer_type='Sub-Dealer')
            const subdealer_list = await executeQuery("SELECT customer_id, customer_name, nick_name, ext_code FROM customers WHERE customer_type='Sub-Dealer' AND status='A'");

            return [dealer_list, subdealer_list];
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    static viewBlank = async (req, res) => {
        try {
            const [dealer_list, subdealer_list] = await this.getData();
            res.render('cust-detail/cust-detail-create', { 
                dealer_list, 
                subdealer_list,
                data: { customer_id: '', sr_no: '', cust_detail_id: '' },
                details: [] 
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }

    static create = async (req, res) => {
        const { customer_id, details } = req.body;
        const [dealer_list, subdealer_list] = await this.getData();
        
        try {
            // Validate input
            if (!customer_id) {
                return res.render('cust-detail/cust-detail-create', { 
                    errors: [{ message: 'Please select a Dealer' }],
                    dealer_list, 
                    subdealer_list,
                    data: { customer_id },
                    details: details || []
                });
            }

            const c_by = res.locals.user?.user_id || 0;

            // Insert master record (if needed)
            // Here we're just validating the dealer exists
            const dealer = await executeQuery("SELECT * FROM customers WHERE customer_id=? AND customer_type='Dealer'", [customer_id]);
            if (dealer.length === 0) {
                return res.render('cust-detail/cust-detail-create', { 
                    errors: [{ message: 'Invalid Dealer selected' }],
                    dealer_list, 
                    subdealer_list,
                    data: { customer_id },
                    details: details || []
                });
            }

            // Process details (Sub-Dealers)
            if (details && Array.isArray(details.cust_detail_id)) {
                for (let i = 0; i < details.cust_detail_id.length; i++) {
                    const subdealer_id = details.cust_detail_id[i];
                    
                    // Validate Sub-Dealer exists
                    const subdealer = await executeQuery("SELECT * FROM customers WHERE customer_id=? AND customer_type='Sub-Dealer'", [subdealer_id]);
                    if (subdealer.length === 0) continue;

                    // Get next sr_no for this customer
                    const maxSrNo = await executeQuery("SELECT MAX(sr_no) as max_sr FROM cust_detail WHERE customer_id=?", [customer_id]);
                    const nextSrNo = (maxSrNo[0].max_sr || 0) + 1;

                    // Insert detail record
                    await executeQuery(
                        "INSERT INTO cust_detail (customer_id, sr_no, cust_detail_id, c_at, c_by) VALUES (?, ?, ?, CURRENT_TIMESTAMP(), ?)",
                        [customer_id, nextSrNo, subdealer_id, c_by]
                    );
                }
            }

            res.redirect('/cust-detail/view');
        } catch (error) {
            console.error(error);
            res.render('cust-detail/cust-detail-create', { 
                errors: [{ message: 'Internal Server Error' }],
                dealer_list, 
                subdealer_list,
                data: { customer_id },
                details: details || []
            });
        }
    }

    static viewAll = async (req, res) => {
        try {
            const sqlStr = `
                SELECT h.customer_id, h.customer_name, h.ext_code as dealer_code, 
                       COUNT(d.sr_no) as subdealer_count
                FROM customers h
                LEFT JOIN cust_detail d ON h.customer_id = d.customer_id
                WHERE h.customer_type = 'Dealer'
                GROUP BY h.customer_id, h.customer_name, h.ext_code
                ORDER BY h.customer_name`;
            
            const results = await executeQuery(sqlStr);
            res.render('cust-detail/cust-detail-view', { dealers: results });
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }

    static edit = async (req, res) => {
        const { customer_id } = req.params;
        
        try {
            const [dealer_list, subdealer_list] = await this.getData();
            
            // Get dealer info
            const dealer = await executeQuery("SELECT customer_id, customer_name, ext_code FROM customers WHERE customer_id=?", [customer_id]);
            if (dealer.length === 0) {
                return res.redirect('/cust-detail/view');
            }
            
            // Get existing sub-dealers
            const details = await executeQuery(`
                SELECT d.sr_no, d.cust_detail_id, c.customer_name, c.ext_code 
                FROM cust_detail d
                JOIN customers c ON d.cust_detail_id = c.customer_id
                WHERE d.customer_id = ?
                ORDER BY d.sr_no`, [customer_id]);
            
            res.render('cust-detail/cust-detail-edit', { 
                dealer_list, 
                subdealer_list,
                data: dealer[0],
                details 
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }

    static update = async (req, res) => {
        const { customer_id } = req.params;
        const { details } = req.body;
        const [dealer_list, subdealer_list] = await this.getData();
        
        try {
            const u_by = res.locals.user?.user_id || 0;
            
            // First delete all existing details for this dealer
            await executeQuery("DELETE FROM cust_detail WHERE customer_id=?", [customer_id]);
            
            // Insert new details
            if (details && Array.isArray(details.cust_detail_id)) {
                for (let i = 0; i < details.cust_detail_id.length; i++) {
                    const subdealer_id = details.cust_detail_id[i];
                    
                    // Validate Sub-Dealer exists
                    const subdealer = await executeQuery("SELECT * FROM customers WHERE customer_id=? AND customer_type='Sub-Dealer'", [subdealer_id]);
                    if (subdealer.length === 0) continue;

                    // Get next sr_no
                    const maxSrNo = await executeQuery("SELECT MAX(sr_no) as max_sr FROM cust_detail WHERE customer_id=?", [customer_id]);
                    const nextSrNo = (maxSrNo[0].max_sr || 0) + 1;

                    await executeQuery(
                        "INSERT INTO cust_detail (customer_id, sr_no, cust_detail_id, u_at, u_by) VALUES (?, ?, ?, CURRENT_TIMESTAMP(), ?)",
                        [customer_id, nextSrNo, subdealer_id, u_by]
                    );
                }
            }
            
            res.redirect('/cust-detail/view');
        } catch (error) {
            console.error(error);
            
            // Get existing details to redisplay the form with errors
            const existingDetails = await executeQuery(`
                SELECT d.sr_no, d.cust_detail_id, c.customer_name, c.ext_code 
                FROM cust_detail d
                JOIN customers c ON d.cust_detail_id = c.customer_id
                WHERE d.customer_id = ?
                ORDER BY d.sr_no`, [customer_id]);
            
            res.render('cust-detail/cust-detail-edit', { 
                errors: [{ message: 'Internal Server Error' }],
                dealer_list, 
                subdealer_list,
                data: { customer_id },
                details: existingDetails
            });
        }
    }

    static delete = async (req, res) => {
        const { customer_id, sr_no } = req.params;
        
        try {
            await executeQuery("DELETE FROM cust_detail WHERE customer_id=? AND sr_no=?", [customer_id, sr_no]);
            res.redirect(`/cust-detail/update/${customer_id}`);
        } catch (error) {
            console.error(error);
            res.redirect(`/cust-detail/update/${customer_id}`);
        }
    }
}

export default custDetailController;