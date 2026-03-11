// AI Tagging Service — keyword-based domain matching
// Can be enhanced with OpenAI API for better NLP

const DOMAIN_KEYWORDS = {
  legal: ['law', 'legal', 'contract', 'lawsuit', 'court', 'attorney', 'lawyer', 'rights',
    'compliance', 'regulation', 'ip', 'patent', 'trademark', 'litigation', 'clause',
    'agreement', 'liability', 'copyright', 'dispute', 'arbitration'],
  medical: ['health', 'medical', 'doctor', 'medicine', 'symptom', 'diagnosis', 'treatment',
    'drug', 'prescription', 'hospital', 'clinical', 'therapy', 'nutrition', 'wellness',
    'injury', 'surgery', 'mental health', 'psychology', 'dentist', 'pharmacy'],
  financial: ['finance', 'investment', 'stock', 'tax', 'accounting', 'budget', 'money',
    'revenue', 'profit', 'audit', 'bookkeeping', 'cpa', 'loan', 'mortgage', 'insurance',
    'portfolio', 'crypto', 'retirement', 'expenses', 'savings', 'debt'],
  technical: ['software', 'code', 'programming', 'bug', 'debug', 'database', 'api', 'server',
    'cloud', 'network', 'system', 'tech', 'it', 'devops', 'application', 'website',
    'mobile', 'frontend', 'backend', 'security', 'infrastructure', 'deployment'],
  design: ['design', 'ui', 'ux', 'graphic', 'logo', 'brand', 'visual', 'creative', 'layout',
    'figma', 'photoshop', 'illustration', 'animation', 'color', 'typography', 'mockup',
    'wireframe', 'prototype', 'user interface', 'user experience'],
  writing: ['write', 'writing', 'content', 'copy', 'article', 'blog', 'seo', 'editing',
    'proofreading', 'translation', 'documentation', 'ghostwriting', 'screenplay',
    'script', 'proposal', 'resume', 'cover letter', 'report'],
  marketing: ['marketing', 'seo', 'social media', 'advertising', 'campaign', 'brand',
    'growth', 'analytics', 'email', 'ppc', 'promotion', 'audience', 'engagement',
    'influencer', 'strategy', 'sales funnel', 'conversion', 'leads'],
  education: ['teach', 'tutor', 'education', 'course', 'training', 'learning', 'student',
    'academic', 'curriculum', 'assignment', 'homework', 'exam', 'quiz', 'lesson',
    'coaching', 'mentoring', 'skill', 'certification'],
  engineering: ['engineer', 'mechanical', 'electrical', 'civil', 'structural', 'manufacturing',
    'cad', 'blueprint', 'circuit', 'robotics', 'automation', 'hardware', 'embedded',
    'architecture', 'construction', 'prototype', 'simulation'],
  consulting: ['consult', 'strategy', 'business', 'management', 'analysis', 'planning',
    'advisory', 'recommendation', 'process', 'efficiency', 'optimize', 'startup',
    'operations', 'hr', 'supply chain', 'project management'],
};

/**
 * Extract tags and matched domains from a text description
 * @param {string} text - Customer's request description
 * @returns {{ tags: string[], domains: string[] }}
 */
function analyzeRequest(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/).filter(Boolean);
  const tags = new Set();
  const domainScores = {};

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
        tags.add(keyword);
      }
    }
    if (score > 0) domainScores[domain] = score;
  }

  // Sort domains by score descending
  const rankedDomains = Object.entries(domainScores)
    .sort(([, a], [, b]) => b - a)
    .map(([domain]) => domain);

  return {
    tags: [...tags].slice(0, 10),
    domains: rankedDomains,
  };
}

/**
 * Find best-matching service providers for a given request
 * @param {string} description - Customer's request
 * @param {Array} providers - List of approved providers from DB
 * @param {number} limit - How many providers to notify
 * @returns {{ tags: string[], domains: string[], matchedProviders: Array }}
 */
function matchProviders(description, providers, limit = 5) {
  const { tags, domains } = analyzeRequest(description);

  if (domains.length === 0) {
    // No domain detected — notify all available providers
    return { tags, domains: ['general'], matchedProviders: providers.slice(0, limit) };
  }

  // Score each provider based on domain overlap
  const scored = providers.map((provider) => {
    let score = 0;
    const providerDomains = (provider.expertise || []).map((e) => e.domain.toLowerCase());
    const providerTags = (provider.expertise || []).flatMap((e) => (e.tags || []).map((t) => t.toLowerCase()));

    for (const domain of domains) {
      if (providerDomains.includes(domain)) score += 3;
    }
    for (const tag of tags) {
      if (providerTags.includes(tag)) score += 1;
    }

    return { provider, score };
  });

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.provider);

  // If no perfect match, fall back to all available providers
  const matchedProviders = matched.length > 0 ? matched : providers.slice(0, limit);

  return { tags, domains, matchedProviders };
}

module.exports = { analyzeRequest, matchProviders };
