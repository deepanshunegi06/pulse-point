import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { sendNotification } from '../services/firebaseService.js';

export const setupSocketEvents = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Driver sets availability status
    socket.on('driver-availability', async ({ driverId, isAvailable }) => {
      try {
        await User.findByIdAndUpdate(driverId, { isAvailable });
        
        if (isAvailable) {
          socket.join('available_drivers');
          console.log(`Driver ${driverId} is now available`);
        } else {
          socket.leave('available_drivers');
          console.log(`Driver ${driverId} is now unavailable`);
        }
      } catch (error) {
        console.error('Driver availability error:', error);
      }
    });
    
    // Join a specific booking room
    socket.on('join-booking', ({ bookingId }) => {
      socket.join(`booking_${bookingId}`);
      console.log(`Client joined booking room: booking_${bookingId}`);
    });
    
    // Driver accepts a booking
    socket.on('accept-booking', async ({ bookingId, driverId }) => {
      try {
        const booking = await Booking.findById(bookingId);
        
        if (!booking || booking.status !== 'pending') {
          socket.emit('booking-error', { 
            message: 'Booking is no longer available' 
          });
          return;
        }
        
        booking.driver = driverId;
        booking.status = 'assigned';
        await booking.save();
        
        const driver = await User.findById(driverId);
        
        // Emit to the user that a driver has been assigned
        io.to(`booking_${bookingId}`).emit('booking-assigned', {
          bookingId,
          driver: {
            id: driver._id,
            name: driver.name,
            phone: driver.phone,
            currentLocation: driver.currentLocation
          }
        });
        
        // Send push notification to user
        const user = await User.findById(booking.user);
        if (user && user.fcmToken) {
          await sendNotification(
            user.fcmToken,
            'Ambulance Alert',
            'An ambulance has been assigned to you'
          );
        }
        
        console.log(`Booking ${bookingId} assigned to driver ${driverId}`);
      } catch (error) {
        console.error('Accept booking error:', error);
        socket.emit('booking-error', { message: 'Server error' });
      }
    });
    
    // Driver updates location
    socket.on('update-location', async ({ driverId, location, bookingId }) => {
      try {
        await User.findByIdAndUpdate(driverId, { currentLocation: location });
        
        if (bookingId) {
          io.to(`booking_${bookingId}`).emit('location-update', {
            driverId,
            location
          });
          
          // Check if driver is near user (500m) to send notification
          const booking = await Booking.findById(bookingId).populate('user');
          if (
            booking && 
            booking.status === 'en-route' && 
            booking.user && 
            booking.user.fcmToken
          ) {
            const userLocation = booking.pickupLocation;
            const driverLocation = location;
            
            // Calculate distance (simplified version)
            const distance = calculateDistance(
              userLocation.latitude, 
              userLocation.longitude,
              driverLocation.latitude,
              driverLocation.longitude
            );
            
            if (distance <= 0.5) { // 500 meters
              await sendNotification(
                booking.user.fcmToken,
                'Ambulance Alert',
                'The ambulance is almost at your location'
              );
            }
          }
        }
      } catch (error) {
        console.error('Update location error:', error);
      }
    });
    
    // Disconnect event
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

// Helper function to calculate distance between two points (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}