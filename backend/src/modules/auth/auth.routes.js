const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/register', controller.register); // self-service: creates School + SCHOOL_ADMIN
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

module.exports = router;
