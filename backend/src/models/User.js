const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const expertiseSchema = new mongoose.Schema({
  domain: { type: String, required: true },
  tags: [String],
  yearsOfExperience: Number,
  description: String,
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'customer', 'service_provider'], required: true },
    phone: { type: String },
    avatar: { type: String, default: '' },

    // Service Provider fields
    bio: { type: String },
    expertise: [expertiseSchema],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function () {
        return this.role === 'service_provider' ? 'pending' : 'approved';
      },
    },
    rejectionReason: { type: String },
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },

    // Online status for socket
    socketId: { type: String },
    isOnline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields when converting to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.socketId;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
