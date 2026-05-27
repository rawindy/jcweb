const router = require('express').Router();
const controller = require('../controllers/reportController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/:id/data', controller.getReportData);
router.post('/:id/save', controller.saveReportData);
router.post('/:id/print/start', controller.startPrint);
router.get('/:id/print/status/:taskId', controller.printStatus);
router.get('/:id/print/download/:taskId', controller.printDownload);

module.exports = router;
