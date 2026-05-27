const router = require('express').Router();
const controller = require('../controllers/recordController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/:id/print', controller.printPdf);
router.post('/:id/print/start', controller.startPrint);
router.get('/:id/print/status/:taskId', controller.printStatus);
router.get('/:id/print/download/:taskId', controller.printDownload);
router.post('/:id/print/blank/start', controller.startPrintBlank);
router.get('/:id/print/blank/status/:taskId', controller.printBlankStatus);
router.get('/:id/print/blank/download/:taskId', controller.printBlankDownload);
router.get('/:id', controller.getRecords);
router.put('/:entrustId/rows', controller.updateRows);

module.exports = router;
