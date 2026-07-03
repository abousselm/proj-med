import mongoose from 'mongoose';

const workDaySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      required: true,
      enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    },
    open: { type: String, default: '09:00' },
    close: { type: String, default: '17:00' },
    hasLunchPause: { type: Boolean, default: false },
    lunchOpen: { type: String, default: '13:00' },
    lunchClose: { type: String, default: '14:00' },
  },
  { _id: false }
);

const doctorProfileSchema = new mongoose.Schema(
  {
    // Auth/User linkage
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // Verification/public status
    verificationStatus: { type: String, required: true, enum: ['actif', 'en_attente'], default: 'actif' },
    profileNonVerifiedBadge: { type: Boolean, default: true },

    // Basic catalog fields (still used by /api/doctors)
    cabinetName: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    specialtyOther: { type: String, default: '' },
    address: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: '' },

    // Ratings (legacy)
    ratingAvg: { type: Number, default: null },
    ratingCount: { type: Number, default: null },

    // Professional fields
    licenseNumber: { type: String, required: true, trim: true },
    yearsOfExperience: { type: Number, required: true, min: 0 },
    qualifications: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    shortBio: { type: String, default: '' },

    // Office fields
    officeName: { type: String, default: '' },
    city: { type: String, default: '' },
    governorate: { type: String, default: '' },
    closedDates: { type: [String], default: [] },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },

    // Work hours
    workHours: { type: [workDaySchema], default: [] },
    consultationDurationMinutes: { type: Number, default: 30 },

    // Backward compatibility with current appointment slot logic
    hours: {
      // Kept because /api/doctors slots calculation currently uses hours.open/close
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' },
    },

    // Uploads for verification
    officePhotoUrl: { type: String, default: '' },
    documents: { type: [String], default: [] },

    // Cleanup helpers
    // reserved
  },
  { timestamps: true }
);

export const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);


