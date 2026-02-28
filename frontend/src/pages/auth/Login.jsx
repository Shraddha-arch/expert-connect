import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.user, data.token);

      if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'customer') navigate('/chat');
      else if (data.user.role === 'service_provider') {
        if (data.user.status === 'pending') navigate('/pending');
        else navigate('/provider');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">ExpertConnect</div>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>New customer? <Link to="/signup/customer">Create account</Link></p>
          <p style={{ marginTop: 8 }}>
            Service provider? <Link to="/signup/provider">Register as expert</Link>
          </p>
        </div>

        {/* Demo credentials hint */}
        <div className="alert alert-info" style={{ marginTop: 20, fontSize: 12 }}>
          <strong>Demo Admin:</strong> admin@expertconnect.com / admin123
        </div>
      </div>
    </div>
  );
}
