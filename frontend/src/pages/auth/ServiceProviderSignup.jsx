import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const DOMAIN_OPTIONS = [
  'legal', 'medical', 'financial', 'technical', 'design',
  'writing', 'marketing', 'education', 'engineering', 'consulting',
];

const emptyExpertise = () => ({ domain: '', tags: '', yearsOfExperience: '', description: '' });

export default function ServiceProviderSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', bio: '' });
  const [expertiseList, setExpertiseList] = useState([emptyExpertise()]);

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleExpertiseChange = (index, field, value) => {
    setExpertiseList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addExpertise = () => setExpertiseList((prev) => [...prev, emptyExpertise()]);
  const removeExpertise = (index) =>
    setExpertiseList((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const invalidExpertise = expertiseList.some((ex) => !ex.domain);
    if (invalidExpertise) return setError('Please select a domain for each expertise entry.');

    setLoading(true);
    try {
      const payload = {
        ...form,
        expertise: expertiseList.map((ex) => ({
          domain: ex.domain,
          tags: ex.tags.split(',').map((t) => t.trim()).filter(Boolean),
          yearsOfExperience: parseInt(ex.yearsOfExperience) || 0,
          description: ex.description,
        })),
      };
      await api.post('/auth/register/provider', payload);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Application Submitted!</h2>
          <p className="text-gray" style={{ marginBottom: 24 }}>
            Your profile is under admin review. You'll receive approval notification shortly.
          </p>
          <Link to="/login" className="btn btn-primary">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-header">
          <div className="auth-logo">ExpertConnect</div>
          <p className="auth-subtitle">Register as a Service Provider</p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= step ? 'var(--primary)' : 'var(--gray-200)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {step === 1 && (
          <div className="auth-form">
            <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--gray-700)' }}>
              Step 1: Basic Information
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" name="name" value={form.name} onChange={handleFormChange} placeholder="Dr. Jane Smith" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" name="email" value={form.email} onChange={handleFormChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input className="form-input" type="tel" name="phone" value={form.phone} onChange={handleFormChange} placeholder="+1 234 567 8900" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" name="password" value={form.password} onChange={handleFormChange} placeholder="Min. 6 characters" required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Professional Bio</label>
              <textarea className="form-textarea" name="bio" value={form.bio} onChange={handleFormChange} placeholder="Brief description of your background and expertise..." rows={3} />
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={() => {
                if (!form.name || !form.email || !form.password) return setError('Please fill all required fields.');
                setError('');
                setStep(2);
              }}
            >
              Next: Add Expertise →
            </button>
          </div>
        )}

        {step === 2 && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--gray-700)' }}>
              Step 2: Expertise & Domains
            </div>

            {expertiseList.map((ex, index) => (
              <div key={index} className="expertise-item" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Expertise #{index + 1}</span>
                  {expertiseList.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeExpertise(index)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Domain *</label>
                  <select
                    className="form-select"
                    value={ex.domain}
                    onChange={(e) => handleExpertiseChange(index, 'domain', e.target.value)}
                    required
                  >
                    <option value="">Select a domain</option>
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Skills / Tags</label>
                  <input
                    className="form-input"
                    value={ex.tags}
                    onChange={(e) => handleExpertiseChange(index, 'tags', e.target.value)}
                    placeholder="e.g. contract law, IP, litigation (comma separated)"
                  />
                  <span className="form-hint">Separate with commas — these help AI match you to tasks</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Years of Experience</label>
                  <input
                    className="form-input" type="number" min="0"
                    value={ex.yearsOfExperience}
                    onChange={(e) => handleExpertiseChange(index, 'yearsOfExperience', e.target.value)}
                    placeholder="5"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={ex.description}
                    onChange={(e) => handleExpertiseChange(index, 'description', e.target.value)}
                    placeholder="Describe your expertise in this domain..."
                    rows={2}
                  />
                </div>
              </div>
            ))}

            <button type="button" className="btn btn-outline btn-sm" onClick={addExpertise}>
              + Add Another Domain
            </button>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
