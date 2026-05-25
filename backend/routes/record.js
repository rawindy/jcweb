const router = require('express').Router();
const controller = require('../controllers/recordController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/:id/print', controller.printPdf);
router.get('/:id', controller.getRecords);
router.put('/:entrustId/rows', controller.updateRows);

module.exports = router;
