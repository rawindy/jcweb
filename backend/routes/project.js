const router = require('express').Router();
const controller = require('../controllers/projectController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/search', controller.search);
router.get('/', controller.list);
router.get('/:project_no', controller.getByNo);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
