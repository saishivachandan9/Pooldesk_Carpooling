import { RequestHandler } from 'express';
import { connectToDatabase } from '../db';
import Booking from '../models/Booking';
import Ride from '../models/Ride';

/**
 * Request to book a ride (passenger books)
 */
export const handleBookRide: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const {
      rideId,
      passengerId,
      passengerName,
      passengerEmail,
      seatsToBook,
      passengerDetails,
    } = req.body;

    if (!rideId || !passengerId || !passengerName || !passengerEmail || !seatsToBook || !passengerDetails) {
      res.status(400).json({
        error: 'Missing required fields: rideId, passengerId, passengerName, passengerEmail, seatsToBook, passengerDetails',
      });
      return;
    }

    // Get ride details
    const ride = await Ride.findById(rideId);
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    if (ride.status !== 'active') {
      res.status(400).json({ error: 'Ride is no longer active' });
      return;
    }

    // Check if enough seats available
    if (seatsToBook > ride.availableSeats) {
      res.status(400).json({ error: `Only ${ride.availableSeats} seats available` });
      return;
    }

    // Check if already booked
    const existingBooking = await Booking.findOne({
      rideId,
      passengerId,
      status: { $in: ['pending', 'accepted'] },
    });

    if (existingBooking) {
      res.status(400).json({ error: 'You already have a booking for this ride' });
      return;
    }

    // Create booking
    const booking = new Booking({
      rideId,
      driverId: ride.driverId,
      driverName: ride.driverName,
      driverEmail: ride.driverEmail,
      passengerId,
      passengerName,
      passengerEmail,
      seatsBooked: seatsToBook,
      passengerDetails,
      pickupLocation: ride.pickupLocation,
      dropoffLocation: ride.dropoffLocation,
      date: ride.date,
      time: ride.time,
      carBrand: ride.carBrand,
      carModel: ride.carModel,
      status: 'pending',
      pricePerSeat: ride.pricePerSeat,
      distanceTravelledInKm: ride.distanceTravelledInKm,
    });

    await booking.save();

    res.status(201).json({
      message: 'Booking request sent to driver',
      booking: {
        id: booking._id,
        status: booking.status,
        seatsBooked: booking.seatsBooked,
        driverName: booking.driverName,
        driverEmail: booking.driverEmail,
        createdAt: booking.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error booking ride:', error);
    res.status(500).json({ error: 'Failed to book ride' });
  }
};

/**
 * Get pending bookings for a ride (for driver to see notifications)
 */
export const handleGetRideBookings: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const { rideId } = req.params;

    if (!rideId) {
      res.status(400).json({ error: 'Ride ID is required' });
      return;
    }

    // Get all pending bookings for this ride
    const bookings = await Booking.find({
      rideId,
      status: 'pending',
    }).sort({ createdAt: -1 });

    res.status(200).json({
      bookings,
      total: bookings.length,
    });
  } catch (error: any) {
    console.error('Error getting bookings:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
};

/**
 * Accept a booking (driver accepts passenger)
 */
export const handleAcceptBooking: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const { bookingId } = req.params;
    const { driverId } = req.body;

    if (!bookingId || !driverId) {
      res.status(400).json({ error: 'Booking ID and Driver ID are required' });
      return;
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.driverId !== driverId) {
      res.status(403).json({ error: 'Unauthorized - not the ride owner' });
      return;
    }

    if (booking.status !== 'pending') {
      res.status(400).json({ error: 'Booking is no longer pending' });
      return;
    }

    // Update booking status
    booking.status = 'accepted';
    await booking.save();

    // Update ride to track booked seats and reduce available seats
    const ride = await Ride.findById(booking.rideId);
    if (ride) {
      ride.availableSeats = Math.max(0, ride.availableSeats - booking.seatsBooked);
      ride.bookedSeats = (ride.bookedSeats || 0) + booking.seatsBooked;

      // Add to accepted bookings array
      if (!ride.acceptedBookings) {
        ride.acceptedBookings = [];
      }
      ride.acceptedBookings.push(bookingId);

      // If no more seats available, mark as completed
      if (ride.availableSeats === 0) {
        ride.status = 'completed';
      }

      await ride.save();
    }

    res.status(200).json({
      message: 'Booking accepted',
      booking,
      notification: {
        type: 'booking_accepted',
        seatsBooked: booking.seatsBooked,
        passengerName: booking.passengerName,
        passengerEmail: booking.passengerEmail,
        driverName: booking.driverName,
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        date: booking.date,
        time: booking.time,
        carBrand: booking.carBrand,
        carModel: booking.carModel,
      },
    });
  } catch (error: any) {
    console.error('Error accepting booking:', error);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
};

/**
 * Reject a booking (driver rejects passenger)
 */
export const handleRejectBooking: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const { bookingId } = req.params;
    const { driverId } = req.body;

    if (!bookingId || !driverId) {
      res.status(400).json({ error: 'Booking ID and Driver ID are required' });
      return;
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.driverId !== driverId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Only allow rejection of pending bookings
    if (booking.status !== 'pending') {
      res.status(400).json({ error: 'Only pending bookings can be rejected' });
      return;
    }

    booking.status = 'rejected';
    await booking.save();

    res.status(200).json({
      message: 'Booking rejected',
      booking,
    });
  } catch (error: any) {
    console.error('Error rejecting booking:', error);
    res.status(500).json({ error: 'Failed to reject booking' });
  }
};

/**
 * Get booking details for passenger
 */
export const handleGetBooking: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const { bookingId } = req.params;

    if (!bookingId) {
      res.status(400).json({ error: 'Booking ID is required' });
      return;
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    res.status(200).json(booking);
  } catch (error: any) {
    console.error('Error getting booking:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
};

/**
 * Get all bookings for a passenger
 */
export const handleGetPassengerBookings: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const { passengerId } = req.query;

    if (!passengerId) {
      res.status(400).json({ error: 'Passenger ID is required' });
      return;
    }

    const bookings = await Booking.find({ passengerId }).sort({ createdAt: -1 });

    res.status(200).json({
      bookings,
      total: bookings.length,
    });
  } catch (error: any) {
    console.error('Error getting passenger bookings:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
};

/**
 * Cancel a booking (passenger cancels)
 */
export const handleCancelBooking: RequestHandler = async (req, res) => {
  try {
    await connectToDatabase();

    const { bookingId } = req.params;
    const { passengerId } = req.body;

    if (!bookingId || !passengerId) {
      res.status(400).json({ error: 'Booking ID and Passenger ID are required' });
      return;
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.passengerId !== passengerId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot cancel this booking' });
      return;
    }

    const wasAccepted = booking.status === 'accepted';

    booking.status = 'cancelled';
    await booking.save();

    // If booking was accepted, restore available seats
    if (wasAccepted) {
      const ride = await Ride.findById(booking.rideId);
      if (ride) {
        ride.availableSeats += booking.seatsBooked;
        ride.bookedSeats = Math.max(0, (ride.bookedSeats || 0) - booking.seatsBooked);

        // Remove from accepted bookings array
        if (ride.acceptedBookings) {
          ride.acceptedBookings = ride.acceptedBookings.filter(id => id.toString() !== bookingId);
        }

        // Mark as active again if it was completed due to no seats
        if (ride.status === 'completed' && ride.availableSeats > 0) {
          ride.status = 'active';
        }

        await ride.save();
      }
    }

    res.status(200).json({
      message: 'Booking cancelled',
      booking,
    });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};
