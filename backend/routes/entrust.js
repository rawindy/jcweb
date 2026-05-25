const router = require('express').Router();
const controller = require('../controllers/entrustController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', controller.list);
router.get('/:id', controller.detail);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.del);

module.exports = router;
