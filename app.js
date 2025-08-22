import express from "express";
import { executeQuery } from './db.js';
import bodyParser from 'body-parser'
import cookieParser from "cookie-parser";
import { join } from 'path';
import favicon from 'serve-favicon';
import cors from 'cors';
import moment from 'moment';
// import { createProxyMiddleware } from 'http-proxy-middleware';

import authRoute from "./routes/authRoutes.js";
import exphbs from 'express-handlebars';
import authController from "./controller/authController.js";
import productRoute from "./routes/productRoutes.js";
import customerRoute from "./routes/customerRoutes.js";
import poRoute from "./routes/poRoutes.js";
import dealerPayRoute from "./routes/dealerPayRoutes.js";
import dsrRoute from "./routes/dsrRoutes.js";
import dsrAcRoute from "./routes/dsrAcRoutes.js";
import dsrTpRoute from "./routes/dsrTpRoutes.js";
import apiRoute from "./routes/apiRoutes.js";
import custTargetRoute from "./routes/custTargetRoutes.js";
import xController from "./controller/xController.js";
import empRoute from "./routes/empRoutes.js";
import circularRoute from "./routes/circularRoute.js";
import vanclaimRoute from "./routes/vanclaimRoutes.js"
import consumerRoute from "./routes/consumerRoutes.js";
import shopRoutes from './routes/shopRoutes.js';
import custDetailRoutes from './routes/custDetailRoutes.js';
import sapImportRoutes from './routes/sapImportRoutes.js';
import groupsRoutes from './routes/groupsRoutes.js';

import ftp from 'basic-ftp';
import fs from 'fs';
import schedule from 'node-schedule';
import vhost from "vhost";
import https from "https";
import http from "http";
import enforce from "express-sslify";

const certsPath = process.cwd() + '/certs';
const httpsOptions = {
  key: fs.readFileSync(certsPath + '/server.key'),
  cert: fs.readFileSync(certsPath + '/server.crt')
};

//import axios from 'axios';
//import hbs from 'hbs';
//import {  Loader  } from '@googlemaps/js-api-loader';
//import pkg from '@googlemaps/js-api-loader';
//const { Loader } = pkg;

//import session from 'express-session';
//import verifyToken from "./controller/verifyToken.js";

const app = express();
//const PORT = 3000;

// Increase payload size limit (e.g., 10MB)
app.use(bodyParser.json({ limit: '1mb' }));

// //????????????
// const subdomain1App = express();
// app.use(vhost("sales.malpani.com", subdomain1App));
// // Redirect HTTP to HTTPS (Enable this middleware to force HTTPS)
// app.use(enforce.HTTPS({ trustProtoHeader: true }));

// uncomment after placing your favicon in /public
app.use(favicon(join(process.cwd(), 'public/favicon.ico')));
//app.use(favicon(join(process.cwd(),'public/images/favicon.ico')));
//console.log(`Favcon Path : ${join(process.cwd(), 'public/favicon.ico')}`);

//app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));  // app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(join(process.cwd(), 'public')));

app.use(cors());
app.use('/cors-api', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});


/**
 * Custom Handlebars helpers for date formatting and other utilities.
 */
const momentDDDD_HBS = function (date, format) {
  if (typeof format === 'string') {
    return moment(date, format).format('dddd');
  } else {
    return moment(date).format('dddd');
  }
};
const momentDDD_HBS = function (date, format) {
  if (typeof format === 'string') {
    return moment(date, format).format('ddd');
  } else {
    return moment(date).format('ddd');
  }
};
const momentDMY_HBS = function (date, format) {
  if (typeof format === 'string') {
    return moment(date, format).format('DD/MM/YYYY');
    //return moment(date, format.toString()).format('YYYY-MM-DD');
  } else {
    return moment(date).format('DD/MM/YYYY');
  }
};
const momentDMYHm_HBS = function (date, format) {
  if (typeof format === 'string') {
    return moment(date, format).format('DD/MM/YYYY HH:mm');
    //return moment(date, format.toString()).format('YYYY-MM-DD');
  } else {
    return moment(date).format('DD/MM/YYYY HH:mm');
  }
};
const momentYMD_HBS = function (date, format) {
  if (typeof format === 'string') {
    return moment(date, format).format('YYYY-MM-DD');
  } else {
    return moment(date).format('YYYY-MM-DD');
  }
};
const isArrayHBS = function (value) {
  return Array.isArray(value);
};
const includesHBS = function (arr, val) {
  if (arr && arr.includes) {
    return arr.includes(val);
  } else {
    return false;
  }
};
const eqHBS = function (a, b) {
  return a == b;
};
const isEqualsHBS = function (arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
};
const isEqualHelperHandlerbar = function (variable, ...values) {
  const options = values.pop();
  const isEqual = values.some((value) => variable === value);
  return isEqual ? options.fn(this) : options.inverse(this);
};
const addHBS = function (...values) {
  let sum = 0;
  values.forEach((value) => {
    if (!isNaN(value)) {
      sum += Number(value);
    }
  });
  return sum;
};
const jsonHelper = function (context) {
  return JSON.stringify(context);
};
const gtHBS = function (a, b) {
  return a > b;
};
const ltHBS = function (a, b) {
  return a < b;
};
const subtractHBS = function (a, b) {
  return Math.round(a - b);
};
const multiplyHBS = function (a, b) {
  return a * b;
};
const divideHBS = function (a, b) {
  if (b === 0) return 0; // Prevent division by zero
  return a / b;
};
const momentAddHBS = function (date, amount, unit, format) {
  const momentDate = moment(date);
  if (!momentDate.isValid()) return date; // Return original if invalid date

  const modifiedDate = momentDate.add(amount, unit);

  if (format) {
    return modifiedDate.format(format);
  }
  return modifiedDate.format('YYYY-MM-DD'); // Default format
};
//end-define custome helpers

// view engine setup
app.set('views', join(process.cwd(), 'views'));
app.set('view engine', 'hbs');
app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: join(process.cwd(), '/views/layouts/'),
  partialsDir: join(process.cwd(), '/views/partials'),
  helpers: {
    // Comparison helpers
    isEqual: isEqualHelperHandlerbar,
    isEquals: isEqualsHBS,
    eq: eqHBS,
    gt: gtHBS,
    lt: ltHBS,
    includes: includesHBS,

    // Type checking
    isArray: isArrayHBS,

    // Count helper - NEW
    count: function (obj) {
      if (Array.isArray(obj)) {
        return obj.length;
      } else if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).length;
      }
      return 0;
    },

    // Date formatting
    moment: function (dateString, inputFormat, outputFormat) {
      return moment(dateString, inputFormat).format(outputFormat);
    },
    momentDMY: momentDMY_HBS,
    momentYMD: momentYMD_HBS,
    momentDMYHm: momentDMYHm_HBS,
    momentDDDD: momentDDDD_HBS,
    momentDDD: momentDDD_HBS,
    momentAdd: momentAddHBS,

    // Math operations
    add: addHBS,
    subtract: subtractHBS,
    multiply: multiplyHBS,
    divide: divideHBS,

    // Number formatting
    formatNumber: function (value) {
      return value ? Math.round(value).toLocaleString() : '0';
    },
    formatCurrency: function (value) {
      return value ? '₹' + Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
    },
    formatPercent: function (value) {
      return Math.round(value);
    },
    fixed: function (value, decimals) {
      return Number(value).toFixed(decimals || 2);
    },
    percent: function (value) {
      return (value * 100).toFixed(1) + '%';
    },
    round: function (value) {
      return Math.round(value);
    },

    // Growth class for styling
    growthClass: function (growthPercent) {
      if (growthPercent > 0) return 'text-success';
      if (growthPercent < 0) return 'text-danger';
      return '';
    },

    // JSON helper
    json: jsonHelper
  }

}));

// Load auth routes
app.use('/api', apiRoute);
app.use('/auth', authRoute);
app.use('/', authController.checkToken); //chekToken applicable all follwoing routes
app.use('/product', productRoute);
app.use('/customer', customerRoute);
app.use('/po', poRoute);
app.use('/dealerPay', dealerPayRoute);
app.use('/dsr', dsrRoute);
app.use('/dsrAc', dsrAcRoute);
app.use('/dsrTp', dsrTpRoute);
app.use('/custTarget', custTargetRoute);
app.use('/emp', empRoute);
app.use('/circular', circularRoute);
app.use('/vanclaim', vanclaimRoute);
app.use('/consumer', consumerRoute);
app.use('/shop', shopRoutes);
app.use('/cust-detail', custDetailRoutes);
app.use('/sap-data', sapImportRoutes);
app.use('/sap-group', groupsRoutes);

// Log incoming requests
/*app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} received`);
  next();
});*/

// Temp Routes
app.get('/sv-crm', (req, res) => {
  // res.cookie('session', JSON.stringify(req.cookies.session), { httpOnly: false });
  // res.cookie('authToken', req.cookies.authToken, { httpOnly: false });
  const email = res.locals.user.email_id;
  const firstChars = email ? email.slice(0, 1).toUpperCase() : '';
  const secondChars = email ? email.slice(1, 2).toUpperCase() : '';
  const userData = {
    "userId": res.locals.user.user_id,
    "firstName": res.locals.user.first_name ? res.locals.user.first_name : firstChars,
    "lastName": res.locals.user.last_name ? res.locals.user.last_name : secondChars,
    "userRole": res.locals.user.user_role,
    "userStatus": "A",
    "userTheme": "light",
    "email": res.locals.user.email_id,
    "username": res.locals.user.username,
    "userImage": "", "loginWith": ""
  }
  res.cookie('session', JSON.stringify(userData), { httpOnly: false });
  res.redirect('http://192.168.182.27:3000/');
});

app.get('/', (req, res) => {
  res.render('home', { title: 'Home', message: 'Welcome, to app!' });
});
app.get('/about', async (req, res) => {
  res.render('error', { title: 'Error' });
});

app.get('/updateImageRecords', async (req, res) => {
  // GET /updateImageRecords?startDate=2024-08-01%2000:00:00&endDate=2024-08-26%2023:59:59
  try {
    const { startDate, endDate } = req.query;

    // Validate the date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Both startDate and endDate are required' });
    }

    console.log('The process of updating odometer image records has started...!')

    await xController.updateImageRecords(req, res, startDate, endDate);
  } catch (error) {
    console.error('Error in /updateImageRecords route:', error);
    res.status(500).send('An internal server error occurred');
  }
});

// Handle GoogleMapAPI for location
app.get('/location', (req, res) => {
  res.render('location', { location: 'Sangamner', lat: '19.576117', lng: '74.207019' });
  //process.env.GOOGLE_MAPS_API_KEY
});
app.get('/location1', (req, res) => {
  res.render('location1', { googleApiKey: process.env.GOOGLE_MAPS_API_KEY });
});
app.get('/location2', async (req, res) => {
  const sqlStr6 = "SELECT a.emp_id, a.loc_date, a.loc_lat, a.loc_lng, a.loc_name FROM dsr_loc as a Where emp_id=7 and loc_date Between '2023-09-06' and '2023-09-07'"
  const locData = await executeQuery(sqlStr6)

  res.render('location2', { googleApiKey: process.env.GOOGLE_MAPS_API_KEY, locations: JSON.stringify(locData) });
});
app.post('/location1', async (req, res) => {
  const { lat, lng } = req.body;
  try {
    //console.log('XXX POST request received');
    console.log(`XXX Location received: ${lat}, ${lng}`);

    if (lat) {
      //add to database
      // const conn = await pool.getConnection();
      // await conn.beginTransaction();
      const sqlStr = "INSERT INTO locations (name,address,lat,lng)" +
        " VALUES ('Sunil','Sunil Add',?,?)"
      const params = [lat, lng];
      await executeQuery(sqlStr, params);
      // await conn.commit();
      // //conn.release();
      console.log(`XXX Data Save: ${lat}, ${lng}`);
    }

    res.render('home', { alert: `Location received Latitude: ${lat} Longitude: ${lng}` })

    // Perform database operations here
    //res.status(200).send(`Location received Latitude: ${lat} Longitude: ${lng}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


// Handle LOV
app.get('/lov', async (req, res) => {
  // const conn = await pool.getConnection();
  const users = await executeQuery("SELECT * FROM users", []);
  // conn.release
  res.render('lov', { users });
  // return res.status(400).json({ users });
});


//**************************************//
app.all('*', (req, res) => {
  res.status(404).send("<h1>Page not found!!!</h1>");
});
//

//**************************************//
//****Upload data on FTP***//
//**************************************//
const uploadToFTP = async (csvData) => {
  const remoteFTPClient = new ftp.Client();
  const localFTPClient = new ftp.Client();

  remoteFTPClient.ftp.verbose = true;
  localFTPClient.ftp.verbose = true;

  const tempFile = join(process.cwd(), 'temp.csv');
  fs.writeFileSync(tempFile, csvData);

  try {
    // // Upload to remote FTP server
    // await remoteFTPClient.access({
    //   host: process.env.ftp_host_temp,
    //   user: process.env.ftp_user_temp,
    //   password: process.env.ftp_password_temp,
    //   port: process.env.ftp_port
    // });
    // await remoteFTPClient.uploadFrom(tempFile, '/Portal/PODetailReport');

    // Upload to local FTP server
    await localFTPClient.access({
      host: process.env.ftp_host_local,
      user: process.env.ftp_user_local,
      password: process.env.ftp_password_local,
      port: process.env.ftp_port_local
    });
    await localFTPClient.uploadFrom(tempFile, '/Portal/PODetailReport');

    const now = new Date().toLocaleString();
    console.log(`File uploaded successfully to both FTP servers on ${now}`);
  } catch (error) {
    console.error('Error during FTP upload:', error);

    // Check which FTP failed
    if (error.message.includes('192.168.182.21')) {
      console.error('Local FTP upload failed');
    } else {
      console.error('Remote FTP upload failed');
    }

  } finally {
    remoteFTPClient.close();
    localFTPClient.close();
    try {
      fs.unlinkSync(tempFile); // Clean up temp file
    } catch (err) {
      console.error('Error deleting temp file:', err);
    }
  }
};
// const uploadToFTP = async (csvData) => {
//   const client = new ftp.Client();
//   client.ftp.verbose = true;
//   try {
//     await client.access({
//       host: process.env.ftp_host_temp,
//       user: process.env.ftp_user_temp,
//       password: process.env.ftp_password_temp,
//       port: process.env.ftp_port
//     });
//     //
//     const tempFile = join(process.cwd(), 'temp.csv');
//     fs.writeFileSync(tempFile, csvData);
//     await client.uploadFrom(tempFile, '/Portal/PODetailReport'); // .csv ///yashm24.sg-host.com/order_data/my_file.csv  //csvData //join(process.cwd(), 'my_file.csv')

//      // Upload to local machine
//     const localPath = 'D:\\Portal\\PODetailReport';
//     fs.writeFileSync(localPath, csvData);

//     const now = new Date().toLocaleString();
//     console.log(`The file was uploaded successfully to both FTP and local machine on ${now}`);
//   } catch (error) {
//     console.error(error);
//   } finally {
//     client.close();
//   }
// };
const convertToCsv = (data) => {
  const header = Object.keys(data[0]).join(',');
  const rows = data.map((row) => Object.values(row).join(','));
  return `${header}\n${rows.join('\n')}`;
};
const selectAndUploadData = async () => {
  const today = moment().format('YYYY-MM-DD')
  const minDate = moment(today).add(-2, 'days');
  const maxDate = moment(today);
  try {
    const sqlStr = "Select CONCAT(a.po_no_new,Space(2)) as Sr,'ZSOR' as Doc_Type, e.bu_code as Sales_Org,'20' as Distr_Channel,'10' as Division," +
      " Null as Sales_office, Null as Sales_Group, Null as Inco_T1, Null as  Inco_T2,CONCAT(a.po_no_new,Space(2)) as Customer_Reference," +
      " DATE_FORMAT(a.po_date,'%d.%m.%Y') as Valid_From,DATE_FORMAT(a.po_date,'%d.%m.%Y') as Valid_To,CONCAT('000',c.ext_code) as Sold_To_Party,d.ext_code as Material,b.qty as Target_Qty," +
      " Null as Plant,b.sr_no as Line_Item,DATE_FORMAT(a.exp_date,'%d.%m.%Y') as Delivery_Date,b.qty as Order_Qty,c.customer_name as BP_Name,DATE_FORMAT(a.exp_date,'%d.%m.%Y') as ExpectedDeliveryDate,'' as ''" +
      " FROM po_hd as a, po_dt as b,customers as c, products as d, business_units as e" +
      " Where a.po_date=b.po_date and a.po_no=b.po_no" +
      " and a.customer_id=c.customer_id and b.product_id=d.product_id and a.bu_id=e.bu_id" +
      " and a.po_date Between ? and ?"
    //" and a.ftp_date IS NULL and a.po_date = CURRENT_DATE()"; //Between ? and ?
    const params = [minDate.format('YYYY-MM-DD'), maxDate.format('YYYY-MM-DD')];
    // const conn = await pool.getConnection();
    const results = await executeQuery(sqlStr, params);
    // conn.release
    if (results && results.length > 0) {
      const csvData = convertToCsv(results);
      await uploadToFTP(csvData);
      //
      // const conn1 = await pool.getConnection();
      // await conn1.beginTransaction();
      const sqlStr = "UPDATE po_hd as a Set a.ftp_date=CURRENT_TIMESTAMP" +
        " WHERE a.ftp_date IS NULL and a.po_date = CURRENT_DATE()"
      const params = [];
      await executeQuery(sqlStr, params);
      // await conn1.commit();
      // conn1.release

    } else {
      const now = new Date().toLocaleString();
      console.log(`No data was found to upload for the date ${now}`);
    }
  } catch (error) {
    console.error(error);
    //conn.release();
  }
};
//setInterval(selectAndUploadData, 1 * 60 * 1000); // schedule job every hour
const times = [[9, 32], [10, 2], [10, 32], [11, 2], [11, 32], [12, 2], [12, 32], [13, 2], [13, 32], [14, 2], [14, 32],
[15, 2], [15, 32], [16, 2], [16, 32], [17, 2], [17, 32], [18, 2], [18, 32], [19, 2], [19, 32], [20, 2], [20, 32],
[21, 2], [21, 32], [22, 2], [22, 32], [23, 2], [23, 32], [10, 52]]; // run at 9:00 AM, 12:00 PM, and 5:30 PM
// times.forEach((time) => {
//   schedule.scheduleJob({ hour: time[0], minute: time[1] }, selectAndUploadData);
// });

//**************************************//
// const server = https.createServer(httpsOptions, app);
// app.set('port', process.env.PORT || 80);
// server.listen(app.get('port'), function () {
//   console.log('Express server listening on port ' + server.address().port);
// });

// app.set('port', process.env.PORT || 3000);
// var server = app.listen(app.get('port'), function () {
//   console.log('Express server listening on port ' + server.address().port);
// });

app.set('port', 4000);
var server = app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + server.address().port);
});

