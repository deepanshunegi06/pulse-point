import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Create user schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    select: true // Make sure the password is selected when querying the user model
  },
  role: {
    type: String,
    enum: ['user', 'driver'],
    default: 'user'
  },
  phone: {
    type: String,
    required: true
  },
  uid: {
    type: String,
    required: true,
    unique: true
  }, // Add uid field
  fcmToken: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentLocation: {
    type: {
      latitude: {
        type: Number
      },
      longitude: {
        type: Number
      }
    },
    default: null
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next(); // Only hash the password if it's modified

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt); // Hash the password
    next(); // Continue with saving
  } catch (error) {
    next(error); // Handle any errors in password hashing
  }
});

// Method to compare passwords (for login)
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword || !this.password) {
    throw new Error('Password not provided for comparison');
  }
  return await bcrypt.compare(candidatePassword, this.password); // Compare hashed password
};

// Create and export the User model
const User = mongoose.model('User', userSchema);
export default User;
