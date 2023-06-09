import { executeQuery } from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import dotenv from 'dotenv';
dotenv.config();

//const conn = await pool.getConnection();
class authController {

  static getData = async () => {
    try {
      //const conn = await pool.getConnection();
      const rows1 = await executeQuery("SELECT role_id,role_name FROM roles Order By role_name", []);
      //conn.release
      return rows1;
    } catch (error) {
      console.error(error);
      // Handle the error
    } finally {
      //conn.release();
    }
  }

  static register_user = async (req, res) => {
    const role_list = await this.getData();

    if (res.locals.user.user_role == 'Admin') {
      res.render('auth/register', { title: 'Register User', role_list });
    } else {
      res.status(404).send("<h1>The registration service is currently unavailable.</h1>");
      // res.render('auth/register', { title: 'Register User', layout: 'global', role_list });
    }
  }

  static register = async (req, res) => {
    const { username, password, confPassword, first_name, middle_name, last_name, user_role, email_id, mobile_no, user_status } = req.body;
    const data = { username, password, confPassword, first_name, middle_name, last_name, user_role, email_id, mobile_no, user_status }
    const role_list = await this.getData();

    if (username && password && email_id & mobile_no) {
      //return res.status(400).json({ message: 'Enter all required fields' });
      return res.render('auth/register', { alert: 'Username, password, email and mobile are required.', data, role_list });
    }
    // const usernameRegex = /^[A-Za-z0-9_.]+$/;
    // if (!usernameRegex.test(username)) {
    //   return res.render('auth/register', { alert: `Username can only contain alphabets, numbers, underscore (_) and dot (.) characters`, data, role_list });
    // }
    // const maxUsernameLength = 50;
    // if (username.includes(' ') || username.length > maxUsernameLength) {
    //   return res.render('auth/register', { alert: `Username cannot contain spaces and cannot exceed ${maxUsernameLength} characters`, data, role_list });
    // }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_id)) {
      return res.render('auth/register', { alert: `Invalid email format`, data, role_list });
    }
    if (password !== confPassword) {
      //return res.status(400).json({ msg: "Password and Confirm Password do not match" });
      return res.render('auth/register', { alert: `Password and Confirm Password do not match.`, data, role_list });
    }

    // Check if user with same user and email already exists
    //const conn = await pool.getConnection();
    const rows = await executeQuery('SELECT * FROM users WHERE (username=? or email_id=?)', [username, email_id]);
    //conn.release
    if (rows.length > 0) {
      //return res.status(400).json({ message: 'User with same email already exists' });
      return res.render('auth/register', { alert: `User with same username or email already exists`, data, role_list });
    } else {
      try {
        // Genrate max user id
        //const conn1 = await pool.getConnection();
        const rows1 = await executeQuery('SELECT Max(user_id) AS maxNumber FROM users');
        //conn1.release
        var nextUserID = rows1[0].maxNumber + 1;
        //res.status(400).json({ message: 'Next user id is ' + nextUserID });

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(password, salt);
        //const hashedPassword = await bcrypt.hash(password, 10);

        //var c_by =1; //Created by 

        // Insert new user into database
        //const conn = await pool.getConnection();
        // await conn.beginTransaction();
        var status_new = user_status !== null && user_status !== undefined ? user_status : 'A';
        var userRoll_new = user_role !== null && user_role !== undefined ? user_role : 'Dealer';
        var sqlStr = "INSERT INTO users (user_id,username,password,first_name,middle_name,last_name,user_role,email_id,mobile_no,status,c_at,c_by)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),1)"
        await executeQuery(sqlStr,
          [nextUserID, username, hashedPassword, first_name, middle_name, last_name, userRoll_new, email_id, mobile_no, status_new]) //, c_at, c_by
        // await conn.commit();
        //conn.release
        //res.status(201).json({ message: 'User registered successfully', user_id: result.user_id });

        // Generate JWT and return to client
        //const token = jwt.sign({ id: nextUserID, email: email_id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        // Set the JWT as a cookie
        //res.cookie('authToken', token, { httpOnly: false, secure: false, maxAge: 24 * 60 * 60 * 1000 });

        //res.status(201).json({ message: 'User registered successfully', user_id: result.user_id, token: token });
        return res.render('auth/login', { title: 'Register User', layout: 'global', alert: `You are successfully registered with email '${email_id}'` });
        //res.redirect('/');

      } catch (err) {
        // await conn.rollback();
        //conn.release();

        console.error(err);
        //res.status(500).json({ message: 'Internal server error' });
        return res.render('auth/register', { title: 'Register User', layout: 'global', alert: `Internal server error` });
      } finally {
        //conn.release();
      }
    }
  };

  static login = async (req, res) => {
    const { email_id, password } = req.body;

    try {
      //const conn = await pool.getConnection();
      const rows = await executeQuery("SELECT * FROM users WHERE email_id = ? and status='A'", [email_id]);
      //conn.release
      const user = rows[0];
      if (!user) {
        //return res.status(401).json({ message: 'Authentication failed. User not found.' });
        return res.render('auth/login', { email_id, password, title: 'Register User', layout: 'global', alert: `Login failed. Invalid credentials or user is not active.` });
      } else {
        //return res.status(401).json({ message: 'found.' + rows[0] });
        // const now = new Date().toLocaleString();
        // console.log(`User '${user.username}' has login on '${now}'`);
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        //return res.status(401).json({ message: 'Authentication failed. Wrong password.' });
        return res.render('auth/login', { email_id, password, title: 'Register User', layout: 'global', alert: `Login failed. Invalid credentials.` });
      }

      // Generate JWT and return to client
      const token = jwt.sign({ id: user.user_id, email: email_id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      // Set the JWT as a cookie
      res.cookie('authToken', token, { httpOnly: false, secure: false, maxAge: 24 * 60 * 60 * 1000 });
      //res.status(200).json({ message: 'Authentication Successful.', token: token });

      const now = new Date().toLocaleString();
      console.log(`User '${user.username}' has login as '${user.user_role}' on '${now}'`);

      res.redirect('/');

    } catch (error) {
      console.error(error);
      //res.status(500).json({ message: 'Internal server error.' });
      return res.render('auth/login', { title: 'Register User', layout: 'global', alert: `Authentication failed. Internal server error.` });
    } finally {
      //conn.release
    }
  }

  static logout = (req, res) => {
    res.clearCookie('authToken');
    //res.cookie('authToken', '', { maxAge: 0 });
    res.redirect('/');
  }

  static resetPassword = async (req, res) => {
    const { email_id, password } = req.body;
    try {
      //const conn1 = await pool.getConnection();
      const rows = await executeQuery('SELECT * FROM users WHERE email_id = ?', [email_id]);
      //conn1.release
      const user = rows[0];
      if (!user) {
        //return res.status(404).json({ message: 'User not found.' });
        return res.render('auth/reset-password', { alert: `User not found with this credentials.` });
      }

      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);
      //const conn = await pool.getConnection();
      await executeQuery('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, user.user_id]);
      //conn.release
      //res.json({ message: 'Password reset successful.' });
      //return res.render('home', { alert: `Password change successfully. User can login with new password` });
      return res.redirect('/');

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    } finally {
      //conn.release
    }

  }

  static checkToken = async (req, res, next) => {
    const token = req.cookies.authToken;
    if (!token) {
      //return res.redirect('/');
      return res.render('auth/login', { title: 'Register User', layout: 'global' });
      //return res.render('auth/login')
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      //const conn = await pool.getConnection();
      const rows = await executeQuery('SELECT * FROM users WHERE user_id = ?', [decoded.id]);
      //conn.release
      const user = rows[0];

      if (!user) {
        // return res.redirect('/');
        return res.render('auth/login', { title: 'Register User', layout: 'global' });
      }
      res.locals.user = user;
      //console.log(res.locals.user.user_role)

      next();
    } catch (error) {
      console.error(error);
      res.redirect('/');
    } finally {
      //conn.release
    }
  }

};

export default authController