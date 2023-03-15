import express from "express";
const router = express.Router();
import authController from "../controller/authController.js"


// Set up authentication routes
router.get('/register', (req, res) => {
    res.render('auth/register', { title: 'Register User', layout: 'global' });
});
//router.get('/register', authController.register_user);

router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'Register User', layout: 'global' });
});
router.get('/reset-password', authController.checkToken, (req, res) => {
    if (res.locals.user.user_role === 'Admin'){
        res.render('auth/reset-password');    
    }else{
        res.render('home',{alert:'You are not authorised user!'});
    }
});

router.post('/register', authController.register); //authController.validateUserRegistration,
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/reset-password', authController.resetPassword);
router.post('/check-token', authController.checkToken);

export default router;