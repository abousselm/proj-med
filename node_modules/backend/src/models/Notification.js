import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['CABINET_OPENED', 'TURN_INCOMING', 'TURN_NOW', 'DELAY_CHANGED', 'APPOINTMENT_CANCELLED'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);

