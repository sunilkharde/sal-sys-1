import { executeQuery } from '../db.js';
import { promisify } from 'util';
import fs from 'fs';
const appendFile = promisify(fs.appendFile);
import { join } from 'path';
import moment from 'moment';
import multer from 'multer';
import xlsx from 'xlsx';
import csv from 'fast-csv';
import dotenv from 'dotenv';

import mysql from 'mysql2';

dotenv.config();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


class custTargetController {

    static getData = async (req, user) => {
        try {
            const sqlCust = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area," +
                " a.ext_code,a.customer_type,a.mg_id,CONCAT(c.first_name,' ',c.middle_name,' ',c.last_name) as mg_name" +
                " From customers as a " +
                " LEFT JOIN market_area as b ON (a.market_area_id=b.market_area_id) " +
                " LEFT JOIN employees as c ON (a.mg_id=c.emp_id)"
            // const paramsCust = [xyz];
            const customer_list = await executeQuery(sqlCust) //, params);

            return [customer_list];

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static getSeData = async (req, res) => {
        try {
            const { mg_id } = req.query;

            const sqlStr = "Select a.emp_id, CONCAT(a.last_name,' ',a.first_name,' ',a.middle_name) as emp_name," +
                " a.desg_id,b.desg_name,a.hq_id,c.hq_name,a.off_day," +
                " a.boss_id, CONCAT(d.last_name,' ',d.first_name,' ',d.middle_name) as boss_name" +
                " FROM employees as a, designations as b, hqs as c, employees as d" +
                " Where a.desg_id=b.desg_id and a.hq_id=c.hq_id and a.boss_id=d.emp_id and a.status='A' and a.boss_id=?"
            const params = [mg_id];
            const empList = await executeQuery(sqlStr, params);

            res.json({ se_list: empList });

        } catch (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }

    static view = async (req, res) => {
        try {
            const alert = req.query.alert;
            const { customer_id, year_select, mg_name } = req.query;
            const { customer_list } = await this.getData(req, res.locals.user);

            const currentYear = moment().year();
            let startYear, endYear;
            const years = Array.from({ length: 2 }, (_, index) => {
                startYear = currentYear - index;
                endYear = startYear + 1;
                return `${startYear}-${endYear}`;
            });

            let startDate, endDate;
            if (!year_select) {
                const currentMonth = moment().month() + 1;
                startYear = currentMonth <= 3 ? currentYear - 1 : currentYear;
                endYear = startYear + 1;

                startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
                endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');
            } else {
                [startYear, endYear] = year_select.split('-').map(Number);
                startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
                endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');
            }

            let targetData = null;
            let paramsTarget = null;

            const sqlTarget = "SELECT e.seq_sr,a.customer_id,b.customer_name,b.nick_name,CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
                " d.bu_id,d.bu_code,CONCAT(d.bu_code, '-', d.bu_short) AS bu_name,e.group_id,e.group_name," +
                " SUM(CASE WHEN MONTH(a.target_date) = 4 THEN a.target_value END) as apr1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 5 THEN a.target_value END) AS may1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 6 THEN a.target_value END) AS jun1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 7 THEN a.target_value END) AS jul1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 8 THEN a.target_value END) AS aug1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 9 THEN a.target_value END) AS sep1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 10 THEN a.target_value END) AS oct1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 11 THEN a.target_value END) AS nov1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 12 THEN a.target_value END) AS dec1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 1 THEN a.target_value END) AS jan1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 2 THEN a.target_value END) AS feb1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 3 THEN a.target_value END) AS mar1," +
                " SUM(a.target_value) AS total" +
                " FROM cust_target as a" +
                " JOIN customers AS b ON a.customer_id = b.customer_id" +
                " JOIN customers_bu AS c ON a.customer_id = c.customer_id and a.bu_id = c.bu_id" +
                " JOIN business_units AS d ON c.bu_id = d.bu_id" +
                " JOIN groups e ON a.group_id = e.group_id" +
                " WHERE a.customer_id = ? and a.target_date BETWEEN ? and ?" +
                " GROUP BY e.seq_sr, a.customer_id,b.customer_name,b.nick_name,CONCAT(b.city, ' ', b.pin_code),d.bu_id,d.bu_code," +
                " CONCAT(d.bu_code, '-', d.bu_short),e.group_id,e.group_name" +
                " UNION " +
                " SELECT e.seq_sr, a.customer_id, a.customer_name, a.nick_name, CONCAT(a.city, ' ', a.pin_code) AS city_pin," +
                " c.bu_id, d.bu_code, CONCAT(d.bu_code, '-', d.bu_short) AS bu_name, e.group_id, e.group_name," +
                " 0 AS apr1, 0 AS may1, 0 AS jun1, 0 AS jul1, 0 AS aug1, 0 AS sep1, 0 AS oct1, 0 AS nov1, 0 AS dec1," +
                " 0 AS jan1, 0 AS feb1, 0 AS mar1, 0 AS total " +
                " FROM customers AS a  " +
                " LEFT JOIN customers_bu AS c ON a.customer_id = c.customer_id " +
                " LEFT JOIN business_units AS d ON c.bu_id = d.bu_id " +
                " LEFT JOIN products_bu g ON c.bu_id = g.bu_id  " +
                " LEFT JOIN products f ON g.product_id = f.product_id  " +
                " LEFT JOIN groups e ON f.group_id = e.group_id  " +
                " WHERE e.group_id >= 0 and a.customer_id = ?" +
                " and e.group_id Not IN (SELECT x.group_id FROM cust_target as x WHERE x.customer_id = ? and x.target_date BETWEEN ? and ?)" +
                " GROUP BY e.seq_sr, a.customer_id, a.customer_name, a.nick_name, CONCAT(a.city, ' ', a.pin_code), " +
                " c.bu_id, d.bu_code, CONCAT(d.bu_code, '-', d.bu_short), e.group_id, e.group_name" +
                " ORDER BY `seq_sr` ASC, `group_name` ASC"

            paramsTarget = [customer_id, startDate, endDate, customer_id, customer_id, startDate, endDate];
            targetData = await executeQuery(sqlTarget, paramsTarget);

            // console.log('Target Val: ' + targetData[0].apr1 )
            // console.log('sql...' + sqlTarget)

            // if (targetData.length === 0) {
            //     // const sqlTarget = "SELECT a.customer_id, a.customer_name, a.nick_name, CONCAT(a.city, ' ', a.pin_code) AS city_pin," +
            //     //     " d.bu_id, d.bu_code, CONCAT(d.bu_code, '-', d.bu_short) AS bu_name, e.group_id, e.group_name," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 4 THEN b.target_value END) AS apr1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 5 THEN b.target_value END) AS may1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 6 THEN b.target_value END) AS jun1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 7 THEN b.target_value END) AS jul1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 8 THEN b.target_value END) AS aug1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 9 THEN b.target_value END) AS sep1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 10 THEN b.target_value END) AS oct1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 11 THEN b.target_value END) AS nov1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 12 THEN b.target_value END) AS dec1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 1 THEN b.target_value END) AS jan1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 2 THEN b.target_value END) AS feb1," +
            //     //     " SUM(CASE WHEN MONTH(b.target_date) = 3 THEN b.target_value END) AS mar1," +
            //     //     " SUM(b.target_value) AS total" +
            //     //     " FROM customers AS a " +
            //     //     " LEFT JOIN cust_target AS b ON a.customer_id = b.customer_id" +
            //     //     " LEFT JOIN customers_bu AS c ON a.customer_id = c.customer_id" +
            //     //     " LEFT JOIN business_units AS d ON c.bu_id = d.bu_id" +
            //     //     " LEFT JOIN products_bu g ON c.bu_id = g.bu_id " +
            //     //     " LEFT JOIN products f ON g.product_id = f.product_id " +
            //     //     " LEFT JOIN groups e ON f.group_id = e.group_id " +
            //     //     " WHERE e.group_id IS NOT NULL and a.customer_id = ? AND (b.target_date BETWEEN ? AND ? OR b.target_date IS NULL)" +
            //     //     " GROUP BY a.customer_id, a.customer_name, a.nick_name, CONCAT(a.city, ' ', a.pin_code), b.bu_id, d.bu_code, CONCAT(d.bu_code, '-', d.bu_short), e.group_id, e.group_name;";
            //     // paramsTarget = [customer_id, startDate, endDate];
            //     // targetData = await executeQuery(sqlTarget, paramsTarget);
            // }

            const custData = targetData.length > 0
                ? { customer_id, customer_name: targetData[0].customer_name, mg_name }
                : { customer_id: 0, customer_name: '-- Select --', mg_name: '' };

            res.render('custTarget/custTarget-view', { alert, customer_list, custData, year_select, years, targetData });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static save = async (req, res) => {
        const { year_select, customer_id, customer_name, mg_name, bu_id, group_id, bu_name, group_name,
            apr1, may1, jun1, jul1, aug1, sep1, oct1, nov1, dec1, jan1, feb1, mar1, total } = req.body;
        const { customer_list } = await this.getData(req, res.locals.user);

        const startDate = moment(`${year_select.split('-')[0]}-04-01`).format('YYYY-MM-DD');
        const endDate = moment(`${year_select.split('-')[1]}-03-31`).format('YYYY-MM-DD');

        if (apr1 === undefined || apr1 === null) {
            const custData = { customer_id, customer_name, mg_name };
            const currentYear = moment().year();
            const years = Array.from({ length: 2 }, (_, index) => {
                const startYear = currentYear - index;
                const endYear = startYear + 1;
                return `${startYear}-${endYear}`;
            });
            const errors = [{ message: 'No data found for save!' }];
            return res.render('custTarget/custTarget-view', { errors, customer_list, year_select, years });
        }

        const bu_idVal = Array.isArray(bu_id) ? bu_id : [bu_id];
        const group_idVal = Array.isArray(group_id) ? group_id : [group_id];
        const bu_nameVal = Array.isArray(bu_name) ? bu_name : [bu_name];
        const group_nameVal = Array.isArray(group_name) ? group_name : [group_name];
        const apr1Val = Array.isArray(apr1) ? apr1 : [apr1];
        const may1Val = Array.isArray(may1) ? may1 : [may1];
        const jun1Val = Array.isArray(jun1) ? jun1 : [jun1];
        const jul1Val = Array.isArray(jul1) ? jul1 : [jul1];
        const aug1Val = Array.isArray(aug1) ? aug1 : [aug1];
        const sep1Val = Array.isArray(sep1) ? sep1 : [sep1];
        const oct1Val = Array.isArray(oct1) ? oct1 : [oct1];
        const nov1Val = Array.isArray(nov1) ? nov1 : [nov1];
        const dec1Val = Array.isArray(dec1) ? dec1 : [dec1];
        const jan1Val = Array.isArray(jan1) ? jan1 : [jan1];
        const feb1Val = Array.isArray(feb1) ? feb1 : [feb1];
        const mar1Val = Array.isArray(mar1) ? mar1 : [mar1];
        const totalVal = Array.isArray(total) ? total : [total];

        //************ */
        const targetData = apr1.map((sr, i) => ({
            bu_id: bu_idVal[i],
            group_id: group_idVal[i],
            bu_name: bu_nameVal[i],
            group_name: group_nameVal[i],
            apr1: apr1Val[i],
            may1: may1Val[i],
            jun1: jun1Val[i],
            jul1: jul1Val[i],
            aug1: aug1Val[i],
            sep1: sep1Val[i],
            oct1: oct1Val[i],
            nov1: nov1Val[i],
            dec1: dec1Val[i],
            jan1: jan1Val[i],
            feb1: feb1Val[i],
            mar1: mar1Val[i],
        }));
        //************ */

        const errors = [];
        if (!year_select) {
            errors.push({ message: 'Select period for target entry' });
        }
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (errors.length) {
            const custData = { customer_id, customer_name, mg_name };
            const currentYear = moment().year();
            const years = Array.from({ length: 2 }, (_, index) => {
                const startYear = currentYear - index;
                const endYear = startYear + 1;
                return `${startYear}-${endYear}`;
            });
            return res.render('custTarget/custTarget-view', { errors, customer_list, custData, year_select, years, targetData });
        }

        try {
            const c_by = res.locals.user ? res.locals.user.user_id : 0;

            const sqlTargetDelete = "DELETE FROM cust_target WHERE target_date BETWEEN ? AND ? AND customer_id=?";
            const paramsTargetDelete = [startDate, endDate, customer_id];
            await executeQuery(sqlTargetDelete, paramsTargetDelete);

            let targetValue = null;
            for (let i = 0; i < apr1.length; i++) {
                let targetDate = new Date(startDate);
                if (totalVal[i] > 0) {

                    for (let j = 1; j <= 12; j++) {
                        if (j === 1) {
                            targetValue = apr1Val[i]
                        } else if (j === 2) {
                            targetValue = may1Val[i]
                        } else if (j === 3) {
                            targetValue = jun1Val[i]
                        } else if (j === 4) {
                            targetValue = jul1Val[i]
                        } else if (j === 5) {
                            targetValue = aug1Val[i]
                        } else if (j === 6) {
                            targetValue = sep1Val[i]
                        } else if (j === 7) {
                            targetValue = oct1Val[i]
                        } else if (j === 8) {
                            targetValue = nov1Val[i]
                        } else if (j === 9) {
                            targetValue = dec1Val[i]
                        } else if (j === 10) {
                            targetValue = jan1Val[i]
                        } else if (j === 11) {
                            targetValue = feb1Val[i]
                        } else if (j === 12) {
                            targetValue = mar1Val[i]
                        }

                        const sqlTargetAdd = "INSERT INTO cust_target (customer_id, bu_id, group_id, target_date, target_value, c_at, c_by)" +
                            " VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(),?)"
                        const paramsTargetAdd = [customer_id, bu_idVal[i], group_idVal[i], targetDate, targetValue, c_by]; //.format('YYYY-MM-DD')
                        await executeQuery(sqlTargetAdd, paramsTargetAdd);

                        targetDate.setMonth(targetDate.getMonth() + 1);
                    }
                }
            }

            res.redirect('/custTarget/view?alert=Target+added+successfully');

        } catch (err) {
            console.error(err);
            return res.render('custTarget/custTarget-view', { alert: `Internal server error` });
        }
    };

    static delete = async (req, res) => {
        const { customer_id, year_select, mg_name } = req.query;

        try {
            let startDate, endDate;
            const [startYear, endYear] = year_select.split('-').map(Number);
            startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
            endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');

            // var errors = [];
            // const sqlStr1 = "Select * from cust_target Where customer_id=? and target_date Between ? and ?"
            // const params1 = [customer_id, startDate, endDate];
            // const rows = await executeQuery(sqlStr1, params1);
            // if (rows.length > 0) {
            //     errors.push({ message: "Reference exist, master entry can't delete" });
            // }
            // if (errors.length) {
            //     res.redirect(`/custTarget/view?${errors.map(error => `alert=${error.message}`).join('&')}`);
            //     return;
            // }

            const sqlStr = "Delete from cust_target WHERE customer_id=? and target_date Between ? and ?"
            const params = [customer_id, startDate, endDate];
            await executeQuery(sqlStr, params);

            res.redirect('/custTarget/view?alert=Target+removed+successfully');

        } catch (err) {
            console.error(err);
            return res.render('custTarget/custTarget-view', { alert: `Internal server error` });
        }
    };



    static targetImport = async (req, res) => {
        try {
            const alert = req.query.alert || req.query.error || req.query.success;
            res.render('custTarget/custTarget-upload', alert ? { alert } : {});
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    static async logToTxt(logData) {
        const logFileName = 'ImportDataLogs.txt';
        const logFilePath = join(process.cwd(), 'logs', logFileName);

        const timestamp = moment().format('DD-MMM-YYYY HH:mm');
        const logRow = `${timestamp} - ${logData}`;

        try {
            await appendFile(logFilePath, logRow + '\n');
            // console.log('Record added to log file.');
        } catch (err) {
            console.error('Error writing to log file:', err);
        }
    }

    static targetUpload = async (req, res) => {
        try {
            if (!req.file) {
                req.flash('error', 'No file uploaded.');
                return res.redirect('/custTarget/upload');
            }

            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const targetDataFromExcel = xlsx.utils.sheet_to_json(sheet);

            // Find column names (case insensitive)
            const sap_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'sap code');
            const bu_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'bu code');
            const group_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'group code');
            const yearColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'year');
            const monthColumns = {
                apr: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'apr'),
                may: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'may'),
                jun: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jun'),
                jul: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jul'),
                aug: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'aug'),
                sep: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'sep'),
                oct: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'oct'),
                nov: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'nov'),
                dec: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'dec'),
                jan: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jan'),
                feb: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'feb'),
                mar: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'mar')
            };

            // Validate required columns
            if (!sap_codeColumn || !bu_codeColumn || !group_codeColumn || !yearColumn ||
                Object.values(monthColumns).some(col => !col)) {
                return res.status(400).send("Required columns are missing. Please ensure the file contains: 'SAP Code', 'BU Code', 'Group Code', 'Year', and all month columns.");
            }

            const c_by = res.locals.user?.user_id || 0;
            const errorLog = [];
            const excelTargets = [];
            let skippedRecords = 0;
            const inputRecordsMap = new Map(); // To track duplicates within the input file

            // Process each row in the Excel file
            for (let i = 0; i < targetDataFromExcel.length; i++) {
                const targetRow = targetDataFromExcel[i];
                const sapCode = targetRow[sap_codeColumn];
                const buCode = targetRow[bu_codeColumn];
                const groupCode = targetRow[group_codeColumn];
                const year = targetRow[yearColumn];

                try {
                    // Validate required fields
                    if (!sapCode || !buCode || !groupCode || !year) {
                        errorLog.push(`Row ${i + 1}: Missing required field (SAP: ${sapCode}, BU: ${buCode}, Group: ${groupCode}, Year: ${year})`);
                        skippedRecords++;
                        continue;
                    }

                    // Calculate total target for the year (Apr-Mar)
                    let yearlyTotal = 0;
                    for (const [month, colName] of Object.entries(monthColumns)) {
                        const targetValue = parseFloat(targetRow[colName]) || 0;
                        yearlyTotal += targetValue;
                    }

                    // Skip if yearly total is 0 or less
                    if (yearlyTotal <= 0) {
                        errorLog.push(`Row ${i + 1}: Skipped - Yearly target total is 0 or less for SAP: ${sapCode}, BU: ${buCode}, Group: ${groupCode}`);
                        skippedRecords++;
                        continue;
                    }

                    // Get customer, BU, and group data
                    const [custData, buData, groupData] = await Promise.all([
                        executeQuery(`SELECT * FROM customers WHERE ext_code = ?`, [sapCode]),
                        executeQuery(`SELECT * FROM business_units WHERE bu_code = ?`, [buCode]),
                        executeQuery(`SELECT * FROM groups WHERE group_code = ?`, [groupCode])
                    ]);

                    // Check for invalid references
                    if (custData.length === 0) {
                        errorLog.push(`Row ${i + 1}: Invalid SAP Code - ${sapCode}`);
                        skippedRecords++;
                        continue;
                    }
                    if (buData.length === 0) {
                        errorLog.push(`Row ${i + 1}: Invalid BU Code - ${buCode}`);
                        skippedRecords++;
                        continue;
                    }
                    if (groupData.length === 0) {
                        errorLog.push(`Row ${i + 1}: Invalid Group Code - ${groupCode}`);
                        skippedRecords++;
                        continue;
                    }

                    // Process monthly targets
                    const startDate = moment(`${year.split('-')[0]}-04-01`);
                    for (const [month, colName] of Object.entries(monthColumns)) {
                        const targetValue = targetRow[colName] || 0;
                        const targetDate = new Date(startDate);

                        // Adjust month (April is month 3 in JavaScript Date)
                        if (month === 'apr') targetDate.setMonth(3);
                        else if (month === 'may') targetDate.setMonth(4);
                        else if (month === 'jun') targetDate.setMonth(5);
                        else if (month === 'jul') targetDate.setMonth(6);
                        else if (month === 'aug') targetDate.setMonth(7);
                        else if (month === 'sep') targetDate.setMonth(8);
                        else if (month === 'oct') targetDate.setMonth(9);
                        else if (month === 'nov') targetDate.setMonth(10);
                        else if (month === 'dec') targetDate.setMonth(11);
                        else if (month === 'jan') {
                            targetDate.setFullYear(targetDate.getFullYear() + 1);
                            targetDate.setMonth(0);
                        }
                        else if (month === 'feb') {
                            targetDate.setFullYear(targetDate.getFullYear() + 1);
                            targetDate.setMonth(1);
                        }
                        else if (month === 'mar') {
                            targetDate.setFullYear(targetDate.getFullYear() + 1);
                            targetDate.setMonth(2);
                        }

                        const formattedDate = moment(targetDate).format('YYYY-MM-DD');
                        const recordKey = `${custData[0].customer_id}-${buData[0].bu_id}-${groupData[0].group_id}-${formattedDate}`;

                        // Check for duplicates within the input file
                        if (inputRecordsMap.has(recordKey)) {
                            errorLog.push(`Row ${i + 1}: Duplicate target in input file for ${sapCode}, ${buCode}, ${groupCode}, ${formattedDate}`);
                            skippedRecords++;
                            continue;
                        }

                        inputRecordsMap.set(recordKey, true);

                        excelTargets.push({
                            customer_id: custData[0].customer_id,
                            bu_id: buData[0].bu_id,
                            group_id: groupData[0].group_id,
                            target_date: targetDate,
                            target_value: targetValue,
                            ext_code: sapCode,
                            bu_code: buCode,
                            group_code: groupCode,
                            recordKey: recordKey
                        });
                    }
                } catch (err) {
                    errorLog.push(`Row ${i + 1}: Error processing - ${err.message}`);
                    skippedRecords++;
                    continue;
                }
            }

            // Check if we have any valid targets to process
            if (excelTargets.length === 0) {
                const message = skippedRecords > 0 ?
                    'No valid targets found in the file. All records had errors or zero yearly totals.' :
                    'No target data found in the file.';

                console.error('Upload Errors:', errorLog);
                return res.redirect('/custTarget/upload?error=' + encodeURIComponent(message));
            }

            // Check for existing targets in database - now in batches
            const BATCH_SIZE = 100;
            const existingTargets = [];
            const newTargets = [];

            for (let i = 0; i < excelTargets.length; i += BATCH_SIZE) {
                const batch = excelTargets.slice(i, i + BATCH_SIZE);
                const batchKeys = batch.map(t => [
                    t.customer_id,
                    t.bu_id,
                    t.group_id,
                    moment(t.target_date).format('YYYY-MM-DD')
                ]);

                try {
                    const batchExisting = await executeQuery(`
                SELECT customer_id, bu_id, group_id, target_date 
                FROM cust_target 
                WHERE (customer_id, bu_id, group_id, target_date) IN (?)
            `, [batchKeys]);

                    const existingKeys = new Set(
                        batchExisting.map(t =>
                            `${t.customer_id}-${t.bu_id}-${t.group_id}-${moment(t.target_date).format('YYYY-MM-DD')}`
                        )
                    );

                    // Filter out duplicates
                    batch.forEach(t => {
                        if (existingKeys.has(t.recordKey)) {
                            existingTargets.push(t);
                        } else {
                            newTargets.push(t);
                        }
                    });

                } catch (err) {
                    console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, err);
                    // Mark all records in this batch as errors
                    batch.forEach(t => {
                        errorLog.push(`Record ${t.ext_code}, ${t.bu_code}, ${t.group_code}, ${moment(t.target_date).format('YYYY-MM-DD')}: Error checking existence - ${err.message}`);
                        skippedRecords++;
                    });
                }
            }

            // Insert new targets in batches
            let addedCount = 0;
            if (newTargets.length > 0) {
                for (let i = 0; i < newTargets.length; i += BATCH_SIZE) {
                    const batch = newTargets.slice(i, i + BATCH_SIZE);
                    const values = batch.map(t => [
                        t.customer_id,
                        t.bu_id,
                        t.group_id,
                        moment(t.target_date).format('YYYY-MM-DD'),
                        t.target_value,
                        moment().format('YYYY-MM-DD HH:mm:ss'), // current timestamp
                        c_by
                    ]);

                    try {
                        await executeQuery(
                            "INSERT INTO cust_target (customer_id, bu_id, group_id, target_date, target_value, c_at, c_by) VALUES ?",
                            [values]
                        );
                        addedCount += batch.length;
                    } catch (err) {
                        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, err);
                        // Add all records in this batch to error log
                        batch.forEach(t => {
                            errorLog.push(`Record ${t.ext_code}, ${t.bu_code}, ${t.group_code}, ${moment(t.target_date).format('YYYY-MM-DD')}: Insert failed - ${err.message}`);
                            skippedRecords++;
                        });
                    }
                }
            }

            // Log results
            const resultMessage = `Processed ${targetDataFromExcel.length} rows. ` +
                `Added ${addedCount} targets, skipped ${skippedRecords} rows with errors or zero yearly totals, ` +
                `${existingTargets.length} duplicates found in database.`;

            console.log(resultMessage);
            // if (errorLog.length > 0) {
            //     console.error('Detailed Errors:', errorLog);
            // }

            // return res.redirect('/custTarget/upload?success=' + encodeURIComponent(resultMessage));

            // Return response
            res.status(200).json({
                success: true,
                message: resultMessage,
                added: addedCount,
                skipped: skippedRecords,
                duplicates: existingTargets.length,
                errors: errorLog.length > 0 ? errorLog : undefined
            });

        } catch (error) {
            console.error('Upload Failed:', error);
            return res.redirect('/custTarget/upload?error=' + encodeURIComponent(error.message));
        }
    };

    static targetUpload_old2 = async (req, res) => {
        try {
            if (!req.file) {
                req.flash('error', 'No file uploaded.');
                return res.redirect('/custTarget/upload');
            }

            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const targetDataFromExcel = xlsx.utils.sheet_to_json(sheet);

            // Find column names (case insensitive)
            const sap_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'sap code');
            const bu_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'bu code');
            const group_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'group code');
            const yearColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'year');
            const monthColumns = {
                apr: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'apr'),
                may: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'may'),
                jun: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jun'),
                jul: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jul'),
                aug: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'aug'),
                sep: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'sep'),
                oct: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'oct'),
                nov: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'nov'),
                dec: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'dec'),
                jan: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jan'),
                feb: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'feb'),
                mar: Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'mar')
            };

            // Validate required columns
            if (!sap_codeColumn || !bu_codeColumn || !group_codeColumn || !yearColumn ||
                Object.values(monthColumns).some(col => !col)) {
                return res.status(400).send("Required columns are missing. Please ensure the file contains: 'SAP Code', 'BU Code', 'Group Code', 'Year', and all month columns.");
            }

            const c_by = res.locals.user?.user_id || 0;
            const errorLog = [];
            const excelTargets = [];
            let skippedRecords = 0;
            const inputRecordsMap = new Map(); // To track duplicates within the input file

            // Process each row in the Excel file
            for (let i = 0; i < targetDataFromExcel.length; i++) {
                const targetRow = targetDataFromExcel[i];
                const sapCode = targetRow[sap_codeColumn];
                const buCode = targetRow[bu_codeColumn];
                const groupCode = targetRow[group_codeColumn];
                const year = targetRow[yearColumn];

                try {
                    // Validate required fields
                    if (!sapCode || !buCode || !groupCode || !year) {
                        errorLog.push(`Row ${i + 1}: Missing required field (SAP: ${sapCode}, BU: ${buCode}, Group: ${groupCode}, Year: ${year})`);
                        skippedRecords++;
                        continue;
                    }

                    // Get customer, BU, and group data
                    const [custData, buData, groupData] = await Promise.all([
                        executeQuery(`SELECT * FROM customers WHERE ext_code = ?`, [sapCode]),
                        executeQuery(`SELECT * FROM business_units WHERE bu_code = ?`, [buCode]),
                        executeQuery(`SELECT * FROM groups WHERE group_code = ?`, [groupCode])
                    ]);

                    // Check for invalid references
                    if (custData.length === 0) {
                        errorLog.push(`Row ${i + 1}: Invalid SAP Code - ${sapCode}`);
                        skippedRecords++;
                        continue;
                    }
                    if (buData.length === 0) {
                        errorLog.push(`Row ${i + 1}: Invalid BU Code - ${buCode}`);
                        skippedRecords++;
                        continue;
                    }
                    if (groupData.length === 0) {
                        errorLog.push(`Row ${i + 1}: Invalid Group Code - ${groupCode}`);
                        skippedRecords++;
                        continue;
                    }

                    // Process monthly targets
                    const startDate = moment(`${year.split('-')[0]}-04-01`);
                    for (const [month, colName] of Object.entries(monthColumns)) {
                        const targetValue = targetRow[colName] || 0;
                        const targetDate = new Date(startDate);

                        // Adjust month (April is month 3 in JavaScript Date)
                        if (month === 'apr') targetDate.setMonth(3);
                        else if (month === 'may') targetDate.setMonth(4);
                        else if (month === 'jun') targetDate.setMonth(5);
                        else if (month === 'jul') targetDate.setMonth(6);
                        else if (month === 'aug') targetDate.setMonth(7);
                        else if (month === 'sep') targetDate.setMonth(8);
                        else if (month === 'oct') targetDate.setMonth(9);
                        else if (month === 'nov') targetDate.setMonth(10);
                        else if (month === 'dec') targetDate.setMonth(11);
                        else if (month === 'jan') {
                            targetDate.setFullYear(targetDate.getFullYear() + 1);
                            targetDate.setMonth(0);
                        }
                        else if (month === 'feb') {
                            targetDate.setFullYear(targetDate.getFullYear() + 1);
                            targetDate.setMonth(1);
                        }
                        else if (month === 'mar') {
                            targetDate.setFullYear(targetDate.getFullYear() + 1);
                            targetDate.setMonth(2);
                        }

                        const formattedDate = moment(targetDate).format('YYYY-MM-DD');
                        const recordKey = `${custData[0].customer_id}-${buData[0].bu_id}-${groupData[0].group_id}-${formattedDate}`;

                        // Check for duplicates within the input file
                        if (inputRecordsMap.has(recordKey)) {
                            errorLog.push(`Row ${i + 1}: Duplicate target in input file for ${sapCode}, ${buCode}, ${groupCode}, ${formattedDate}`);
                            skippedRecords++;
                            continue;
                        }

                        inputRecordsMap.set(recordKey, true);

                        excelTargets.push({
                            customer_id: custData[0].customer_id,
                            bu_id: buData[0].bu_id,
                            group_id: groupData[0].group_id,
                            target_date: targetDate,
                            target_value: targetValue,
                            ext_code: sapCode,
                            bu_code: buCode,
                            group_code: groupCode,
                            recordKey: recordKey
                        });
                    }
                } catch (err) {
                    errorLog.push(`Row ${i + 1}: Error processing - ${err.message}`);
                    skippedRecords++;
                    continue;
                }
            }

            // Check if we have any valid targets to process
            if (excelTargets.length === 0) {
                const message = skippedRecords > 0 ?
                    'No valid targets found in the file. All records had errors.' :
                    'No target data found in the file.';

                console.error('Upload Errors:', errorLog);
                return res.status(400).json({
                    success: false,
                    message,
                    errors: errorLog
                });
            }

            // Check for existing targets in database - now in batches
            const BATCH_SIZE = 100;
            const existingTargets = [];
            const newTargets = [];

            for (let i = 0; i < excelTargets.length; i += BATCH_SIZE) {
                const batch = excelTargets.slice(i, i + BATCH_SIZE);
                const batchKeys = batch.map(t => [
                    t.customer_id,
                    t.bu_id,
                    t.group_id,
                    moment(t.target_date).format('YYYY-MM-DD')
                ]);

                try {
                    const batchExisting = await executeQuery(`
                    SELECT customer_id, bu_id, group_id, target_date 
                    FROM cust_target 
                    WHERE (customer_id, bu_id, group_id, target_date) IN (?)
                `, [batchKeys]);

                    const existingKeys = new Set(
                        batchExisting.map(t =>
                            `${t.customer_id}-${t.bu_id}-${t.group_id}-${moment(t.target_date).format('YYYY-MM-DD')}`
                        )
                    );

                    // Filter out duplicates
                    batch.forEach(t => {
                        if (existingKeys.has(t.recordKey)) {
                            existingTargets.push(t);
                        } else {
                            newTargets.push(t);
                        }
                    });

                } catch (err) {
                    console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, err);
                    // Mark all records in this batch as errors
                    batch.forEach(t => {
                        errorLog.push(`Record ${t.ext_code}, ${t.bu_code}, ${t.group_code}, ${moment(t.target_date).format('YYYY-MM-DD')}: Error checking existence - ${err.message}`);
                        skippedRecords++;
                    });
                }
            }

            // console.log(`Found ${existingTargets.length} existing targets, ${newTargets.length} new targets to insert.`);

            // Insert new targets in batches
            let addedCount = 0;
            if (newTargets.length > 0) {
                for (let i = 0; i < newTargets.length; i += BATCH_SIZE) {
                    const batch = newTargets.slice(i, i + BATCH_SIZE);
                    const values = batch.map(t => [
                        t.customer_id,
                        t.bu_id,
                        t.group_id,
                        moment(t.target_date).format('YYYY-MM-DD'),
                        t.target_value,
                        moment().format('YYYY-MM-DD HH:mm:ss'), // current timestamp
                        c_by
                    ]);

                    try {
                        await executeQuery(
                            "INSERT INTO cust_target (customer_id, bu_id, group_id, target_date, target_value, c_at, c_by) VALUES ?",
                            [values]
                        );
                        addedCount += batch.length;
                    } catch (err) {
                        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, err);
                        // Add all records in this batch to error log
                        batch.forEach(t => {
                            errorLog.push(`Record ${t.ext_code}, ${t.bu_code}, ${t.group_code}, ${moment(t.target_date).format('YYYY-MM-DD')}: Insert failed - ${err.message}`);
                            skippedRecords++;
                        });
                    }
                }
            }

            // Log results
            const resultMessage = `Processed ${targetDataFromExcel.length} rows. ` +
                `Added ${addedCount} targets, skipped ${skippedRecords} rows with errors, ` +
                `${existingTargets.length} duplicates found in database.`;

            console.log(resultMessage);
            // if (errorLog.length > 0) {
            //     console.error('Detailed Errors:', errorLog);
            // }

            return res.redirect('/custTarget/upload?success=' + encodeURIComponent(resultMessage));
            // return res.redirect('/custTarget/upload?alert=' + encodeURIComponent(resultMessage));
            // return res.redirect('/custTarget/upload?alert=Target+added+successfully');

            // // Return response
            // res.status(200).json({
            //     success: true,
            //     message: resultMessage,
            //     added: addedCount,
            //     skipped: skippedRecords,
            //     duplicates: existingTargets.length,
            //     errors: errorLog.length > 0 ? errorLog : undefined
            // });

        } catch (error) {
            console.error('Upload Failed:', error);
            return res.redirect('/custTarget/upload?error=' + encodeURIComponent(error.message));
            // res.status(500).json({
            //     success: false,
            //     message: 'Internal Server Error',
            //     error: error.message
            // });
        }
    };

    static targetUpload_old = async (req, res) => {
        const invalidTargetList = [];
        try {
            if (!req.file) {
                return res.status(400).send('No file uploaded.');
            }
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const targetDataFromExcel = xlsx.utils.sheet_to_json(sheet);

            const sap_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'sap code');
            const bu_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'bu code');
            const group_codeColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'group code');
            const yearColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'year');
            const aprColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'apr');
            const mayColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'may');
            const junColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jun');
            const julColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jul');
            const augColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'aug');
            const sepColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'sep');
            const octColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'oct');
            const novColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'nov');
            const decColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'dec');
            const janColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'jan');
            const febColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'feb');
            const marColumn = Object.keys(targetDataFromExcel[0]).find(key => key.toLowerCase() === 'mar');

            if (!sap_codeColumn || !bu_codeColumn || !group_codeColumn || !yearColumn || !aprColumn || !mayColumn || !junColumn ||
                !julColumn || !augColumn || !sepColumn || !octColumn || !novColumn || !decColumn || !janColumn || !febColumn || !marColumn) {
                return res.status(400).send("Column with title 'SAP Code','BU Code','Group Code','Year','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb' and 'Mar' is required.");
            }

            var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;

            for (let i = 0; i < targetDataFromExcel.length; i++) {
                const targetRow = targetDataFromExcel[i];

                // console.log(`Processing row ${i + 1}:`, targetRow);

                const startDate = moment(`${targetRow[yearColumn].split('-')[0]}-04-01`).format('YYYY-MM-DD');
                const endDate = moment(`${targetRow[yearColumn].split('-')[1]}-03-31`).format('YYYY-MM-DD');

                // const custData = await executeQuery(`Select * FROM customers Where ext_code=${targetRow[sap_codeColumn]}`);
                // const buData = await executeQuery(`Select * FROM business_units Where bu_code=${targetRow[bu_codeColumn]}`);
                // const groupData = await executeQuery(`Select * FROM groups Where group_code=${targetRow[group_codeColumn]}`);

                // To these (with proper parameterized queries):
                const custData = await executeQuery(`Select * FROM customers Where ext_code=?`, [targetRow[sap_codeColumn]]);
                const buData = await executeQuery(`Select * FROM business_units Where bu_code=?`, [targetRow[bu_codeColumn]]);
                const groupData = await executeQuery(`Select * FROM groups Where group_code=?`, [targetRow[group_codeColumn]]);

                if (custData.length > 0 && buData.length > 0 && groupData.length > 0) {

                    // console.log('Customer, BU, and Group data found:', custData[0], buData[0], groupData[0]);

                    const targetAllowSql = " SELECT a.* " +
                        " FROM customers AS a  " +
                        " LEFT JOIN customers_bu AS c ON a.customer_id = c.customer_id " +
                        " LEFT JOIN business_units AS d ON c.bu_id = d.bu_id " +
                        " LEFT JOIN products_bu g ON c.bu_id = g.bu_id  " +
                        " LEFT JOIN products f ON g.product_id = f.product_id  " +
                        " LEFT JOIN groups e ON f.group_id = e.group_id  " +
                        " WHERE a.ext_code=? and d.bu_code=? and e.group_code=?"
                    const targetAllowParams = [targetRow[sap_codeColumn], targetRow[bu_codeColumn], targetRow[group_codeColumn]];
                    const targetAllowData = await executeQuery(targetAllowSql, targetAllowParams);
                    if (targetAllowData.length > 0) {

                        const targetDeleteSql = "Delete From cust_target" +
                            " Where customer_id=? and bu_id=? and group_id=? and target_date Between ? and ?";
                        const targetDeleteParams = [custData[0].customer_id, buData[0].bu_id, groupData[0].group_id, startDate, endDate];
                        await executeQuery(targetDeleteSql, targetDeleteParams);

                        var targetDate = new Date(startDate);
                        var targetValue = 0;
                        for (let j = 1; j <= 12; j++) {

                            if (j === 1) {
                                targetValue = targetRow[aprColumn]
                            } else if (j === 2) {
                                targetValue = targetRow[mayColumn]
                            } else if (j === 3) {
                                targetValue = targetRow[junColumn]
                            } else if (j === 4) {
                                targetValue = targetRow[julColumn]
                            } else if (j === 5) {
                                targetValue = targetRow[augColumn]
                            } else if (j === 6) {
                                targetValue = targetRow[sepColumn]
                            } else if (j === 7) {
                                targetValue = targetRow[octColumn]
                            } else if (j === 8) {
                                targetValue = targetRow[novColumn]
                            } else if (j === 9) {
                                targetValue = targetRow[decColumn]
                            } else if (j === 10) {
                                targetValue = targetRow[janColumn]
                            } else if (j === 11) {
                                targetValue = targetRow[febColumn]
                            } else if (j === 12) {
                                targetValue = targetRow[marColumn]
                            }

                            const sqlTargetAdd = "INSERT INTO cust_target (customer_id, bu_id, group_id, target_date, target_value, c_at, c_by)" +
                                " VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(),?)"
                            const paramsTargetAdd = [custData[0].customer_id, buData[0].bu_id, groupData[0].group_id, targetDate, targetValue, c_by]; //.format('YYYY-MM-DD')
                            await executeQuery(sqlTargetAdd, paramsTargetAdd);

                            const logData = `Target added... ${custData[0].ext_code} | ${custData[0].customer_name} | ${buData[0].bu_code} | ${buData[0].bu_short} | ${groupData[0].group_code} | ${groupData[0].group_name} | ${moment(targetDate).format('DD-MMM-YYYY')} | ${targetValue} | ${c_by}`;
                            this.logToTxt(logData);

                            targetDate.setMonth(targetDate.getMonth() + 1);
                        }
                    }

                }
            }

            // res.render('clearTax/pan', { panData, invalidTargetList });
            res.redirect('/custTarget/view?alert=Target+added+successfully');

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    };


    //************************** */
    //***Customer Stock********* */
    //************************** */
    static viewStock = async (req, res) => {
        const alert = req.query.alert;

        try {
            var { customer_id, stock_date, bu_id, bu_name } = req.query;
            // const { customer_list } = await this.getData(req, res.locals.user);
            var user_role = res.locals.user.user_role !== null && res.locals.user.user_role !== undefined ? res.locals.user.user_role : 'User';

            var sqlCust = `SELECT a.customer_id, a.customer_name, a.nick_name, CONCAT(a.city, ' ', a.pin_code) AS city_pin,
                b.market_area, c.bu_id, CONCAT(d.bu_code, ' | ', d.bu_name) AS bu_name, 
                a.mg_id, CONCAT(e.first_name,' ',e.middle_name,' ',e.last_name) as mg_name
                FROM customers AS a
                LEFT JOIN market_area AS b ON a.market_area_id = b.market_area_id
                LEFT JOIN customers_bu AS c ON a.customer_id = c.customer_id
                LEFT JOIN business_units AS d ON c.bu_id = d.bu_id
                LEFT JOIN employees AS e ON (a.mg_id = e.emp_id OR a.se_id = e.emp_id)
                WHERE a.status = 'A'`;
            if (user_role !== "Admin") {
                sqlCust += ` AND (a.user_id = ${mysql.escape(res.locals.user.user_id)} OR e.user_id = ${mysql.escape(res.locals.user.user_id)})`;
            }
            // var sqlCust = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area," +
            //     " a.ext_code,a.customer_type,a.mg_id,CONCAT(c.first_name,' ',c.middle_name,' ',c.last_name) as mg_name" +
            //     " From customers as a " +
            //     " LEFT JOIN market_area as b ON (a.market_area_id=b.market_area_id) " +
            //     " LEFT JOIN employees as c ON (a.mg_id=c.emp_id)"
            // if (user_role !== "Admin") {
            //     sqlCust = sqlCust + ` Where a.user_id=${res.locals.user.user_id}`;
            // }
            const customer_list = await executeQuery(sqlCust);
            // console.log('sqlCust', sqlCust)
            // console.log('customer_list', customer_list)

            var mg_id = null;
            var mg_name = null;
            if (customer_id !== null && customer_id !== undefined) {
                const sqlMg = `Select a.customer_id,a.customer_name,
                    a.mg_id, CONCAT(b.first_name,' ',b.middle_name,' ',b.last_name) as mg_name
                    From customers as a LEFT JOIN employees as b ON (a.mg_id=b.emp_id)
                    Where a.customer_id = ${mysql.escape(customer_id)}`
                const mgData = await executeQuery(sqlMg);
                if (mgData.length > 0) {
                    mg_id = mgData[0].mg_id
                    mg_name = mgData[0].mg_name
                }
            }

            if (stock_date === null || stock_date === undefined) {
                stock_date = moment().format('YYYY-MM-DD');
            }

            // const sqlStock = "SELECT d.seq_sr, a.customer_id, b.customer_name, b.nick_name, CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
            //     " e.bu_id, f.bu_code,CONCAT(f.bu_code, '-', f.bu_short) AS bu_name, d.group_id, d.group_name," +
            //     " a.product_id, c.product_name, a.stock_qty" +
            //     " FROM cust_stock as a, customers as b, products as c, groups d, products_bu e, business_units f" +
            //     " WHERE a.customer_id=? and a.stock_date=? and f.bu_id=?" +
            //     " and a.customer_id=b.customer_id and a.product_id=c.product_id and c.group_id = d.group_id" +
            //     " and c.product_id = e.product_id and e.bu_id=f.bu_id" +
            //     " Union " +
            //     " SELECT g.seq_sr, b.customer_id, b.customer_name, b.nick_name,CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
            //     " c.bu_id, d.bu_code,CONCAT(d.bu_code, '-', d.bu_short) AS bu_name, g.group_id, g.group_name," +
            //     " f.product_id, f.product_name, 0 as stock_qty" +
            //     " FROM customers as b, customers_bu as c, business_units as d, products_bu as e, products as f, groups as g" +
            //     " WHERE b.customer_id=? and f.group_id > 0 and d.bu_id=? " +
            //     " and b.customer_id=c.customer_id" +
            //     " and c.bu_id=d.bu_id and e.bu_id=c.bu_id and f.product_id=e.product_id and g.group_id=f.group_id" +
            //     " and f.product_id Not IN (SELECT x.product_id FROM cust_stock as x WHERE x.customer_id = ? and x.stock_date = ?)" +
            //     " ORDER BY `seq_sr` ASC, `group_name` ASC"
            // const paramsStock = [customer_id, stock_date, bu_id, customer_id, bu_id, customer_id, stock_date];
            // const stockData = await executeQuery(sqlStock, paramsStock);

            const sqlStock = `
            SELECT d.seq_sr, a.customer_id, b.customer_name, b.nick_name, CONCAT(b.city, ' ', b.pin_code) AS city_pin,
                e.bu_id, f.bu_code, CONCAT(f.bu_code, '-', f.bu_short) AS bu_name, d.group_id, d.group_name,
                a.product_id, c.product_name, a.stock_qty
            FROM cust_stock AS a
                JOIN customers AS b ON a.customer_id = b.customer_id
                JOIN products AS c ON a.product_id = c.product_id
                JOIN groups AS d ON c.group_id = d.group_id
                JOIN products_bu AS e ON c.product_id = e.product_id
                JOIN business_units AS f ON e.bu_id = f.bu_id
            WHERE a.customer_id = ${mysql.escape(customer_id)} AND a.stock_date = ${mysql.escape(stock_date)} AND f.bu_id = ${mysql.escape(bu_id)}
            UNION
            SELECT g.seq_sr, b.customer_id, b.customer_name, b.nick_name, CONCAT(b.city, ' ', b.pin_code) AS city_pin,
                c.bu_id, d.bu_code, CONCAT(d.bu_code, '-', d.bu_short) AS bu_name, g.group_id, g.group_name,
                f.product_id, f.product_name, 0 AS stock_qty
            FROM customers AS b
                JOIN customers_bu AS c ON b.customer_id = c.customer_id
                JOIN business_units AS d ON c.bu_id = d.bu_id
                JOIN products_bu AS e ON c.bu_id = e.bu_id
                JOIN products AS f ON e.product_id = f.product_id
                JOIN groups AS g ON f.group_id = g.group_id
            WHERE b.customer_id = ${mysql.escape(customer_id)} AND f.group_id > 0 AND d.bu_id = ${mysql.escape(bu_id)}
                AND f.product_id NOT IN (
                    SELECT x.product_id
                    FROM cust_stock AS x
                    WHERE x.customer_id = ${mysql.escape(customer_id)} AND x.stock_date = ${mysql.escape(stock_date)}
                )
            ORDER BY seq_sr ASC, group_name ASC, product_name ASC`;
            const stockData = await executeQuery(sqlStock);
            const custData = stockData.length > 0
                ? { customer_id, customer_name: stockData[0].customer_name, mg_name, bu_id_hdn: bu_id, bu_name }
                : { customer_id: 0, customer_name: '-- Select --', mg_name, bu_id_hdn: bu_id, bu_name };

            res.render('custTarget/custStock-view', { alert, customer_list, custData, stock_date, stockData });

        } catch (error) {
            console.error(error);
            res.status(500).send('An error occurred while processing your request.');
        }
    }

    static saveStock = async (req, res) => {
        const { stock_date, customer_id, customer_name, mg_name, bu_id_hdn, bu_id, bu_name, group_id, group_name,
            product_id, product_name, stock_qty } = req.body;
        const { customer_list } = await this.getData(req, res.locals.user);

        if (stock_qty === undefined || stock_qty === null) {
            const custData = { customer_id, customer_name, mg_name, bu_id: bu_id_hdn, bu_name };
            const errors = [{ message: 'No data found for save!' }];
            return res.render('custTarget/custStock-view', { errors, customer_list, custData, stock_date });
        }

        const bu_idVal = Array.isArray(bu_id) ? bu_id : [bu_id];
        const bu_nameVal = Array.isArray(bu_name) ? bu_name : [bu_name];
        const group_idVal = Array.isArray(group_id) ? group_id : [group_id];
        const group_nameVal = Array.isArray(group_name) ? group_name : [group_name];
        const product_idVal = Array.isArray(product_id) ? product_id : [product_id];
        const product_nameVal = Array.isArray(product_name) ? product_name : [product_name];
        const stock_qtyVal = Array.isArray(stock_qty) ? stock_qty : [stock_qty];

        //************ */
        const stockData = stock_qty.map((sr, i) => ({
            bu_id: bu_idVal[i],
            bu_name: bu_nameVal[i],
            group_id: group_idVal[i],
            group_name: group_nameVal[i],
            product_id: product_idVal[i],
            product_name: product_nameVal[i],
            stock_qty: stock_qtyVal[i],
        }));
        //************ */

        const errors = [];
        if (!stock_date) {
            errors.push({ message: 'Select period for stock entry' });
        }
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id_hdn) {
            errors.push({ message: 'Customer business unit is required' });
        }
        if (errors.length) {
            const custData = { customer_id, customer_name, mg_name, bu_id: bu_id_hdn, bu_name };
            return res.render('custTarget/custStock-view', { errors, customer_list, custData, stock_date, stockData });
        }

        try {
            const c_by = res.locals.user ? res.locals.user.user_id : 0;

            const sqlStockDelete = `DELETE FROM cust_stock 
                WHERE stock_date = ? AND customer_id = ? 
                AND product_id IN (SELECT product_id FROM products_bu WHERE bu_id = ?)`;
            const paramsStockDelete = [stock_date, customer_id, bu_id_hdn];
            await executeQuery(sqlStockDelete, paramsStockDelete);

            for (let i = 0; i < stock_qty.length; i++) {
                const sqlStockAdd = "INSERT INTO cust_stock (customer_id, stock_date, product_id, stock_qty, c_at, c_by)" +
                    " VALUES (?,?,?,?,CURRENT_TIMESTAMP(),?)"
                const paramsStockAdd = [customer_id, stock_date, product_idVal[i], stock_qtyVal[i], c_by]; //.format('YYYY-MM-DD')
                await executeQuery(sqlStockAdd, paramsStockAdd);
                // targetDate.setMonth(targetDate.getMonth() + 1);
            }

            res.redirect('/custTarget/view-stock?alert=Stock+added+successfully');

        } catch (err) {
            console.error(err);
            return res.render('custTarget/custStock-view', { alert: `Internal server error` });
        }

    }

    static deleteStock = async (req, res) => {
        const { customer_id, stock_date, mg_name, bu_id_hdn, bu_name } = req.query;

        try {
            var errors = [];
            // const sqlStr1 = "Select * from cust_target Where customer_id=? and target_date Between ? and ?"
            // const params1 = [customer_id, startDate, endDate];
            // const rows = await executeQuery(sqlStr1, params1);
            // if (rows.length > 0) {
            //     errors.push({ message: "Reference exist, master entry can't delete" });
            // }

            if (stock_date === null || stock_date === undefined) {
                errors.push({ message: "Reference exist, master entry can't delete" });
            }
            if (errors.length) {
                res.redirect(`/custTarget/view-stock?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }

            const sqlStockDelete = `DELETE FROM cust_stock 
                WHERE stock_date = ? AND customer_id = ? 
                AND product_id IN (SELECT product_id FROM products_bu WHERE bu_id = ?)`;
            const paramsStockDelete = [stock_date, customer_id, bu_id_hdn];
            await executeQuery(sqlStockDelete, paramsStockDelete);

            res.redirect('/custTarget/view-stock?alert=Stock+removed+successfully');

        } catch (err) {
            console.error(err);
            return res.render('custTarget/custStock-view', { alert: `Internal server error` });
        }
    };


    //************************** */
    //***Customer Stock********* */
    //************************** */
    static viewSale = async (req, res) => {
        const alert = req.query.alert;

        try {
            var { customer_id, sale_date, bu_id, bu_name } = req.query;
            // const { customer_list } = await this.getData(req, res.locals.user);
            var user_role = res.locals.user.user_role !== null && res.locals.user.user_role !== undefined ? res.locals.user.user_role : 'User';

            var sqlCust = `SELECT a.customer_id, a.customer_name, a.nick_name, CONCAT(a.city, ' ', a.pin_code) AS city_pin,
                b.market_area, c.bu_id, CONCAT(d.bu_code, ' | ', d.bu_name) AS bu_name, 
                a.mg_id, CONCAT(e.first_name,' ',e.middle_name,' ',e.last_name) as mg_name
                FROM customers AS a
                LEFT JOIN market_area AS b ON a.market_area_id = b.market_area_id
                LEFT JOIN customers_bu AS c ON a.customer_id = c.customer_id
                LEFT JOIN business_units AS d ON c.bu_id = d.bu_id
                LEFT JOIN employees AS e ON a.mg_id = e.emp_id
                WHERE a.status = 'A'`;
            if (user_role !== "Admin") {
                sqlCust += ` AND (a.user_id = ${mysql.escape(res.locals.user.user_id)} OR e.user_id = ${mysql.escape(res.locals.user.user_id)})`;
            }
            // var sqlCust = "Select a.customer_id,a.customer_name,a.nick_name,CONCAT(a.city,' ',a.pin_code) as city_pin,b.market_area," +
            //     " a.ext_code,a.customer_type,a.mg_id,CONCAT(c.first_name,' ',c.middle_name,' ',c.last_name) as mg_name" +
            //     " From customers as a " +
            //     " LEFT JOIN market_area as b ON (a.market_area_id=b.market_area_id) " +
            //     " LEFT JOIN employees as c ON (a.mg_id=c.emp_id)"
            // if (user_role !== "Admin") {
            //     sqlCust = sqlCust + ` Where a.user_id=${res.locals.user.user_id}`;
            // }
            const customer_list = await executeQuery(sqlCust);

            var mg_id = null;
            var mg_name = null;
            if (customer_id !== null && customer_id !== undefined) {
                const sqlMg = `Select a.customer_id,a.customer_name,
                    a.mg_id, CONCAT(b.first_name,' ',b.middle_name,' ',b.last_name) as mg_name
                    From customers as a LEFT JOIN employees as b ON (a.mg_id=b.emp_id)
                    Where a.customer_id = ${mysql.escape(customer_id)}`
                const mgData = await executeQuery(sqlMg);
                if (mgData.length > 0) {
                    mg_id = mgData[0].mg_id
                    mg_name = mgData[0].mg_name
                }
            }

            if (sale_date === null || sale_date === undefined) {
                sale_date = moment().format('YYYY-MM-DD');
            }

            // const sqlSale = "SELECT d.seq_sr, a.customer_id, b.customer_name, b.nick_name, CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
            //     " e.bu_id, f.bu_code,CONCAT(f.bu_code, '-', f.bu_short) AS bu_name, d.group_id, d.group_name," +
            //     " a.product_id, c.product_name, a.sale_qty" +
            //     " FROM cust_sale as a, customers as b, products as c, groups d, products_bu e, business_units f" +
            //     " WHERE a.customer_id=? and a.sale_date=? and f.bu_id=?" +
            //     " and a.customer_id=b.customer_id and a.product_id=c.product_id and c.group_id = d.group_id" +
            //     " and c.product_id = e.product_id and e.bu_id=f.bu_id" +
            //     " Union " +
            //     " SELECT g.seq_sr, b.customer_id, b.customer_name, b.nick_name,CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
            //     " c.bu_id, d.bu_code,CONCAT(d.bu_code, '-', d.bu_short) AS bu_name, g.group_id, g.group_name," +
            //     " f.product_id, f.product_name, 0 as sale_qty" +
            //     " FROM customers as b, customers_bu as c, business_units as d, products_bu as e, products as f, groups as g" +
            //     " WHERE b.customer_id=? and f.group_id > 0 and d.bu_id=? " +
            //     " and b.customer_id=c.customer_id" +
            //     " and c.bu_id=d.bu_id and e.bu_id=c.bu_id and f.product_id=e.product_id and g.group_id=f.group_id" +
            //     " and f.product_id Not IN (SELECT x.product_id FROM cust_sale as x WHERE x.customer_id = ? and x.sale_date = ?)" +
            //     " ORDER BY `seq_sr` ASC, `group_name` ASC"
            // const paramsSale = [customer_id, sale_date, bu_id, customer_id, bu_id, customer_id, sale_date];
            // const saleData = await executeQuery(sqlSale, paramsSale);

            const sqlSale = `
            SELECT d.seq_sr, a.customer_id, b.customer_name, b.nick_name, CONCAT(b.city, ' ', b.pin_code) AS city_pin,
                e.bu_id, f.bu_code, CONCAT(f.bu_code, '-', f.bu_short) AS bu_name, d.group_id, d.group_name,
                a.product_id, c.product_name, a.sale_qty
            FROM cust_sale AS a
                JOIN customers AS b ON a.customer_id = b.customer_id
                JOIN products AS c ON a.product_id = c.product_id
                JOIN groups AS d ON c.group_id = d.group_id
                JOIN products_bu AS e ON c.product_id = e.product_id
                JOIN business_units AS f ON e.bu_id = f.bu_id
            WHERE a.customer_id = ${mysql.escape(customer_id)} AND a.sale_date = ${mysql.escape(sale_date)} AND f.bu_id = ${mysql.escape(bu_id)}
            UNION
            SELECT g.seq_sr, b.customer_id, b.customer_name, b.nick_name, CONCAT(b.city, ' ', b.pin_code) AS city_pin,
                c.bu_id, d.bu_code, CONCAT(d.bu_code, '-', d.bu_short) AS bu_name, g.group_id, g.group_name,
                f.product_id, f.product_name, 0 AS sale_qty
            FROM customers AS b
                JOIN customers_bu AS c ON b.customer_id = c.customer_id
                JOIN business_units AS d ON c.bu_id = d.bu_id
                JOIN products_bu AS e ON c.bu_id = e.bu_id
                JOIN products AS f ON e.product_id = f.product_id
                JOIN groups AS g ON f.group_id = g.group_id
            WHERE b.customer_id = ${mysql.escape(customer_id)} AND f.group_id > 0 AND d.bu_id = ${mysql.escape(bu_id)}
                AND f.product_id NOT IN (
                    SELECT x.product_id
                    FROM cust_sale AS x
                    WHERE x.customer_id = ${mysql.escape(customer_id)} AND x.sale_date = ${mysql.escape(sale_date)}
                )
            ORDER BY seq_sr ASC, group_name ASC, product_name ASC`;
            const saleData = await executeQuery(sqlSale);

            const custData = saleData.length > 0
                ? { customer_id, customer_name: saleData[0].customer_name, mg_name, bu_id_hdn: bu_id, bu_name }
                : { customer_id: 0, customer_name: '-- Select --', mg_name, bu_id_hdn: bu_id, bu_name };

            res.render('custTarget/custSale-view', { alert, customer_list, custData, sale_date, saleData });

        } catch (error) {
            console.error(error);
            res.status(500).send('An error occurred while processing your request.');
        }
    }

    static saveSale = async (req, res) => {
        const { sale_date, customer_id, customer_name, mg_name, bu_id_hdn, bu_id, bu_name, group_id, group_name,
            product_id, product_name, sale_qty } = req.body;
        const { customer_list } = await this.getData(req, res.locals.user);

        if (sale_qty === undefined || sale_qty === null) {
            const custData = { customer_id, customer_name, mg_name, bu_id: bu_id_hdn, bu_name };
            const errors = [{ message: 'No data found for save!' }];
            return res.render('custTarget/custSale-view', { errors, customer_list, custData, sale_date });
        }

        const bu_idVal = Array.isArray(bu_id) ? bu_id : [bu_id];
        const bu_nameVal = Array.isArray(bu_name) ? bu_name : [bu_name];
        const group_idVal = Array.isArray(group_id) ? group_id : [group_id];
        const group_nameVal = Array.isArray(group_name) ? group_name : [group_name];
        const product_idVal = Array.isArray(product_id) ? product_id : [product_id];
        const product_nameVal = Array.isArray(product_name) ? product_name : [product_name];
        const sale_qtyVal = Array.isArray(sale_qty) ? sale_qty : [sale_qty];

        //************ */
        const saleData = sale_qty.map((sr, i) => ({
            bu_id: bu_idVal[i],
            bu_name: bu_nameVal[i],
            group_id: group_idVal[i],
            group_name: group_nameVal[i],
            product_id: product_idVal[i],
            product_name: product_nameVal[i],
            sale_qty: sale_qtyVal[i],
        }));
        //************ */

        const errors = [];
        if (!sale_date) {
            errors.push({ message: 'Select period for Sale entry' });
        }
        if (!customer_id) {
            errors.push({ message: 'Customer name is required' });
        }
        if (!bu_id_hdn) {
            errors.push({ message: 'Customer business unit is required' });
        }
        if (errors.length) {
            const custData = { customer_id, customer_name, mg_name, bu_id: bu_id_hdn, bu_name };
            return res.render('custTarget/custSale-view', { errors, customer_list, custData, sale_date, saleData });
        }

        try {
            const c_by = res.locals.user ? res.locals.user.user_id : 0;

            const sqlSaleDelete = `DELETE FROM cust_sale 
                WHERE sale_date = ? AND customer_id = ? 
                AND product_id IN (SELECT product_id FROM products_bu WHERE bu_id = ?)`;
            const paramsSaleDelete = [sale_date, customer_id, bu_id_hdn];
            await executeQuery(sqlSaleDelete, paramsSaleDelete);

            for (let i = 0; i < sale_qty.length; i++) {
                const sqlSaleAdd = "INSERT INTO cust_sale (customer_id, sale_date, product_id, sale_qty, c_at, c_by)" +
                    " VALUES (?,?,?,?,CURRENT_TIMESTAMP(),?)"
                const paramsSaleAdd = [customer_id, sale_date, product_idVal[i], sale_qtyVal[i], c_by]; //.format('YYYY-MM-DD')
                await executeQuery(sqlSaleAdd, paramsSaleAdd);
                // targetDate.setMonth(targetDate.getMonth() + 1);
            }

            res.redirect('/custTarget/view-Sale?alert=Sale+added+successfully');

        } catch (err) {
            console.error(err);
            return res.render('custTarget/custSale-view', { alert: `Internal server error` });
        }

    }

    static deleteSale = async (req, res) => {
        const { customer_id, sale_date, mg_name, bu_id, bu_name } = req.query;
        try {
            var errors = [];
            // const sqlStr1 = "Select * from cust_target Where customer_id=? and target_date Between ? and ?"
            // const params1 = [customer_id, startDate, endDate];
            // const rows = await executeQuery(sqlStr1, params1);
            // if (rows.length > 0) {
            //     errors.push({ message: "Reference exist, master entry can't delete" });
            // }

            if (sale_date === null || sale_date === undefined) {
                errors.push({ message: "Reference exist, master entry can't delete" });
            }
            if (errors.length) {
                res.redirect(`/custTarget/view-Sale?${errors.map(error => `alert=${error.message}`).join('&')}`);
                return;
            }

            const sqlSaleDelete = `DELETE FROM cust_sale 
                WHERE sale_date = ? AND customer_id = ? 
                AND product_id IN (SELECT product_id FROM products_bu WHERE bu_id = ?)`;
            const paramsSaleDelete = [sale_date, customer_id, bu_id];
            await executeQuery(sqlSaleDelete, paramsSaleDelete);

            res.redirect('/custTarget/view-Sale?alert=Sale+removed+successfully');

        } catch (err) {
            console.error(err);
            return res.render('custTarget/custSale-view', { alert: `Internal server error` });
        }
    };


    //************************** */
    //***Customer Target Report********* */
    //************************** */
    static targeReport = async (req, res) => {
        try {
            const alert = req.query.alert;
            const { customer_id, customer_name, year_select, mg_name } = req.query;
            const { customer_list } = await this.getData(req, res.locals.user);

            const currentYear = moment().year();
            let startYear, endYear;
            const years = Array.from({ length: 2 }, (_, index) => {
                startYear = currentYear - index;
                endYear = startYear + 1;
                return `${startYear}-${endYear}`;
            });

            let startDate, endDate;
            if (!year_select) {
                const currentMonth = moment().month() + 1;
                startYear = currentMonth <= 3 ? currentYear - 1 : currentYear;
                endYear = startYear + 1;

                startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
                endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');
            } else {
                [startYear, endYear] = year_select.split('-').map(Number);
                startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
                endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');
            }

            let targetData = null;
            let paramsTarget = null;

            let custParam = "";
            if (!customer_id) {
                custParam = ` and a.customer_id = 0`;
            } else if (customer_id > 0) {
                custParam = ` and a.customer_id = ${customer_id}`;
            }

            const sqlTarget = "SELECT e.seq_sr,a.customer_id,b.customer_name,b.nick_name,CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
                " d.bu_id,d.bu_code,CONCAT(d.bu_code, '-', d.bu_short) AS bu_name,e.group_id,e.group_name," +
                " SUM(CASE WHEN MONTH(a.target_date) = 4 THEN a.target_value END) as apr1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 5 THEN a.target_value END) AS may1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 6 THEN a.target_value END) AS jun1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 7 THEN a.target_value END) AS jul1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 8 THEN a.target_value END) AS aug1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 9 THEN a.target_value END) AS sep1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 10 THEN a.target_value END) AS oct1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 11 THEN a.target_value END) AS nov1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 12 THEN a.target_value END) AS dec1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 1 THEN a.target_value END) AS jan1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 2 THEN a.target_value END) AS feb1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 3 THEN a.target_value END) AS mar1," +
                " SUM(a.target_value) AS total" +
                " FROM cust_target as a" +
                " JOIN customers AS b ON a.customer_id = b.customer_id" +
                " JOIN customers_bu AS c ON a.customer_id = c.customer_id and a.bu_id = c.bu_id" +
                " JOIN business_units AS d ON c.bu_id = d.bu_id" +
                " JOIN groups e ON a.group_id = e.group_id" +
                " WHERE a.target_date BETWEEN ? and ? " + custParam +
                " GROUP BY e.seq_sr, a.customer_id,b.customer_name,b.nick_name,CONCAT(b.city, ' ', b.pin_code),d.bu_id,d.bu_code," +
                " CONCAT(d.bu_code, '-', d.bu_short),e.group_id,e.group_name" +
                " ORDER BY `seq_sr` ASC, `group_name` ASC"

            paramsTarget = [startDate, endDate];
            targetData = await executeQuery(sqlTarget, paramsTarget);

            const custData = { customer_id: customer_id, customer_name: customer_name, mg_name: mg_name }

            res.render('custTarget/custTarget-report', { alert, customer_list, custData, year_select, years, targetData });

        } catch (error) {
            console.error(error);
            // Handle the error
        }
    }

    static targeExportCSV = async (req, res) => {
        const { exportCSV_targetYear, exportCSV_custID } = req.query;
        try {
            var customer_id = !exportCSV_custID ? 0 : exportCSV_custID;
            const year_select = exportCSV_targetYear;
            const mg_name = "";

            const currentYear = moment().year();
            let startYear, endYear;
            const years = Array.from({ length: 2 }, (_, index) => {
                startYear = currentYear - index;
                endYear = startYear + 1;
                return `${startYear}-${endYear}`;
            });

            let startDate, endDate;
            if (!year_select) {
                const currentMonth = moment().month() + 1;
                startYear = currentMonth <= 3 ? currentYear - 1 : currentYear;
                endYear = startYear + 1;

                startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
                endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');
            } else {
                [startYear, endYear] = year_select.split('-').map(Number);
                startDate = moment(`${startYear}-04-01`).format('YYYY-MM-DD');
                endDate = moment(`${endYear}-03-31`).format('YYYY-MM-DD');
            }

            let targetData = null;
            let paramsTarget = null;

            let custParam = "";
            if (!customer_id) {
                custParam = ` and a.customer_id = 0`;
            } else if (customer_id > 0) {
                custParam = ` and a.customer_id = ${customer_id}`;
            }

            const sqlTarget = "SELECT a.customer_id,Trim(b.customer_name) as customer_name,b.nick_name,CONCAT(b.city, ' ', b.pin_code) AS city_pin," +
                " d.bu_id,d.bu_code,CONCAT(d.bu_code, '-', d.bu_short) AS bu_name,CONCAT(f.first_name,' ',f.last_name) AS mg_name, e.seq_sr,e.group_id,e.group_name," +
                " SUM(CASE WHEN MONTH(a.target_date) = 4 THEN a.target_value END) as apr1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 5 THEN a.target_value END) AS may1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 6 THEN a.target_value END) AS jun1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 7 THEN a.target_value END) AS jul1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 8 THEN a.target_value END) AS aug1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 9 THEN a.target_value END) AS sep1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 10 THEN a.target_value END) AS oct1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 11 THEN a.target_value END) AS nov1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 12 THEN a.target_value END) AS dec1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 1 THEN a.target_value END) AS jan1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 2 THEN a.target_value END) AS feb1," +
                " SUM(CASE WHEN MONTH(a.target_date) = 3 THEN a.target_value END) AS mar1," +
                " SUM(a.target_value) AS total" +
                " FROM cust_target as a" +
                " JOIN customers AS b ON a.customer_id = b.customer_id" +
                " JOIN customers_bu AS c ON a.customer_id = c.customer_id and a.bu_id = c.bu_id" +
                " JOIN business_units AS d ON c.bu_id = d.bu_id" +
                " JOIN groups e ON a.group_id = e.group_id" +
                " LEFT JOIN employees f ON b.mg_id = f.emp_id" +
                " WHERE a.target_date BETWEEN ? and ? " + custParam +
                " GROUP BY e.seq_sr, a.customer_id,b.customer_name,b.nick_name,CONCAT(b.city, ' ', b.pin_code),d.bu_id,d.bu_code," +
                " CONCAT(d.bu_code, '-', d.bu_short),e.group_id,e.group_name" +
                " ORDER BY `customer_name` ASC, `seq_sr` ASC"

            paramsTarget = [startDate, endDate];
            targetData = await executeQuery(sqlTarget, paramsTarget);

            const custData = targetData.length > 0
                ? { customer_id, customer_name: targetData[0].customer_name, mg_name }
                : { customer_id: 0, customer_name: '-- Select --', mg_name: '' };

            /***********************************************/
            const csvStream = csv.format({ headers: true });
            const fileName = 'Targets_' + year_select + '.csv'
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName); // Replace "users.csv" with your desired filename
            res.set('Content-Type', 'text/csv');
            csvStream.pipe(res);
            // const modifiedAttenData = attenData.map((row) => {
            //     return {...row,vc_comp_code: `'${row.vc_comp_code}`, };
            //   });
            // modifiedAttenData.forEach((row) => csvStream.write(row));
            targetData.forEach((row) => csvStream.write(row));
            csvStream.end();

            const now = new Date().toLocaleString();
            console.log(`Customer targets data exported as ${fileName} file!... user: '${res.locals.user.username} on '${now}'`);
            // console.log('Data exported successfully to CSV file!');

        } catch (err) {
            console.error(err);
        } finally {
            //conn.release
        }
    };


};


export { custTargetController, upload };