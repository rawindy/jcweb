const router = require('express').Router();
const controller = require('../controllers/recordController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/:entrustNo/print', controller.printPdf);
router.post('/:entrustNo/print/start', controller.startPrint);
router.get('/:entrustNo/print/status/:taskId', controller.printStatus);
router.get('/:entrustNo/print/download/:taskId', controller.printDownload);
router.post('/:entrustNo/print/blank/start', controller.startPrintBlank);
router.get('/:entrustNo/print/blank/status/:taskId', controller.printBlankStatus);
router.get('/:entrustNo/print/blank/download/:taskId', controller.printBlankDownload);
router.get('/:entrustNo', controller.getRecords);
router.put('/:entrustNo/rows', controller.updateRows);

module.exports = router;
