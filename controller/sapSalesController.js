import axios from 'axios';
import { executeQuery } from '../db.js';
import moment from 'moment';

class sapSalesController {

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
            console.error(`Error fetching sales data for BU ${buCode}:`, error);
            throw error;
        }
    }

    static showSalesProcessingPage = async (req, res) => {
        try {
            const businessUnits = await this.getAllBusinessUnits();

            res.render('sap-data/process-sap-data', {
                title: 'SAP Sales Data Processing',
                businessUnits,
                helpers: {
                    eq: function (a, b) { return a === b; }
                }
            });
        } catch (error) {
            console.error('Error showing sales processing page:', error);
            res.status(500).render('error', {
                message: 'Error loading sales processing page'
            });
        }
    }

    static processSalesDataForAllBUs = async (req, res) => {
        try {
            const { dateFrom, dateTo } = req.body;
            const businessUnits = await this.getAllBusinessUnits();
            const results = [];

            for (const bu of businessUnits) {
                try {
                    const salesData = await this.getSalesDataFromSAP(bu.bu_code, { dateFrom, dateTo });
                    const processedCount = await this.processSalesRecords(salesData);

                    results.push({
                        bu_id: bu.bu_id,
                        bu_name: bu.bu_name,
                        status: 'success',
                        records_processed: processedCount
                    });
                } catch (error) {
                    results.push({
                        bu_id: bu.bu_id,
                        bu_name: bu.bu_name,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            // res.json({
            //     success: true,
            //     message: 'Sales data processed for all business units',
            //     results
            // });
            res.render('sap-data/process-sap-data', {
                title: 'SAP Sales Data Processing',
                businessUnits,
                results,
                processed: true,
                helpers: {
                    eq: function (a, b) { return a === b; }
                }
            });
        } catch (error) {
            console.error('Error in processSalesDataForAllBUs:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing sales data',
                error: error.message
            });
        }
    }

    static processSalesRecords = async (salesData) => {
        let processedCount = 0;

        for (const record of salesData) {
            try {
                const materialNumber = record.materialNumber.replace(/^0+/, '');
                const product = await this.findProductByExtCode(materialNumber);

                if (product) {
                    const maxGroup = await executeQuery('SELECT MAX(group_id) AS max_id FROM groups');
                    const nextGroupId = maxGroup[0].max_id ? maxGroup[0].max_id + 1 : 1;

                    await this.updateGroupInformation(
                        product.group_id || nextGroupId,
                        {
                            group_code: record.materialGroup,
                            group_name: record.materialGroupDescription,
                            p_group_code: record.priceGroup,
                            p_group_name: record.priceGroupDescription
                        }
                    );

                    if (!product.group_id) {
                        await executeQuery(
                            'UPDATE products SET group_id = ? WHERE product_id = ?',
                            [nextGroupId, product.product_id]
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

    static findProductByExtCode = async (extCode) => {
        const rows = await executeQuery(
            'SELECT product_id, product_name, group_id FROM products WHERE ext_code = ? AND status = "A"',
            [extCode]
        );
        return rows[0] || null;
    }

    static updateGroupInformation = async (groupId, groupData) => {
        const existingGroup = await executeQuery(
            'SELECT group_id FROM groups WHERE group_id = ?',
            [groupId]
        );

        if (existingGroup.length === 0) {
            await executeQuery(
                `INSERT INTO groups 
                (group_id, group_code, group_name, group_short, seq_sr, status, p_group_code, p_group_name) 
                VALUES (?, ?, ?, ?, 1, "A", ?, ?)`,
                [
                    groupId,
                    groupData.group_code,
                    groupData.group_name,
                    groupData.group_name.substring(0, 20),
                    groupData.p_group_code,
                    groupData.p_group_name
                ]
            );
        } else {
            await executeQuery(
                `UPDATE groups 
                SET group_code = ?, group_name = ?, p_group_code = ?, p_group_name = ? 
                WHERE group_id = ?`,
                [
                    groupData.group_code,
                    groupData.group_name,
                    groupData.p_group_code,
                    groupData.p_group_name,
                    groupId
                ]
            );
        }
    }
}

export default sapSalesController;