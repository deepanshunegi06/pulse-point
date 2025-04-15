import express from 'express';
import { 
  createBooking, 
  getBookingById, 
  updateBookingStatus,
  getDriverBookings,
  getUserBookings
} from '../controllers/bookingController.js';
import { authenticate, isDriver, isUser } from '../middleware/auth.js';

const router = express.Router();


router.post('/', authenticate, isUser, createBooking);

router.get('/driver/active', authenticate, isDriver, getDriverBookings);
router.get('/user/history', authenticate, isUser, getUserBookings);

router.get('/:id', authenticate, getBookingById);
router.patch('/:id/status', authenticate, isDriver, updateBookingStatus);

export default router;