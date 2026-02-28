require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing admin
  await User.deleteOne({ email: 'admin@expertconnect.com' });

  // Create admin
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@expertconnect.com',
    password: 'admin123',
    role: 'admin',
    status: 'approved',
  });
  console.log('Admin created:', admin.email);

  // Create demo provider
  await User.deleteOne({ email: 'lawyer@expertconnect.com' });
  const provider = await User.create({
    name: 'Sarah Johnson',
    email: 'lawyer@expertconnect.com',
    password: 'provider123',
    role: 'service_provider',
    status: 'approved',
    bio: 'Senior attorney with 10 years of experience in contract law and IP.',
    expertise: [
      {
        domain: 'legal',
        tags: ['contract law', 'ip', 'litigation', 'compliance'],
        yearsOfExperience: 10,
        description: 'Specialized in contract disputes and intellectual property',
      },
    ],
  });
  console.log('Demo provider created:', provider.email);

  // Create demo customer
  await User.deleteOne({ email: 'customer@expertconnect.com' });
  const customer = await User.create({
    name: 'John Doe',
    email: 'customer@expertconnect.com',
    password: 'customer123',
    role: 'customer',
    status: 'approved',
  });
  console.log('Demo customer created:', customer.email);

  console.log('\n--- Demo Credentials ---');
  console.log('Admin:    admin@expertconnect.com / admin123');
  console.log('Provider: lawyer@expertconnect.com / provider123');
  console.log('Customer: customer@expertconnect.com / customer123');

  await mongoose.disconnect();
  console.log('\nSeed complete!');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
