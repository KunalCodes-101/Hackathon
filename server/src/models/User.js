import crypto from 'crypto';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['founder', 'job-seeker'], default: 'founder' },
    region: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true }
  },
  { timestamps: true }
);

userSchema.methods.setPassword = function setPassword(password) {
  this.passwordSalt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = crypto.pbkdf2Sync(password, this.passwordSalt, 120000, 64, 'sha512').toString('hex');
};

userSchema.methods.checkPassword = function checkPassword(password) {
  const hash = crypto.pbkdf2Sync(password, this.passwordSalt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(this.passwordHash, 'hex'), Buffer.from(hash, 'hex'));
};

export const User = mongoose.model('User', userSchema);
