const User = require('../models/User');

const SEED_USERS = [
  /* ── Admin ──────────────────────────────────────────────────────── */
  {
    name: 'Admin User',
    email: 'admin@expertconnect.com',
    password: 'admin123',
    role: 'admin',
    status: 'approved',
  },

  /* ── Demo Customer ───────────────────────────────────────────────── */
  {
    name: 'John Doe',
    email: 'customer@expertconnect.com',
    password: 'customer123',
    role: 'customer',
    status: 'approved',
  },

  /* ── 1. Health Advisor ───────────────────────────────────────────── */
  {
    name: 'Dr. Sarah Patel',
    email: 'health@expertconnect.com',
    password: 'provider123',
    role: 'service_provider',
    status: 'approved',
    isAvailable: true,
    rating: 4.8,
    completedTasks: 42,
    bio: 'Licensed physician with 12 years of clinical experience. Specialises in general health consultations, symptom analysis, chronic conditions, nutrition, and mental wellness.',
    expertise: [
      {
        domain: 'medical',
        tags: ['health', 'symptom', 'diagnosis', 'nutrition', 'wellness', 'therapy', 'mental health', 'medicine', 'clinical', 'doctor', 'injury', 'prescription'],
        yearsOfExperience: 12,
        description: 'General health consultations, symptom review, nutrition guidance, and mental wellness coaching.',
      },
    ],
  },

  /* ── 2. Legal Advisor ───────────────────────────────────────────── */
  {
    name: 'James Morrison',
    email: 'legal@expertconnect.com',
    password: 'provider123',
    role: 'service_provider',
    status: 'approved',
    isAvailable: true,
    rating: 4.7,
    completedTasks: 38,
    bio: 'Senior attorney with 15 years of experience in corporate law, contract disputes, employment law, and intellectual property.',
    expertise: [
      {
        domain: 'legal',
        tags: ['law', 'contract', 'legal', 'compliance', 'ip', 'patent', 'trademark', 'litigation', 'agreement', 'liability', 'dispute', 'arbitration', 'employment', 'copyright', 'regulation', 'clause', 'rights'],
        yearsOfExperience: 15,
        description: 'Contract reviews, dispute resolution, IP protection, compliance advice, and employment law consultations.',
      },
    ],
  },

  /* ── 3. Code Advisor ────────────────────────────────────────────── */
  {
    name: 'Alex Chen',
    email: 'code@expertconnect.com',
    password: 'provider123',
    role: 'service_provider',
    status: 'approved',
    isAvailable: true,
    rating: 4.9,
    completedTasks: 67,
    bio: 'Full-stack software engineer with 8 years of experience across frontend, backend, and cloud infrastructure. Expert in React, Node.js, Python, and DevOps.',
    expertise: [
      {
        domain: 'technical',
        tags: ['software', 'code', 'programming', 'debug', 'bug', 'react', 'nodejs', 'python', 'api', 'frontend', 'backend', 'database', 'cloud', 'devops', 'system', 'security', 'deployment', 'infrastructure', 'website', 'mobile', 'application'],
        yearsOfExperience: 8,
        description: 'Code reviews, debugging sessions, architecture consultations, and full-stack development advice.',
      },
    ],
  },

  /* ── 4. Post / Content Advisor ──────────────────────────────────── */
  {
    name: 'Emma Rodriguez',
    email: 'post@expertconnect.com',
    password: 'provider123',
    role: 'service_provider',
    status: 'approved',
    isAvailable: true,
    rating: 4.6,
    completedTasks: 55,
    bio: 'Senior content strategist and copywriter with 9 years of experience crafting high-impact content for LinkedIn, blogs, newsletters, and marketing campaigns.',
    expertise: [
      {
        domain: 'writing',
        tags: ['write', 'writing', 'content', 'copy', 'blog', 'article', 'seo', 'linkedin', 'post', 'ghostwriting', 'editing', 'proofreading', 'script', 'proposal', 'resume', 'cover letter', 'documentation'],
        yearsOfExperience: 9,
        description: 'Content writing, LinkedIn posts, blog articles, SEO copy, personal branding, and product launch messaging.',
      },
      {
        domain: 'marketing',
        tags: ['marketing', 'seo', 'social media', 'advertising', 'campaign', 'brand', 'engagement', 'leads', 'growth', 'audience', 'promotion'],
        yearsOfExperience: 9,
        description: 'Social media strategy, marketing copy, and brand voice development.',
      },
    ],
  },
];

module.exports = async function seed() {
  let created = 0;
  for (const userData of SEED_USERS) {
    const exists = await User.findOne({ email: userData.email });
    if (!exists) {
      await User.create(userData);
      created++;
      console.log(`✅ Seeded: ${userData.email}`);
    }
  }
  if (created > 0) {
    console.log(`\n✅ ${created} seed user(s) created.`);
    console.log('   Health Adv:  health@expertconnect.com  / provider123');
    console.log('   Legal Adv:   legal@expertconnect.com   / provider123');
    console.log('   Code Adv:    code@expertconnect.com    / provider123');
    console.log('   Post Adv:    post@expertconnect.com    / provider123');
  }
};
