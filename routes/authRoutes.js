import express from "express";
const router = express.Router();
import authController from "../controller/authController.js"

// Set up authentication routes
router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'Register User' });
});

router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', { title: 'Forgot Password' });
});

router.get('/reset-password', authController.checkToken, (req, res) => {
    if (res.locals.user.user_role === 'Admin'){
        res.render('auth/reset-password');    
    }else{
        res.render('home',{alert:'You are not authorised user!'});
    }
});

router.get('/register', authController.checkToken,  authController.register_user);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/reset-password', authController.resetPassword);
router.post('/check-token', authController.checkToken);

router.get('/reset-pwd', authController.checkToken, authController.resetPwd);
router.post('/send-otp', authController.checkToken, authController.sendOTP);
router.post('/reset-pwd', authController.checkToken, authController.validateOTP);

// New routes for forgot password flow
router.post('/forgot-password/send-otp', authController.forgotPasswordSendOTP);
router.post('/forgot-password/verify-otp', authController.forgotPasswordVerifyOTP);
router.post('/forgot-password/reset', authController.forgotPasswordReset);

export default router;