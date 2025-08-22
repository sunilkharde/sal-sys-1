import axios from 'axios';
import { executeQuery } from '../db.js';
import moment from 'moment';

class sapImportController {

    static getAllBusinessUnits = async () => {
        try {
            const businessUnits = await executeQuery(
                "SELECT bu_id, bu_code, bu_name FROM business_units WHERE status='A'"
            );
            return businessUnits;
        } catch (error) {
            console.error('Error fetching business units:', error);
            throw error;
        }
    }

    static getSalesDataFromSAP = async (buCode, params) => {
        try {
            const response = await axios.post('http://192.168.182.26/api/GetSalesData/Get', {
                SalesOrg: buCode,
                BillingDateFrom: moment(params.dateFrom).format('DD.MM.YYYY') || '01.06.2025',
                BillingDateTo: moment(params.dateTo).format('DD.MM.YYYY') || '31.06.2025',
                SalesEmployeeFrom: params.salesEmployeeFrom || '',
                SalesEmployeeTo: params.salesEmployeeTo || '',
                MaterialGroupFrom: params.materialGroupFrom || '',
                MaterialGroupTo: params.materialGroupTo || '',
                CustomerFrom: params.customerFrom || '',
                CustomerTo: params.customerTo || ''
            });

            return response.data;
        } catch (error) {
            console.error(`SAP API Error for BU ${buCode}:`,
                error.response?.status ? `${error.response.status} - ${error.response.statusText}` : error.message);
            return null;
        }
    }

    static showImportPage = async (req, res) => {
        try {
            const businessUnits = await this.getAllBusinessUnits();

            res.render('sap-data/import-sap-data', {
                title: 'Import SAP Sales Data',
                businessUnits,
                helpers: {
                    eq: function (a, b) { return a === b; }
                }
            });
        } catch (error) {
            console.error('Error showing import page:', error);
            res.status(500).render('error', {
                message: 'Error loading import page'
            });
        }
    }

    static deleteExistingRecords = async (buId, dateFrom, dateTo) => {
        try {

            // Additionally delete records older than 36 months
            const thirtySixMonthsAgo = moment().subtract(36, 'months').format('YYYY-MM-DD');
            const deletedOldCount = await executeQuery(
                `DELETE FROM sap_sales 
                WHERE bu_id = ? 
                AND billing_date < ?`,
                [
                    buId,
                    thirtySixMonthsAgo
                ]
            );

            // Delete records in the specified date range
            const deletedCount = await executeQuery(
                `DELETE FROM sap_sales 
                WHERE bu_id = ? 
                AND billing_date BETWEEN ? AND ?`,
                [
                    buId,
                    moment(dateFrom).format('YYYY-MM-DD'),
                    moment(dateTo).format('YYYY-MM-DD')
                ]
            );

            console.log(`Deleted ${deletedOldCount.affectedRows} records older than 36 months for BU ${buId}`);
            console.log(`Deleted ${deletedCount.affectedRows} existing records for BU ${buId}`);

            return {
                oldDeletes: deletedOldCount.affectedRows,
                recentDeletes: deletedCount.affectedRows
            };

        } catch (error) {
            console.error('Error deleting existing records:', error);
            throw error;
        }
    }

    static importSalesData = async (req, res) => {
        try {
            const { dateFrom, dateTo, buId } = req.body;
            const businessUnits = buId ?
                await executeQuery("SELECT bu_id, bu_code, bu_name FROM business_units WHERE bu_id = ? AND status='A'", [buId]) :
                await this.getAllBusinessUnits();

            const importBatch = `IMP-${moment().format('YYYYMMDD-HHmmss')}`;
            const results = [];

            for (const bu of businessUnits) {
                try {
                    // Delete existing records for this BU and date range
                    await this.deleteExistingRecords(bu.bu_id, dateFrom, dateTo);

                    const salesData = await this.getSalesDataFromSAP(bu.bu_code, { dateFrom, dateTo });
                    // console.log('Fetched Sale Data', JSON.stringify(salesData));
                    const importedCount = await this.saveSalesRecords(bu.bu_id, salesData, importBatch);
                    // Now only using processSalesRecords which handles both groups and products
                    const processedRecordsCount = await this.processSalesRecords(salesData);

                    results.push({
                        bu_id: bu.bu_id,
                        bu_name: bu.bu_name,
                        status: 'success',
                        records_imported: importedCount,
                        records_processed: processedRecordsCount, // Updated field name
                        import_batch: importBatch
                    });
                } catch (error) {
                    results.push({
                        bu_id: bu.bu_id,
                        bu_name: bu.bu_name,
                        status: 'error',
                        error: error.message,
                        import_batch: importBatch
                    });
                }
            }

            res.render('sap-data/import-sap-data', {
                title: 'Import SAP Sales Data',
                businessUnits,
                results,
                imported: true,
                helpers: {
                    eq: function (a, b) { return a === b; }
                }
            });
        } catch (error) {
            console.error('Error in importSalesData:', error);
            res.status(500).json({
                success: false,
                message: 'Error importing sales data',
                error: error.message
            });
        }
    }

    static saveSalesRecords = async (buId, salesData, importBatch) => {
        let importedCount = 0;

        for (const record of salesData) {
            try {
                // Clean material number by removing leading zeros
                const materialNumber = record.materialNumber.replace(/^0+/, '');

                await executeQuery(
                    `INSERT INTO sap_sales (
                        bu_id, company_code, billing_date, document_number, customer_number,
                        sales_employee_name, taluka, district, material_number, material_description,
                        material_group, material_group_description, price_group, price_group_description,
                        quantity, item_price, sales_unit, net_weight, gross_weight, sp_name, sp_code,
                        import_batch
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        buId,
                        record.companyCode,
                        moment(record.billingDate, 'YYYYMMDD').format('YYYY-MM-DD'),
                        record.documentNumber,
                        record.customerNumber,
                        record.salesEmployeeName,
                        record.taluka,
                        record.district,
                        materialNumber,
                        record.materialDescription,
                        record.priceGroup, //store price group as material group
                        record.priceGroupDescription, //store price group description as material group description
                        record.materialGroup, //store material group as price group
                        record.materialGroupDescription, //store material group description as price group description
                        record.quantity,
                        record.itemPrice,
                        record.salesUnit,
                        record.netWeight,
                        record.grossWeigh,
                        record.spName,
                        record.spCode,
                        importBatch
                    ]
                );

                importedCount++;
            } catch (error) {
                console.error('Error saving record:', record, error);
            }
        }

        return importedCount;
    }

    static processSalesRecords = async (salesData) => {
        let processedCount = 0;

        for (const record of salesData) {
            try {

                // console.log('Raw SAP record:', {
                //     materialGroup: record.materialGroup,
                //     materialGroupDescription: record.materialGroupDescription,
                //     priceGroup: record.priceGroup,
                //     priceGroupDescription: record.priceGroupDescription
                // });

                const materialNumber = record.materialNumber.replace(/^0+/, '');
                const customerNumber = record.customerNumber.replace(/^0+/, '');

                // First try to find the product
                let product = await this.findProductByExtCode(materialNumber);

                // If product not found but customer exists, create new product
                if (!product) {
                    const customer = await this.findCustomerByExtCode(customerNumber);
                    if (customer) {
                        product = await this.createNewProduct(materialNumber, record);
                        processedCount++;
                    }
                }

                // If we have a product, update group info
                if (product) {
                    const groupId = await this.updateGroupInformation(
                        product.group_id, // Will be null for new products
                        {
                            group_code: record.priceGroup.trim(),
                            group_name: record.priceGroupDescription.trim(),
                            base_group: record.materialGroupDescription.trim(),
                            group_code2: record.materialGroup.trim(),
                            group_name2: record.materialGroupDescription.trim(),
                        }
                    );

                    // Update product with the correct group_id if it was null
                    if (!product.group_id) {
                        await executeQuery(
                            'UPDATE products SET group_id = ? WHERE product_id = ?',
                            [groupId, product.product_id]
                        );
                    }

                    processedCount++;
                }
            } catch (error) {
                console.error('Error processing record:', record, error);
            }
        }

        return processedCount;
    }

    static createNewProduct = async (materialNumber, record) => {
        // Get the next product ID
        const maxProduct = await executeQuery('SELECT MAX(product_id) AS max_id FROM products');
        const nextProductId = maxProduct[0].max_id ? maxProduct[0].max_id + 1 : 1;

        // Create the product with null group_id (will be updated later)
        await executeQuery(
            `INSERT INTO products (
            product_id, product_name, description, unit_id, category_id, 
            rate, ext_code, group_id, status, cf_val, c_at, c_by
        ) VALUES (?, ?, ?, 1, 1, 0, ?, NULL, 'I', 1, NOW(), 1)`,
            [
                nextProductId,
                record.materialDescription || `Product ${materialNumber}`,
                record.materialDescription || '',
                materialNumber
            ]
        );

        return {
            product_id: nextProductId,
            group_id: null // Will be set in updateGroupInformation
        };
    }

    static updateGroupInformation = async (groupId, groupData) => {
        // First try to find existing group by code
        const existingGroup = await executeQuery(
            'SELECT group_id FROM groups WHERE group_code = ?',
            [groupData.group_code]
        );

        const timestamp = moment().format('YYMMDDHHmmss'); // Format timestamp

        if (existingGroup.length === 0) {
            // For new groups, always generate a new ID - ignore the provided groupId
            const maxGroup = await executeQuery('SELECT MAX(group_id) AS max_id FROM groups');
            const newGroupId = maxGroup[0].max_id ? maxGroup[0].max_id + 1 : 1;

            // console.log('Creating new group with data:', groupData);

            await executeQuery(
                `INSERT INTO groups 
                (group_id, group_code, group_name, base_group, group_code2, group_name2, seq_sr, status, c_at, c_by) 
                VALUES (?, ?, ?, ?, ?, ?, 1, "A", NOW(), 1)`,
                [
                    newGroupId,
                    groupData.group_code,
                    groupData.group_name,
                    groupData.base_group,
                    groupData.group_code2,
                    groupData.group_name2,
                ]
            );
            return newGroupId;
        } else {
            // Update existing group
            const existingGroupId = existingGroup[0].group_id;

            await executeQuery(`UPDATE groups SET group_name = ?, group_code2 = ?, group_name2 = ?, 
                u_at = NOW(), u_by = 1 WHERE group_id = ?`,
                [
                    groupData.group_name,
                    groupData.group_code2,
                    groupData.group_name2,
                    existingGroupId
                ]
            );
            return existingGroupId;
        }

    }

    static findProductByExtCode = async (extCode) => {
        const rows = await executeQuery(
            'SELECT product_id, product_name, group_id FROM products WHERE ext_code = ?',  //  AND status = "A"
            [extCode]
        );
        return rows[0] || null;
    }

    static findCustomerByExtCode = async (extCode) => {
        const rows = await executeQuery(
            'SELECT customer_id FROM customers WHERE ext_code = ?', // AND status = "A" 
            [extCode]
        );
        return rows[0] || null;
    }

    static async findGroupByCode(groupCode) {
        const rows = await executeQuery(
            'SELECT group_id FROM groups WHERE group_code = ?',
            [groupCode]
        );
        return rows[0] || null;
    }

    static getImportHistory = async (req, res) => {
        try {
            const history = await executeQuery(
                `SELECT 
                    bu.bu_name,
                    s.import_batch,
                    COUNT(*) as record_count,
                    MIN(s.import_timestamp) as import_date
                FROM sap_sales s
                JOIN business_units bu ON s.bu_id = bu.bu_id
                GROUP BY bu.bu_name, s.import_batch
                ORDER BY import_date DESC
                LIMIT 20`
            );

            res.render('sap-data/import-history', {
                title: 'Import History',
                history
            });
        } catch (error) {
            console.error('Error fetching import history:', error);
            res.status(500).render('error', {
                message: 'Error loading import history'
            });
        }
    }

    static showImportDetails = async (req, res) => {
        try {
            const { importBatch, buId } = req.params;

            // If no buId provided, find the most recent one
            let effectiveBuId = buId;
            if (!effectiveBuId) {
                const mostRecentBu = await executeQuery(
                    `SELECT bu_id FROM sap_sales 
                 WHERE import_batch = ?
                 GROUP BY bu_id
                 ORDER BY COUNT(*) DESC
                 LIMIT 1`,
                    [importBatch]
                );

                if (!mostRecentBu.length) {
                    return res.status(404).render('error', {
                        message: 'No records found for this import batch'
                    });
                }

                return res.redirect(`/sap-data/import-details/${importBatch}/${mostRecentBu[0].bu_id}`);
            }

            // Get business unit info
            const [bu, records, materialGroups, totals, importDate] = await Promise.all([
                executeQuery("SELECT bu_name FROM business_units WHERE bu_id = ?", [effectiveBuId]),
                executeQuery(
                    `SELECT * FROM sap_sales 
                 WHERE import_batch = ? AND bu_id = ?
                 ORDER BY billing_date DESC, document_number`,
                    [importBatch, effectiveBuId]
                ),
                executeQuery(
                    `SELECT 
                    material_group,
                    material_group_description,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * item_price) as total_value
                 FROM sap_sales
                 WHERE import_batch = ? AND bu_id = ?
                 GROUP BY material_group, material_group_description
                 ORDER BY total_value DESC`,
                    [importBatch, effectiveBuId]
                ),
                executeQuery(
                    `SELECT 
                    SUM(quantity) as total_quantity,
                    SUM(quantity * item_price) as total_value,
                    MIN(billing_date) as min_date,
                    MAX(billing_date) as max_date
                 FROM sap_sales
                 WHERE import_batch = ? AND bu_id = ?`,
                    [importBatch, effectiveBuId]
                ),
                executeQuery(
                    `SELECT MIN(import_timestamp) as import_date
                 FROM sap_sales
                 WHERE import_batch = ? AND bu_id = ?`,
                    [importBatch, effectiveBuId]
                )
            ]);

            if (!bu.length) {
                return res.status(404).render('error', {
                    message: 'Business Unit not found'
                });
            }

            // Calculate percentages safely
            const totalValue = totals[0]?.total_value || 0;
            const materialGroupsWithPercent = materialGroups.map(group => ({
                ...group,
                percentage: totalValue > 0 ? (group.total_value / totalValue) * 100 : 0
            }));

            res.render('sap-data/import-details', {
                title: `Import Details - ${importBatch}`,
                importBatch,
                buName: bu[0].bu_name,
                importDate: importDate[0]?.import_date || new Date(),
                records: records || [],
                materialGroups: materialGroupsWithPercent,
                totalQuantity: totals[0]?.total_quantity || 0,
                totalValue,
                minDate: totals[0]?.min_date || null,
                maxDate: totals[0]?.max_date || null
            });

        } catch (error) {
            console.error('Error showing import details:', error);
            res.status(500).render('error', {
                message: 'Error loading import details'
            });
        }
    }

}

export default sapImportController;