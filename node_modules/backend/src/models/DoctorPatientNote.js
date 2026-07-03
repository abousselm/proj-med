import mongoose from 'mongoose';

const doctorPatientNoteSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Private free-text notes written by the doctor (doctor-only visibility)
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// One note document per doctor+patient
doctorPatientNoteSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });

export const DoctorPatientNote = mongoose.model('DoctorPatientNote', doctorPatientNoteSchema);

