import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    note: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['applied', 'shortlisted', 'hired', 'rejected'], default: 'applied' }
  },
  { timestamps: true }
);

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
