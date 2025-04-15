import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { io } from '../server.js';
import { sendNotification } from '../services/firebaseService.js';

// Create a new booking
export const createBooking = async (req, res) => {
  try {
    const { pickupLocation, notes } = req.body;
    
    const booking = new Booking({
      user: req.user.id,
      pickupLocation,
      notes
    });
    
    await booking.save();
    
    // Emit to all available drivers
    const availableDrivers = await User.find({ 
      role: 'driver', 
      isAvailable: true 
    });
    
    io.to('available_drivers').emit('new-booking', {
      booking: {
        id: booking._id,
        pickupLocation: booking.pickupLocation,
        user: {
          id: req.user.id,
          name: req.user.name,
          phone: req.user.phone
        },
        status: booking.status,
        createdAt: booking.createdAt
      }
    });
    
    res.status(201).json({ booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get booking by ID
// Get booking by ID
export const getBookingById = async (req, res) => {
  const bookingId = req.params.id;

  // Validate ObjectId
  if (!bookingId || !bookingId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: 'Invalid booking ID' });
  }

  try {
    const booking = await Booking.findById(bookingId)
      .populate('user', 'name phone')
      .populate('driver', 'name phone currentLocation');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user is authorized to view this booking
    const isUser = booking.user._id.toString() === req.user.id.toString();
    const isDriver = booking.driver && booking.driver._id.toString() === req.user.id.toString();

    if (!isUser && !isDriver) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Update booking status
export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Check if driver is assigned to this booking
    if (booking.driver && booking.driver.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // If status is 'assigned' and no driver is assigned yet, assign this driver
    if (status === 'assigned' && !booking.driver) {
      booking.driver = req.user.id;
    }
    
    booking.status = status;
    await booking.save();
    
    // Emit status update to the booking room
    io.to(`booking_${booking._id}`).emit('status-update', {
      bookingId: booking._id,
      status: booking.status
    });
    
    // Send push notification to user
    const user = await User.findById(booking.user);
    if (user && user.fcmToken) {
      let message = '';
      
      switch (status) {
        case 'assigned':
          message = 'An ambulance has been assigned to you';
          break;
        case 'en-route':
          message = 'The ambulance is on its way';
          break;
        case 'arrived':
          message = 'The ambulance has arrived at your location';
          break;
        case 'completed':
          message = 'Your booking has been completed';
          break;
      }
      
      if (message) {
        await sendNotification(user.fcmToken, 'Ambulance Alert', message);
      }
    }
    
    res.json({ booking });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get driver's active bookings
export const getDriverBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      driver: req.user.id,
      status: { $nin: ['completed', 'cancelled'] }
    }).populate('user', 'name phone');
    
    res.json({ bookings });
  } catch (error) {
    console.error('Get driver bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's booking history
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user.id
    }).populate('driver', 'name phone').sort({ createdAt: -1 });
    
    res.json({ bookings });
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};