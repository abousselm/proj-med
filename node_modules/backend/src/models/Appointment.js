import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    startTime: { type: String, required: true, index: true }, // HH:mm planned

    // Real-time fields
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },

    cabinetOpenedAt: { type: Date },
    startedAt: { type: Date }, // when doctor marks patient as arrived/in progress
    finishedAt: { type: Date },

    plannedStartDateTime: { type: Date },
    estimatedDelayMinutes: { type: Number, default: 0 },

    cancelledReason: { type: String },
  },
  { timestamps: true }
);

// Helpful unique constraint: doctor + patient + date + startTime
appointmentSchema.index({ doctorId: 1, patientId: 1, date: 1, startTime: 1 }, { unique: true });

export const Appointment = mongoose.model('Appointment', appointmentSchema);

