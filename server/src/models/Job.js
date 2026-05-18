import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
    founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startupName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true, index: true },
    area: { type: String, trim: true, default: '' },
    requirement: { type: String, required: true, trim: true },
    openings: { type: Number, min: 1, default: 1 },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true }
  },
  { timestamps: true }
);

export const Job = mongoose.model('Job', jobSchema);
