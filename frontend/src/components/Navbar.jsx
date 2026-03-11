import { useState } from 'react';
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
    <nav className="navbar" style={{ background: '#171717', borderBottom: '1px solid #252525' }}>
      <div className="navbar-logo" style={{ color: '#cc785c' }}>
        Expert<span style={{ color: '#e0e0e0' }}>Connect</span>
      </div>

      <div className="navbar-actions">
        {user && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="status-dot"
                style={{ background: connected ? 'var(--success)' : '#3a3a3a' }}
              />
              <span className="text-sm" style={{ color: '#555' }}>{connected ? 'Online' : 'Offline'}</span>
            </div>

            <div style={{ position: 'relative' }}>
              <div
                className="avatar"
                onClick={() => setMenuOpen((v) => !v)}
                title={user.name}
                style={{ background: 'rgba(204,120,92,0.2)', color: '#cc785c', border: '1px solid rgba(204,120,92,0.3)' }}
              >
                {initial}
              </div>
              {menuOpen && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: 46, background: '#222',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    border: '1px solid #333', minWidth: 200, zIndex: 200,
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #2e2e2e' }}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{user.email}</div>
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
