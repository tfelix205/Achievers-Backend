const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ajoController = require('../controllers/ajoController');

router.post('/', auth, ajoController.createAjoGroup);
router.get('/', auth, ajoController.getAllGroups);
router.get('/my', auth, ajoController.myAjoGroups);
router.post('/:id/join', auth, ajoController.joinAjoGroup);
router.post('/:id/contribute', auth, ajoController.contribute);
router.get('/:id', auth, ajoController.getGroupDetails);
router.post('/run-payouts', ajoController.runPayoutsManually);


module.exports = router;
