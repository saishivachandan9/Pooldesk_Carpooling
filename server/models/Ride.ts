import mongoose, { Schema, model, Document } from 'mongoose';

export interface IRide extends Document {
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverGender: string;
  pickupLocation: string;
  dropoffLocation: string;
  date: string;
  time: string;
  carBrand: string;
  carModel: string;
  totalSeats: number;
  availableSeats: number;
  bookedSeats: number;
  passengerPreference: string;
  status: 'active' | 'completed' | 'cancelled';
  acceptedBookings: string[]; // Array of booking IDs that have been accepted
  distanceTravelledInKm: number; // Estimated distance in kilometers
  pricePerSeat: number; // Price per seat in rupees
  createdAt: Date;
  updatedAt: Date;
}

const rideSchema = new Schema(
  {
    driverId: { type: String, required: true, index: true },
    driverName: { type: String, required: true },
    driverEmail: { type: String, required: true },
    driverGender: { type: String, required: true },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    carBrand: { type: String, required: true },
    carModel: { type: String, required: true },
    totalSeats: { type: Number, required: true, min: 1, max: 7 },
    availableSeats: { type: Number, required: true, min: 0, max: 7 },
    bookedSeats: { type: Number, default: 0, min: 0 },
    passengerPreference: {
      type: String,
      enum: ['any', 'male', 'female'],
      default: 'any'
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    acceptedBookings: [{ type: String, default: [] }],
    distanceTravelledInKm: { type: Number, required: true, min: 0 },
    pricePerSeat: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// Index for finding active rides
rideSchema.index({ status: 1, date: 1, driverId: 1 });

// Export model, checking if it already exists (for hot reload compatibility)
export default mongoose.models.Ride || model<IRide>('Ride', rideSchema);
