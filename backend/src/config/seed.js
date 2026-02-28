const User = require('../models/User');

module.exports = async function seed() {
  const count = await User.countDocuments();
  if (count > 0) return; // already seeded

  await User.create([
    {
      name: 'Admin User',
      email: 'admin@expertconnect.com',
      password: 'admin123',
      role: 'admin',
      status: 'approved',
    },
    {
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
    },
    {
      name: 'Alex Chen',
      email: 'techexpert@expertconnect.com',
      password: 'provider123',
      role: 'service_provider',
      status: 'approved',
      bio: 'Full-stack developer and cloud architect with 8 years of experience.',
      expertise: [
        {
          domain: 'technical',
          tags: ['software', 'cloud', 'api', 'database', 'devops'],
          yearsOfExperience: 8,
          description: 'Expert in cloud infrastructure and backend systems',
        },
      ],
    },
    {
      name: 'Maya Patel',
      email: 'finance@expertconnect.com',
      password: 'provider123',
      role: 'service_provider',
      status: 'approved',
      bio: 'CPA with expertise in tax planning and financial advisory.',
      expertise: [
        {
          domain: 'financial',
          tags: ['tax', 'accounting', 'investment', 'audit', 'budget'],
          yearsOfExperience: 7,
          description: 'Tax planning and financial strategy expert',
        },
      ],
    },
    {
      name: 'John Doe',
      email: 'customer@expertconnect.com',
      password: 'customer123',
      role: 'customer',
      status: 'approved',
    },
  ]);

  console.log('✅ Demo users seeded');
};
