import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        Expert<span>Connect</span>
      </div>

      <div className="navbar-actions">
        {user && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="status-dot"
                style={{ background: connected ? 'var(--success)' : 'var(--gray-300)' }}
              />
              <span className="text-sm text-gray">{connected ? 'Online' : 'Offline'}</span>
            </div>

            <div style={{ position: 'relative' }}>
              <div className="avatar" onClick={() => setMenuOpen((v) => !v)} title={user.name}>
                {initial}
              </div>
              {menuOpen && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: 44, background: 'var(--white)',
                    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--gray-200)', minWidth: 200, zIndex: 200,
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div className="text-sm text-gray">{user.email}</div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge badge-${user.role === 'admin' ? 'warning' : user.role === 'customer' ? 'primary' : 'success'}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: 8 }}>
                    {user.role === 'admin' && (
                      <Link to="/admin" className="btn btn-ghost btn-full" style={{ justifyContent: 'flex-start', borderRadius: 6 }} onClick={() => setMenuOpen(false)}>
                        Admin Dashboard
                      </Link>
                    )}
                    {user.role === 'customer' && (
                      <Link to="/chat" className="btn btn-ghost btn-full" style={{ justifyContent: 'flex-start', borderRadius: 6 }} onClick={() => setMenuOpen(false)}>
                        My Chats
                      </Link>
                    )}
                    {user.role === 'service_provider' && (
                      <Link to="/provider" className="btn btn-ghost btn-full" style={{ justifyContent: 'flex-start', borderRadius: 6 }} onClick={() => setMenuOpen(false)}>
                        Dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="btn btn-ghost btn-full"
                      style={{ justifyContent: 'flex-start', borderRadius: 6, color: 'var(--danger)' }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
