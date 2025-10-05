import { executeQuery } from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import moment from 'moment';

import dotenv from 'dotenv';
dotenv.config();


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
        var c_by = res.locals.user !== null && res.locals.user !== undefined ? res.locals.user.user_id : 0;
        var status_new = user_status !== null && user_status !== undefined ? user_status : 'A';
        var userRoll_new = user_role !== null && user_role !== undefined ? user_role : 'Dealer';
        var sqlStr = "INSERT INTO users (user_id,username,password,first_name,middle_name,last_name,user_role,email_id,mobile_no,status,c_at,c_by)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP( ),?)"
        await executeQuery(sqlStr,
          [nextUserID, username, hashedPassword, first_name, middle_name, last_name, userRoll_new, email_id, mobile_no, status_new, c_by]) //, c_at, c_by
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


  //***OTP base reset user password */
  static resetPwd = async (req, res) => {
    try {
      if (!res.locals.user.user_id) {
        res.status(500).json({ success: false, message: 'Not login user' });
      }

      const sqlStr = "Select * From users Where user_id=?"
      const params = [res.locals.user.user_id];
      const result = await executeQuery(sqlStr, params);
      const userData = result.length > 0 ? result[0] : null;

      res.render('auth/reset-pwd', { title: 'Reset Password', userData });

    } catch (error) {
      console.error(error);
      // res.status(500).json({ success: false, message: 'Internal Server Error' });
      return res.render('auth/reset-pwd', { alert: `Internal server error`, title: 'Reset Password', userData });
    }
  }

  // static sendOTP = async (req, res) => {
  //   const { mobile_no } = req.body;
  //   const userData = req.body
  //   try {
  //     var errors = [];
  //     if (!mobile_no || mobile_no.length !== 10) {
  //       errors.push({ message: 'Enter valid mobile number' });
  //     }
  //     if (errors.length) {
  //       return res.render('auth/reset-pwd', { errors, title: 'Reset Password', userData });
  //     }

  //     // Template ID – 1707170609322119024
  //     // Content - Dear {#var#}, your OTP for password reset is {#var#}, which is valid for 10 minutes. MALPANI
  //     // Template ID -  1707170609314821433 
  //     // Content -  Dear SalesSwift user, your OTP for password reset is {#var#}, which is valid for 10 minutes. MALPANI

  //     const otp = Math.floor(100000 + Math.random() * 900000).toString();
  //     const expTime = moment().format('YYYY-MM-DD HH:mm:ss'); // moment().add(30, 'minutes').toDate();
  //     console.log('OTP: ' + otp + ' User ID: ' + res.locals.user.user_id + ' Mobile: ' + mobile_no);

  //     const message = `Dear SalesSwift user, your OTP for password reset is ${otp}, which is valid for 10 minutes. MALPANI`
  //     const baseURL = `https://nimbusit.co.in/api/swsend.asp?username=t1malpani&password=maplani&sender=MALPNI&sendto=${mobile_no}&message=${message}&entityID=1201159436561584634&TemplateID=1707170609314821433`;

  //     const response = await fetch(baseURL);
  //     if (response.ok) {

  //       const sqlStr = "Update users Set otp=?, exp_time=? Where user_id=?"
  //       const params = [otp, expTime, res.locals.user.user_id];
  //       await executeQuery(sqlStr, params);

  //       return res.render('auth/reset-pwd', { title: 'Reset Password', userData, otpData: { otp, expTime } });

  //     } else {
  //       return res.render('auth/reset-pwd', { alert: `Failed to send messages`, title: 'Reset Password', userData });
  //     }

  //   } catch (error) {
  //     console.error(error);
  //     return res.render('auth/reset-pwd', { alert: `Internal server error`, title: 'Reset Password', userData });
  //   }
  // }

  // Update the existing sendOTP method to use common functions

  static sendOTP = async (req, res) => {
    const { mobile_no } = req.body;
    const userData = req.body;

    try {
      if (!this.validateMobileNumber(mobile_no)) {
        return res.render('auth/reset-pwd', {
          alert: 'Enter valid mobile number',
          title: 'Reset Password',
          userData
        });
      }

      const otp = this.generateOTP();
      const expTime = moment().format('YYYY-MM-DD HH:mm:ss');

      console.log('OTP: ' + otp + ' User ID: ' + res.locals.user.user_id + ' Mobile: ' + mobile_no);

      const message = `Dear SalesSwift user, your OTP for password reset is ${otp}, which is valid for ${this.OTP_CONFIG.expiryMinutes} minutes. MALPANI`;
      const smsSent = await this.sendSMS(mobile_no, message);

      if (smsSent) {
        const sqlStr = "Update users Set otp=?, exp_time=? Where user_id=?";
        const params = [otp, expTime, res.locals.user.user_id];
        await executeQuery(sqlStr, params);

        return res.render('auth/reset-pwd', {
          title: 'Reset Password',
          userData,
          otpData: { otp, expTime }
        });
      } else {
        return res.render('auth/reset-pwd', {
          alert: `Failed to send OTP`,
          title: 'Reset Password',
          userData
        });
      }
    } catch (error) {
      console.error(error);
      return res.render('auth/reset-pwd', {
        alert: `Internal server error`,
        title: 'Reset Password',
        userData
      });
    }
  }

  static validateOTP = async (req, res) => {
    const { input_otp } = req.body;
    try {
      const sqlStr = "Select * From users Where user_id=?"
      const params = [res.locals.user.user_id];
      const result = await executeQuery(sqlStr, params);
      const userData = result.length > 0 ? result[0] : null;

      var errors = [];
      if (userData.length === 0) {
        errors.push({ message: 'Not valid user' });
      }
      if (!input_otp || input_otp.length !== 6) {
        errors.push({ message: 'Invalid OTP!' });
      }
      if (errors.length) {
        res.render('auth/reset-pwd', { errors, title: 'Reset Password', userData });
        return
      }

      const userDataExpTime = moment(userData.exp_time).format('YYYY-MM-DD HH:mm:ss');
      const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
      const diffMin = Math.abs(moment(userDataExpTime).diff(moment(currentTime), 'minutes'));
      // console.log('Diff Minutes ...' + diffMin);

      if (userData.otp == input_otp && diffMin < 15) {
        return res.render('auth/reset-password', { title: 'Reset Password', data: userData });
      } else {
        return res.render('auth/reset-pwd', { alert: 'Invalid OTP or Expired!', title: 'Reset Password', userData });
      }

    } catch (error) {
      console.error(error);
      return res.render('auth/reset-pwd', { alert: `Internal server error`, title: 'Reset Password' });
    }
  }
  //*** End OTP base reset user password */



  // Add these constants at the top of the class
  static SMS_CONFIG = {
    username: process.env.SMS_USERNAME || 't1malpani',
    password: process.env.SMS_PASSWORD || 'maplani',
    sender: process.env.SMS_SENDER || 'MALPNI',
    templateId: process.env.SMS_TEMPLATE_ID || '1707170609314821433',
    entityId: process.env.SMS_ENTITY_ID || '1201159436561584634'
  };

  static OTP_CONFIG = {
    length: 6,
    expiryMinutes: 10,
    maxAttempts: 3
  };

  // Common utility methods
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async sendSMS(mobile_no, message) {
    try {
      const baseURL = `https://nimbusit.co.in/api/swsend.asp?username=${this.SMS_CONFIG.username}&password=${this.SMS_CONFIG.password}&sender=${this.SMS_CONFIG.sender}&sendto=${mobile_no}&message=${encodeURIComponent(message)}&entityID=${this.SMS_CONFIG.entityId}&TemplateID=${this.SMS_CONFIG.templateId}`;
      const response = await fetch(baseURL);
      return response.ok;
    } catch (error) {
      console.error('SMS sending failed:', error);
      return false;
    }
  }

  static validateOTPInput(otp) {
    return otp && /^\d{6}$/.test(otp);
  }

  static validateMobileNumber(mobile_no) {
    return mobile_no && /^\d{10}$/.test(mobile_no);
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email && emailRegex.test(email);
  }

  static sanitizeMobileNumber(mobile_no) {
    if (Array.isArray(mobile_no)) {
      return mobile_no[0]; // Take first element if it's an array
    }
    if (typeof mobile_no === 'string') {
      return mobile_no.replace(/[^0-9]/g, ''); // Remove any non-numeric characters
    }
    return mobile_no;
  }

  static validatePasswordReset(password, confPassword) {
    if (!password || !confPassword) {
      return 'Please enter both password fields';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (password !== confPassword) {
      return 'Password and Confirm Password do not match';
    }
    return null;
  }

  // *** Optimized Forgot Password Flow with Email+Mobile Verification ***
  static forgotPasswordSendOTP = async (req, res) => {
    const { email_id, mobile_no } = req.body;

    try {
      // Validate inputs
      if (!this.validateEmail(email_id)) {
        return res.render('auth/forgot-password', {
          alert: 'Please enter a valid email address',
          email_id,
          mobile_no
        });
      }

      if (!this.validateMobileNumber(mobile_no)) {
        return res.render('auth/forgot-password', {
          alert: 'Please enter a valid 10-digit mobile number',
          email_id,
          mobile_no
        });
      }

      // Check if user exists with both email AND mobile number
      const rows = await executeQuery(
        'SELECT user_id, username, email_id, mobile_no FROM users WHERE email_id = ? AND mobile_no = ? AND status = "A"',
        [email_id, mobile_no]
      );

      const user = rows[0];

      if (!user) {
        return res.render('auth/forgot-password', {
          alert: 'No active user found with this email and mobile number combination',
          email_id,
          mobile_no
        });
      }

      // Generate OTP
      const otp = this.generateOTP();
      const expTime = moment().add(this.OTP_CONFIG.expiryMinutes, 'minutes').format('YYYY-MM-DD HH:mm:ss');

      console.log(`Forgot Password OTP: ${otp} for User: ${user.username} (Email: ${email_id}, Mobile: ${mobile_no})`);

      // Send OTP via SMS
      const message = `Dear SalesSwift user, your OTP for password reset is ${otp}, which is valid for ${this.OTP_CONFIG.expiryMinutes} minutes. MALPANI`;
      const smsSent = await this.sendSMS(mobile_no, message);

      if (smsSent) {
        // Store OTP and expiry time in database
        await executeQuery(
          'UPDATE users SET otp = ?, exp_time = ? WHERE email_id = ? AND mobile_no = ?',
          [otp, expTime, email_id, mobile_no]
        );

        // Render OTP verification page
        res.render('auth/verify-forgot-otp', {
          title: 'Verify OTP',
          email_id,
          mobile_no,
          alert: 'OTP sent successfully to your mobile number'
        });
      } else {
        return res.render('auth/forgot-password', {
          alert: 'Failed to send OTP. Please try again.',
          email_id,
          mobile_no
        });
      }

    } catch (error) {
      console.error('Forgot Password Send OTP Error:', error);
      return res.render('auth/forgot-password', {
        alert: 'Internal server error. Please try again.',
        email_id,
        mobile_no
      });
    }
  }

  static forgotPasswordVerifyOTP = async (req, res) => {
    let { email_id, mobile_no, input_otp } = req.body;

    // Sanitize mobile number input
    mobile_no = this.sanitizeMobileNumber(mobile_no);

    // console.log(`Verifying OTP: ${input_otp} for Email: ${email_id}, Mobile: ${mobile_no}`);
    // console.log('Raw request body:', req.body);
    // console.log('Email:', email_id);
    // console.log('Mobile:', mobile_no);
    // console.log('Mobile type:', typeof mobile_no);
    // console.log('Mobile length:', mobile_no.length);

    try {
      // Validate inputs
      if (!this.validateEmail(email_id) || !this.validateMobileNumber(mobile_no)) {
        return res.render('auth/verify-forgot-otp', {
          alert: 'Invalid email or mobile number',
          email_id,
          mobile_no
        });
      }

      if (!this.validateOTPInput(input_otp)) {
        return res.render('auth/verify-forgot-otp', {
          alert: 'Please enter a valid 6-digit OTP',
          email_id,
          mobile_no
        });
      }

      // Get user data
      const rows = await executeQuery(
        'SELECT user_id, otp, exp_time FROM users WHERE email_id = ? AND mobile_no = ? AND status = "A"',
        [email_id, mobile_no]
      );

      const user = rows[0];

      if (!user) {
        return res.render('auth/verify-forgot-otp', {
          alert: 'User not found or account is inactive',
          email_id,
          mobile_no
        });
      }

      // Check if OTP exists and is not expired
      if (!user.otp || !user.exp_time) {
        return res.render('auth/verify-forgot-otp', {
          alert: 'No OTP found. Please request a new OTP.',
          email_id,
          mobile_no
        });
      }

      // Check OTP validity
      const currentTime = moment();
      const expTime = moment(user.exp_time);
      const diffMin = Math.abs(expTime.diff(currentTime, 'minutes'));

      if (user.otp === input_otp && diffMin < this.OTP_CONFIG.expiryMinutes) {
        // OTP is valid, generate reset token
        const resetToken = jwt.sign(
          {
            id: user.user_id,
            email: email_id,
            mobile: mobile_no,
            purpose: 'password_reset'
          },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        // Set reset token as cookie
        res.cookie('resetToken', resetToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 15 * 60 * 1000
        });

        // Clear OTP after successful verification
        await executeQuery(
          'UPDATE users SET otp = NULL, exp_time = NULL WHERE email_id = ? AND mobile_no = ?',
          [email_id, mobile_no]
        );

        // Render password reset form
        res.render('auth/reset-forgot-password', {
          title: 'Reset Password',
          email_id,
          mobile_no,
          alert: 'OTP verified successfully. Please set your new password.'
        });
      } else {
        return res.render('auth/verify-forgot-otp', {
          alert: 'Invalid OTP or OTP has expired',
          email_id,
          mobile_no
        });
      }

    } catch (error) {
      console.error('Forgot Password Verify OTP Error:', error);
      return res.render('auth/verify-forgot-otp', {
        alert: 'Internal server error. Please try again.',
        email_id,
        mobile_no
      });
    }
  }
  
  static forgotPasswordReset = async (req, res) => {
    const { password, confPassword, email_id, mobile_no } = req.body;
    const resetToken = req.cookies.resetToken;

    try {
      // Verify reset token
      if (!resetToken) {
        return res.render('auth/forgot-password', {
          alert: 'Reset session expired. Please start the process again.'
        });
      }

      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

      if (decoded.purpose !== 'password_reset' || decoded.email !== email_id || decoded.mobile !== mobile_no) {
        return res.render('auth/forgot-password', {
          alert: 'Invalid reset token'
        });
      }

      // Validate passwords
      const validationError = this.validatePasswordReset(password, confPassword);
      if (validationError) {
        return res.render('auth/reset-forgot-password', {
          alert: validationError,
          email_id,
          mobile_no
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update password in database
      await executeQuery(
        'UPDATE users SET password = ? WHERE email_id = ? AND mobile_no = ?',
        [hashedPassword, email_id, mobile_no]
      );

      // Clear reset token cookie
      res.clearCookie('resetToken');

      // Log the password reset
      console.log(`Password reset successfully for user: ${email_id} (Mobile: ${mobile_no})`);

      // Render success page
      res.render('auth/login', {
        title: 'Login',
        alert: 'Password reset successfully! Please login with your new password.'
      });

    } catch (error) {
      console.error('Forgot Password Reset Error:', error);

      if (error.name === 'TokenExpiredError') {
        return res.render('auth/forgot-password', {
          alert: 'Reset session expired. Please start again.'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.render('auth/forgot-password', {
          alert: 'Invalid reset token'
        });
      }

      return res.render('auth/reset-forgot-password', {
        alert: 'Internal server error. Please try again.',
        email_id,
        mobile_no
      });
    }
  }
  // *** End Forgot password flow - FIXED ***

};

export default authController