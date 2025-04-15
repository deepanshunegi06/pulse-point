import express from 'express';
import { login, register, updateFcmToken } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/fcm-token', authenticate, updateFcmToken);

export default router;