const router = require('express').Router();
const controller = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/login', controller.login);
router.get('/info', auth, controller.getInfo);

module.exports = router;
