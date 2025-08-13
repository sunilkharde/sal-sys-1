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
            console.error(`Error fetching sales data for BU ${buCode}:`, error);
            throw error;
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
                    const salesData = await this.getSalesDataFromSAP(bu.bu_code, { dateFrom, dateTo });
                    const importedCount = await this.saveSalesRecords(bu.bu_id, salesData, importBatch);

                    results.push({
                        bu_id: bu.bu_id,
                        bu_name: bu.bu_name,
                        status: 'success',
                        records_imported: importedCount,
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
                        record.materialGroup,
                        record.materialGroupDescription,
                        record.priceGroup,
                        record.priceGroupDescription,
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
}

export default sapImportController;