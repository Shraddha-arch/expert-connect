import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Instant Expert Matching',
    desc: 'AI analyzes your request and routes it to the most qualified expert in seconds — no browsing, no guessing.',
  },
  {
    icon: '💬',
    title: 'Real-Time Chat',
    desc: 'Start chatting the moment an expert accepts. Ask follow-ups, share documents, and get clarity fast.',
  },
  {
    icon: '🛡️',
    title: 'Verified Professionals',
    desc: 'Every service provider is manually reviewed and approved by our admin team before going live.',
  },
  {
    icon: '⏱️',
    title: '2-Minute Response Guarantee',
    desc: 'Experts have a 2-minute window to accept your request. If no one accepts, you pay nothing.',
  },
  {
    icon: '💳',
    title: 'Pay After — Not Before',
    desc: 'Payment is only triggered after you confirm the task is complete. No upfront commitments.',
  },
  {
    icon: '📊',
    title: 'Full Transparency',
    desc: 'See your expert\'s profile, experience, and domain tags before the conversation even starts.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Describe your problem',
    desc: 'Type a plain-English description of what you need help with. No forms, no categories — just talk.',
    icon: '✍️',
  },
  {
    step: '02',
    title: 'AI finds the right expert',
    desc: 'Our AI matches your request to verified experts by domain, tags, and availability in real time.',
    icon: '🤖',
  },
  {
    step: '03',
    title: 'Chat, resolve, pay',
    desc: 'Talk directly with your expert, get your problem solved, then pay a fair amount when you\'re satisfied.',
    icon: '✅',
  },
];

const DOMAINS = [
  { icon: '⚖️', name: 'Legal', examples: 'Contracts, IP, Compliance' },
  { icon: '💊', name: 'Medical', examples: 'Health advice, Symptoms, Meds' },
  { icon: '📈', name: 'Financial', examples: 'Tax, Investments, Accounting' },
  { icon: '💻', name: 'Technical', examples: 'Software, Cloud, APIs' },
  { icon: '🎨', name: 'Design', examples: 'UI/UX, Branding, Graphics' },
  { icon: '✏️', name: 'Writing', examples: 'Copywriting, Editing, SEO' },
  { icon: '📣', name: 'Marketing', examples: 'Campaigns, Social, Growth' },
  { icon: '🎓', name: 'Education', examples: 'Tutoring, Coaching, Exams' },
  { icon: '⚙️', name: 'Engineering', examples: 'Civil, Mechanical, Electrical' },
  { icon: '🤝', name: 'Consulting', examples: 'Strategy, Operations, HR' },
];

const TESTIMONIALS = [
  {
    name: 'James K.',
    role: 'Startup Founder',
    text: 'I needed a contract reviewed urgently. Within 90 seconds, a senior attorney was in my chat. Incredible.',
    avatar: 'J',
  },
  {
    name: 'Priya M.',
    role: 'Freelancer',
    text: 'I was confused about my tax filing. The financial expert walked me through everything in 20 minutes.',
    avatar: 'P',
  },
  {
    name: 'David R.',
    role: 'Small Business Owner',
    text: 'Our cloud server was down at 2 AM. An expert joined my chat and fixed the issue. Lifesaver.',
    avatar: 'D',
  },
];

function AnimatedCounter({ target, duration = 1500 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <span>{count.toLocaleString()}</span>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [typed, setTyped] = useState('');
  const placeholders = [
    'I need help reviewing a contract...',
    'My tax return has an error...',
    'My React app keeps crashing...',
    'I need a logo for my brand...',
  ];
  const [phIdx, setPhIdx] = useState(0);

  // Typewriter effect for placeholder cycling
  useEffect(() => {
    let charIdx = 0;
    let deleting = false;
    let current = placeholders[phIdx];
    const tick = () => {
      if (!deleting) {
        setTyped(current.slice(0, charIdx + 1));
        charIdx++;
        if (charIdx === current.length) { deleting = true; setTimeout(tick, 1800); return; }
      } else {
        setTyped(current.slice(0, charIdx - 1));
        charIdx--;
        if (charIdx === 0) {
          deleting = false;
          setPhIdx((i) => (i + 1) % placeholders.length);
          return;
        }
      }
      setTimeout(tick, deleting ? 40 : 60);
    };
    const t = setTimeout(tick, 60);
    return () => clearTimeout(t);
  }, [phIdx]); // eslint-disable-line

  const handleSubmit = (e) => {
    e.preventDefault();
    if (user) {
      // Already logged in — send them to the right place with pre-filled query
      if (user.role === 'customer') {
        navigate('/chat', { state: { prefillQuery: query } });
      } else if (user.role === 'service_provider') {
        navigate('/provider');
      } else {
        navigate('/admin');
      }
    } else {
      navigate('/signup/customer', { state: { prefillQuery: query } });
    }
  };

  return (
    <div className="landing">
      {/* ── NAV ── */}
      <nav className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <span className="landing-logo">Expert<span>Connect</span></span>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#domains">Domains</a>
            {user ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate(
                user.role === 'admin' ? '/admin' : user.role === 'service_provider' ? '/provider' : '/chat'
              )}>
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link to="/signup/customer" className="btn btn-primary btn-sm">Get Started Free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-container">
          <div className="landing-badge">AI-Powered Expert Matching</div>
          <h1 className="landing-headline">
            Get expert help<br />
            <span className="landing-headline-accent">in under 2 minutes</span>
          </h1>
          <p className="landing-subheadline">
            Describe your problem in plain English. Our AI finds the best-matched verified expert and connects you instantly — no searching, no waiting rooms.
          </p>

          {/* Query box */}
          <form className="landing-query-form" onSubmit={handleSubmit}>
            <div className="landing-query-input-wrap">
              <span className="landing-query-icon">💬</span>
              <input
                className="landing-query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={typed || placeholders[0]}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg landing-query-btn">
              Find My Expert →
            </button>
          </form>
          <p className="landing-hero-hint">No credit card required &nbsp;·&nbsp; Free to ask &nbsp;·&nbsp; Pay only when satisfied</p>

          {/* Stats bar */}
          <div className="landing-stats">
            <div className="landing-stat">
              <span className="landing-stat-value"><AnimatedCounter target={1240} />+</span>
              <span className="landing-stat-label">Experts Online</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-value"><AnimatedCounter target={98} />%</span>
              <span className="landing-stat-label">Satisfaction Rate</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-value">&lt; 2<span style={{ fontSize: 18 }}>min</span></span>
              <span className="landing-stat-label">Avg. Response Time</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-value"><AnimatedCounter target={10} /></span>
              <span className="landing-stat-label">Expert Domains</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-section-label">Simple process</div>
            <h2 className="landing-section-title">Three steps to your answer</h2>
            <p className="landing-section-sub">No account setup headaches. Go from problem to solution in minutes.</p>
          </div>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div className="landing-step" key={i}>
                <div className="landing-step-icon">{s.icon}</div>
                <div className="landing-step-num">{s.step}</div>
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-desc">{s.desc}</p>
                {i < STEPS.length - 1 && <div className="landing-step-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="landing-section landing-section-alt" id="features">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-section-label">Why ExpertConnect</div>
            <h2 className="landing-section-title">Everything you need, nothing you don't</h2>
            <p className="landing-section-sub">Built to get you answers fast, reliably, and fairly.</p>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map((f, i) => (
              <div className="landing-feature-card" key={i}>
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOMAINS ── */}
      <section className="landing-section" id="domains">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-section-label">Expert coverage</div>
            <h2 className="landing-section-title">10 domains, thousands of experts</h2>
            <p className="landing-section-sub">Whatever your problem, we have a verified specialist ready.</p>
          </div>
          <div className="landing-domains-grid">
            {DOMAINS.map((d, i) => (
              <div className="landing-domain-card" key={i}>
                <span className="landing-domain-icon">{d.icon}</span>
                <span className="landing-domain-name">{d.name}</span>
                <span className="landing-domain-examples">{d.examples}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="landing-section landing-section-dark">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-section-label" style={{ color: '#a5b4fc' }}>Real stories</div>
            <h2 className="landing-section-title" style={{ color: '#fff' }}>Trusted by thousands</h2>
          </div>
          <div className="landing-testimonials">
            {TESTIMONIALS.map((t, i) => (
              <div className="landing-testimonial" key={i}>
                <p className="landing-testimonial-text">"{t.text}"</p>
                <div className="landing-testimonial-author">
                  <div className="landing-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="landing-testimonial-name">{t.name}</div>
                    <div className="landing-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-cta">
        <div className="landing-container landing-cta-inner">
          <h2 className="landing-cta-title">Ready to get unstuck?</h2>
          <p className="landing-cta-sub">Join thousands of people who get expert help in minutes, not days.</p>
          <div className="landing-cta-actions">
            <Link to="/signup/customer" className="btn btn-primary btn-lg">
              Ask an Expert — It's Free
            </Link>
            <Link to="/signup/provider" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>
              Become an Expert
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <span className="landing-logo">Expert<span>Connect</span></span>
          <div className="landing-footer-links">
            <Link to="/login">Log in</Link>
            <Link to="/signup/customer">Sign up as Customer</Link>
            <Link to="/signup/provider">Join as Expert</Link>
          </div>
          <p className="landing-footer-copy">© 2025 ExpertConnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
