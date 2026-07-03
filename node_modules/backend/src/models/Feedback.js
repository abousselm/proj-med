import mongoose from 'mongoose';

// Feedback d’un patient sur le médecin
// - rating: 1..5
// - comment: texte
// - doctorId / patientId / appointmentId (optionnel)
const feedbackSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);

// Un feedback par patient+doctor
feedbackSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });

export const Feedback = mongoose.model('Feedback', feedbackSchema);

