const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');
const requireAuth = require('../../middleware/auth.middleware');

router.post('/register', controller.register); // self-service: creates School + SCHOOL_ADMIN
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

router.post('/verify-email', requireAuth, controller.verifyEmail);
router.post('/resend-verification', requireAuth, controller.resendVerificationCode);
router.post('/change-password', requireAuth, controller.changePassword);

module.exports = router;
