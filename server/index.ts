import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleSignUp, handleLogin } from "./routes/auth";
import { handleFindRides, handleMLHealth } from "./routes/rides";
import {
  handleOfferRide,
  handleGetRide,
  handleGetMyRides,
  handleAcceptRide,
  handleRejectRide,
  handleCancelRide
} from "./routes/rideOffers";
import {
  handleBookRide,
  handleGetRideBookings,
  handleAcceptBooking,
  handleRejectBooking,
  handleGetBooking,
  handleGetPassengerBookings,
  handleCancelBooking,
} from "./routes/bookings";
import { calculateRealDistance } from "./utils/distance";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Debug endpoint for distance testing
  app.post("/api/debug/test-distance", async (req, res) => {
    try {
      const { pickup, dropoff } = req.body;

      if (!pickup || !dropoff) {
        return res.status(400).json({ error: "pickup and dropoff required" });
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`🧪 DEBUG TEST: Distance calculation`);
      console.log(`   Pickup: "${pickup}"`);
      console.log(`   Dropoff: "${dropoff}"`);
      console.log(`${'='.repeat(70)}`);

      // Use dynamic import to get calculateRealDistance
      const { calculateRealDistance: calcDist } = await import('./utils/distance');
      const distance = await calcDist(pickup, dropoff);

      console.log(`\n✅ Test Result: ${distance.toFixed(2)} km\n`);

      res.json({
        pickup,
        dropoff,
        distanceInKm: distance,
        pricePerSeat: Math.round(50 + distance * 8),
      });
    } catch (error) {
      console.error("Debug test error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Authentication routes
  app.post("/api/auth/signup", handleSignUp);
  app.post("/api/auth/login", handleLogin);

  // Ride finding routes
  app.post("/api/rides/find", handleFindRides);
  app.get("/api/health/ml", handleMLHealth);

  // Ride offer routes
  app.post("/api/rides/offer", handleOfferRide);
  app.get("/api/rides/:rideId", handleGetRide);
  app.get("/api/rides/my/rides", handleGetMyRides);
  app.post("/api/rides/:rideId/accept", handleAcceptRide);
  app.post("/api/rides/:rideId/reject", handleRejectRide);
  app.post("/api/rides/:rideId/cancel", handleCancelRide);

  // Booking routes (passenger books a ride)
  app.post("/api/bookings", handleBookRide);
  app.get("/api/rides/:rideId/bookings", handleGetRideBookings);
  app.post("/api/bookings/:bookingId/accept", handleAcceptBooking);
  app.post("/api/bookings/:bookingId/reject", handleRejectBooking);
  app.get("/api/bookings/:bookingId", handleGetBooking);
  app.get("/api/bookings/passenger/:passengerId", handleGetPassengerBookings);
  app.post("/api/bookings/:bookingId/cancel", handleCancelBooking);

  return app;
}
