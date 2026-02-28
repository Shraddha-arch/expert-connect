const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notifiedAt: { type: Date, default: Date.now },
  response: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
  respondedAt: { type: Date },
});

const taskSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceProviderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Customer's original request
    description: { type: String, required: true },

    // AI-extracted tags and matched domains
    aiTags: [String],
    matchedDomains: [String],

    // Task status flow
    status: {
      type: String,
      enum: ['open', 'notifying', 'assigned', 'in_progress', 'pending_completion', 'completed', 'cancelled', 'expired'],
      default: 'open',
    },

    // Price quoted by provider at accept time
    price: { type: Number, default: 0 },

    // Providers notified in this round
    notifiedProviders: [notificationSchema],

    // Timestamps for tracking
    assignedAt: { type: Date },
    completedAt: { type: Date },
    acceptWindowExpiry: { type: Date },

    // Chat room ID (same as task ID for simplicity)
    chatRoomId: { type: String },

    // Payment status
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid'],
      default: 'unpaid',
    },
    amount: { type: Number, default: 0 },

    // Admin notes
    adminNotes: { type: String },
  },
  { timestamps: true }
);

// Set chatRoomId to task ID before saving
taskSchema.pre('save', function (next) {
  if (!this.chatRoomId) {
    this.chatRoomId = this._id.toString();
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
