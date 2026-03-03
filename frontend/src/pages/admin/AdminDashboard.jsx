import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const STATUS_COLORS = {
  open:'badge-gray', notifying:'badge-warning', assigned:'badge-primary',
  in_progress:'badge-primary', completed:'badge-success', expired:'badge-danger', cancelled:'badge-danger',
};

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color='var(--primary)' }) {
  return (
    <div className="stat-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
          <div className="stat-label">{label}</div>
        </div>
        {icon && <div style={{ fontSize:28, opacity:0.5 }}>{icon}</div>}
      </div>
    </div>
  );
}

// ── Provider approval row ────────────────────────────────────────────────────
function ProviderRow({ provider, onApprove, onReject, isUpdate }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight:600 }}>{provider.name}</div>
          <div className="text-xs text-gray">{provider.email}</div>
          {isUpdate && <span className="badge badge-warning" style={{ marginTop:4, fontSize:10 }}>Profile Update</span>}
        </td>
        <td>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {provider.expertise?.map((ex,i)=><span key={i} className="tag" style={{fontSize:10}}>{ex.domain}</span>)}
          </div>
        </td>
        <td>
          <div className="text-sm" style={{ maxWidth:200 }}>{provider.bio||<span className="text-gray">No bio</span>}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
            {provider.expertise?.flatMap(ex=>ex.tags||[]).slice(0,5).map((t,i)=><span key={i} className="badge badge-gray" style={{fontSize:10}}>{t}</span>)}
          </div>
          <button className="btn btn-ghost btn-sm" style={{fontSize:11,padding:'2px 6px',marginTop:4}} onClick={()=>setExpanded(v=>!v)}>
            {expanded?'▲ Hide':'▼ Details'}
          </button>
        </td>
        <td className="text-sm">{new Date(provider.createdAt).toLocaleDateString()}</td>
        <td>
          {rejecting ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <input className="form-input" style={{fontSize:12,padding:'6px 8px'}} placeholder="Reason for rejection..." value={reason} onChange={e=>setReason(e.target.value)}/>
              <div style={{ display:'flex', gap:4 }}>
                <button className="btn btn-danger btn-sm" onClick={()=>{onReject(provider._id,reason);setRejecting(false);}}>Confirm</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setRejecting(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-success btn-sm" onClick={()=>onApprove(provider._id)}>✓ Approve</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setRejecting(true)}>✕ Reject</button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background:'var(--gray-100)', padding:'16px 20px' }}>

            {/* ── Profile Header ── */}
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16, padding:'16px', background:'var(--white)', borderRadius:10, border:'1px solid var(--gray-200)' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'var(--white)', flexShrink:0 }}>
                {provider.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:16, fontWeight:700 }}>{provider.name}</span>
                  {isUpdate && <span className="badge badge-warning" style={{fontSize:10}}>Profile Update</span>}
                  <span className={`badge ${provider.status==='approved'?'badge-success':provider.status==='rejected'?'badge-danger':'badge-warning'}`}>{provider.status}</span>
                  {provider.isOnline && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--success)' }}><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--success)', display:'inline-block' }}/> Online</span>}
                </div>
                <div style={{ display:'flex', gap:16, marginTop:4, flexWrap:'wrap' }}>
                  <span className="text-sm text-gray">✉ {provider.email}</span>
                  {provider.phone && <span className="text-sm text-gray">📞 {provider.phone}</span>}
                  <span className="text-sm text-gray">📅 Joined {new Date(provider.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {/* Stats chips */}
              <div style={{ display:'flex', gap:12, flexShrink:0 }}>
                <div style={{ textAlign:'center', padding:'8px 14px', background:'var(--gray-100)', borderRadius:8 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--primary)' }}>{provider.completedTasks||0}</div>
                  <div style={{ fontSize:10, color:'var(--gray-500)' }}>Tasks Done</div>
                </div>
                <div style={{ textAlign:'center', padding:'8px 14px', background:'var(--gray-100)', borderRadius:8 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'var(--warning)' }}>{provider.rating?`★ ${provider.rating.toFixed(1)}`:'—'}</div>
                  <div style={{ fontSize:10, color:'var(--gray-500)' }}>Rating</div>
                </div>
                <div style={{ textAlign:'center', padding:'8px 14px', background:'var(--gray-100)', borderRadius:8 }}>
                  <div style={{ fontSize:18, fontWeight:700, color: provider.isAvailable?'var(--success)':'var(--danger)' }}>{provider.isAvailable?'Yes':'No'}</div>
                  <div style={{ fontSize:10, color:'var(--gray-500)' }}>Available</div>
                </div>
              </div>
            </div>

            {/* ── Bio ── */}
            {provider.bio && (
              <div style={{ marginBottom:12, padding:'12px 16px', background:'var(--white)', borderRadius:10, border:'1px solid var(--gray-200)' }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'var(--gray-500)', marginBottom:6 }}>About</div>
                <div className="text-sm" style={{ lineHeight:1.6 }}>{provider.bio}</div>
              </div>
            )}

            {/* ── Rejection Reason ── */}
            {provider.rejectionReason && (
              <div style={{ marginBottom:12, padding:'12px 16px', background:'rgba(248,113,113,0.1)', borderRadius:10, border:'1px solid var(--danger)' }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'var(--danger)', marginBottom:6 }}>Previous Rejection Reason</div>
                <div className="text-sm">{provider.rejectionReason}</div>
              </div>
            )}

            {/* ── Expertise Areas ── */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'var(--gray-500)', marginBottom:8 }}>Expertise Areas ({provider.expertise?.length||0})</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10 }}>
                {provider.expertise?.map((ex,i)=>(
                  <div key={i} style={{ background:'var(--white)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--gray-200)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span className="tag" style={{ fontSize:12, fontWeight:700 }}>{ex.domain}</span>
                      {ex.yearsOfExperience>0 && (
                        <span style={{ fontSize:11, color:'var(--gray-500)', background:'var(--gray-100)', padding:'2px 8px', borderRadius:20 }}>
                          {ex.yearsOfExperience} yr{ex.yearsOfExperience>1?'s':''} exp
                        </span>
                      )}
                    </div>
                    {ex.description && <div className="text-sm" style={{ marginBottom:8, lineHeight:1.5, color:'var(--gray-600)' }}>{ex.description}</div>}
                    {ex.tags?.length>0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {ex.tags.map((t,j)=><span key={j} className="badge badge-primary" style={{fontSize:10}}>{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { getSocket } = useSocket();
  const [page, setPage] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingProviders, setPendingProviders] = useState([]);
  const [allProviders, setAllProviders] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState('');
  const [activity, setActivity] = useState([]); // right panel live feed
  const activityRef = useRef([]);

  const pushActivity = useCallback((entry) => {
    const item = { ...entry, id: Date.now(), time: new Date() };
    activityRef.current = [item, ...activityRef.current].slice(0, 20);
    setActivity([...activityRef.current]);
  }, []);

  const loadStats = useCallback(async () => {
    const { data } = await api.get('/admin/stats');
    setStats(data);
  }, []);

  const loadPending = useCallback(async () => {
    const { data } = await api.get('/admin/providers/pending');
    setPendingProviders(data);
  }, []);

  const loadPageData = useCallback(async (p) => {
    if (p==='providers')  { const { data } = await api.get('/admin/providers'); setAllProviders(data); }
    if (p==='customers')  { const { data } = await api.get('/admin/customers'); setCustomers(data); }
    if (p==='tasks') {
      const q = taskFilter ? `?status=${taskFilter}` : '';
      const { data } = await api.get(`/admin/tasks${q}`);
      setAllTasks(data);
    }
  }, [taskFilter]);

  useEffect(() => {
    const init = async () => {
      try { await Promise.all([loadStats(), loadPending()]); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => { loadPageData(page); }, [page, taskFilter]);

  // Socket: live updates for right panel
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onTaskUpdated = ({ task }) => {
      loadStats();
      if (page==='tasks') loadPageData('tasks');
      pushActivity({ icon:'📋', text:`Task ${task?.status||'updated'}`, sub: task?.description?.slice(0,40)||'' });
    };
    const onPayment = ({ payment }) => {
      loadStats();
      pushActivity({ icon:'💰', text:`Payment $${payment?.amount||0}`, sub:'Task completed & paid' });
    };
    const onProviderUpdate = ({ providerName, message }) => {
      loadPending();
      pushActivity({ icon:'👤', text:`${providerName}`, sub:'Profile update needs review' });
    };
    const onMsgAdmin = ({ chatRoomId, message }) => {
      pushActivity({ icon:'💬', text:`New message`, sub: message?.content?.slice(0,40)||'' });
    };

    socket.on('task_updated',            onTaskUpdated);
    socket.on('payment_updated',         onPayment);
    socket.on('provider_update_request', onProviderUpdate);
    socket.on('new_message_admin',       onMsgAdmin);

    return () => {
      socket.off('task_updated',            onTaskUpdated);
      socket.off('payment_updated',         onPayment);
      socket.off('provider_update_request', onProviderUpdate);
      socket.off('new_message_admin',       onMsgAdmin);
    };
  }, [getSocket, page, loadStats, loadPending, loadPageData, pushActivity]);

  const handleApprove = async (id) => {
    await api.patch(`/admin/providers/${id}/approve`);
    setPendingProviders(prev => prev.filter(p=>p._id!==id));
    loadStats();
    pushActivity({ icon:'✅', text:'Provider approved', sub:'' });
    if (page==='providers') loadPageData('providers');
  };

  const handleReject = async (id, reason) => {
    await api.patch(`/admin/providers/${id}/reject`, { reason });
    setPendingProviders(prev => prev.filter(p=>p._id!==id));
    loadStats();
    pushActivity({ icon:'✕', text:'Provider rejected', sub: reason||'' });
  };

  const NAV = [
    { id:'overview',   label:'Overview',   icon:'📊' },
    { id:'approvals',  label:`Approvals`,  icon:'✅', badge: pendingProviders.length },
    { id:'providers',  label:'Providers',  icon:'👥' },
    { id:'tasks',      label:'All Tasks',  icon:'📋' },
    { id:'customers',  label:'Customers',  icon:'👤' },
  ];

  return (
    <div style={{ display:'flex', height:'calc(100vh - 60px)' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div style={{ width:220, background:'#0d1117', color:'white', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'20px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1 }}>Admin Panel</div>
        </div>

        <nav style={{ flex:1, padding:'8px 0' }}>
          {NAV.map(item => (
            <button key={item.id} onClick={()=>setPage(item.id)}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:'10px 16px', background: page===item.id ? 'rgba(79,70,229,0.4)' : 'transparent',
                color: page===item.id ? 'white' : 'rgba(255,255,255,0.65)',
                border:'none', cursor:'pointer', fontSize:14, fontFamily:'inherit',
                borderLeft: page===item.id ? '3px solid var(--primary)' : '3px solid transparent',
                transition:'all 0.15s',
              }}
            >
              <span style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {item.badge > 0 && (
                <span style={{ background:'var(--danger)', color:'white', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:700 }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar bottom stats */}
        {stats && (
          <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.1)', fontSize:12, color:'rgba(255,255,255,0.5)' }}>
            <div style={{ marginBottom:4 }}>👥 {stats.totalCustomers} customers</div>
            <div style={{ marginBottom:4 }}>🔧 {stats.totalProviders} providers</div>
            <div>💰 ${(stats.totalRevenue||0).toFixed(0)} revenue</div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:24 }}>

        {/* Overview */}
        {page==='overview' && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>Overview</h2>
              <p className="text-sm text-gray">Platform summary and key metrics</p>
            </div>
            {loading ? <div className="loading-center"><div className="spinner"/></div> : (
              <>
                <div className="dashboard-grid" style={{ marginBottom:24 }}>
                  <StatCard label="Total Customers"   value={stats?.totalCustomers}  icon="👤" />
                  <StatCard label="Active Providers"  value={stats?.totalProviders}   icon="🔧" color="var(--success)" />
                  <StatCard label="Pending Approvals" value={stats?.pendingProviders} icon="⏳" color="var(--warning)" />
                  <StatCard label="Total Tasks"       value={stats?.totalTasks}       icon="📋" />
                  <StatCard label="Completed Tasks"   value={stats?.completedTasks}   icon="✅" color="var(--success)" />
                  <StatCard label="Total Revenue"     value={`$${(stats?.totalRevenue||0).toFixed(2)}`} icon="💰" color="var(--success)" />
                </div>

                {pendingProviders.length>0 && (
                  <div className="alert alert-info" style={{marginBottom:16}}>
                    ⚠️ <strong>{pendingProviders.length}</strong> provider{pendingProviders.length>1?'s':''} waiting for approval.{' '}
                    <span style={{cursor:'pointer',fontWeight:600,textDecoration:'underline'}} onClick={()=>setPage('approvals')}>
                      Review now →
                    </span>
                  </div>
                )}

                <div className="card">
                  <h3 style={{fontWeight:700,marginBottom:16}}>Platform Health</h3>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                    <div>
                      <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>Task Completion Rate</div>
                      <div style={{height:8,background:'var(--gray-100)',borderRadius:4,marginBottom:6}}>
                        <div style={{height:'100%',borderRadius:4,background:'var(--success)',width:`${stats?.totalTasks?(stats.completedTasks/stats.totalTasks*100):0}%`,transition:'width 0.5s'}}/>
                      </div>
                      <div className="text-sm text-gray">{stats?.completedTasks||0} / {stats?.totalTasks||0} completed</div>
                    </div>
                    <div>
                      <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>Provider Approval Rate</div>
                      <div style={{height:8,background:'var(--gray-100)',borderRadius:4,marginBottom:6}}>
                        <div style={{height:'100%',borderRadius:4,background:'var(--primary)',width:`${(stats?.totalProviders+stats?.pendingProviders)?(stats.totalProviders/(stats.totalProviders+stats.pendingProviders)*100):0}%`,transition:'width 0.5s'}}/>
                      </div>
                      <div className="text-sm text-gray">{stats?.totalProviders||0} approved · {stats?.pendingProviders||0} pending</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Approvals */}
        {page==='approvals' && (
          <div>
            <div style={{marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:700}}>Provider Approvals</h2>
              <p className="text-sm text-gray">Review new registrations and profile update requests</p>
            </div>
            {pendingProviders.length===0 ? (
              <div className="card" style={{textAlign:'center',padding:48}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <div style={{fontWeight:600}}>All caught up!</div>
                <div className="text-gray text-sm">No pending approvals at the moment.</div>
              </div>
            ) : (
              <div className="card table-wrap">
                <div style={{marginBottom:12,fontSize:13,color:'var(--gray-500)'}}>
                  {pendingProviders.length} provider{pendingProviders.length>1?'s':''} awaiting review · Click <strong>▼ Details</strong> to see full expertise breakdown
                </div>
                <table>
                  <thead><tr><th>Provider</th><th>Domains</th><th>Bio & Skills</th><th>Applied</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pendingProviders.map(p=>(
                      <ProviderRow key={p._id} provider={p} onApprove={handleApprove} onReject={handleReject} isUpdate={p.completedTasks>0}/>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All Providers */}
        {page==='providers' && (
          <div>
            <div style={{marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:700}}>All Service Providers</h2>
              <p className="text-sm text-gray">{allProviders.length} providers registered</p>
            </div>
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Domains & Skills</th><th>Status</th><th>Tasks</th><th>Rating</th><th>Joined</th></tr></thead>
                <tbody>
                  {allProviders.map(p=>(
                    <tr key={p._id}>
                      <td>
                        <div style={{fontWeight:600}}>{p.name}</div>
                        {p.bio && <div className="text-xs text-gray">{p.bio.slice(0,50)}{p.bio.length>50?'…':''}</div>}
                      </td>
                      <td className="text-sm">{p.email}</td>
                      <td>
                        <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:3}}>{p.expertise?.map((ex,i)=><span key={i} className="tag" style={{fontSize:10}}>{ex.domain}</span>)}</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:2}}>{p.expertise?.flatMap(ex=>ex.tags||[]).slice(0,4).map((t,i)=><span key={i} className="badge badge-gray" style={{fontSize:10}}>{t}</span>)}</div>
                      </td>
                      <td><span className={`badge ${p.status==='approved'?'badge-success':p.status==='rejected'?'badge-danger':'badge-warning'}`}>{p.status}</span></td>
                      <td>{p.completedTasks||0}</td>
                      <td>{p.rating?`★ ${p.rating.toFixed(1)}`:'—'}</td>
                      <td className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Tasks */}
        {page==='tasks' && (
          <div>
            <div style={{marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:700}}>All Tasks</h2>
              <p className="text-sm text-gray">Monitor every task across the platform</p>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              {['','open','notifying','assigned','in_progress','completed','expired'].map(s=>(
                <button key={s} className={`btn btn-sm ${taskFilter===s?'btn-primary':'btn-outline'}`} onClick={()=>setTaskFilter(s)}>
                  {s||'All'}
                </button>
              ))}
            </div>
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Request</th><th>Customer</th><th>Expert</th><th>AI Domains</th><th>Status</th><th>Payment</th><th>Created</th></tr></thead>
                <tbody>
                  {allTasks.map(task=>(
                    <tr key={task._id}>
                      <td style={{maxWidth:200}}><div className="truncate text-sm">{task.description}</div></td>
                      <td className="text-sm">{task.customerId?.name||'—'}</td>
                      <td className="text-sm">{task.serviceProviderId?.name||<span className="text-gray">Unassigned</span>}</td>
                      <td><div style={{display:'flex',flexWrap:'wrap',gap:2}}>{task.matchedDomains?.slice(0,2).map(d=><span key={d} className="tag" style={{fontSize:10}}>{d}</span>)}</div></td>
                      <td><span className={`badge ${STATUS_COLORS[task.status]||'badge-gray'}`}>{task.status}</span></td>
                      <td><span className={`badge ${task.paymentStatus==='paid'?'badge-success':'badge-gray'}`}>{task.paymentStatus}{task.amount>0&&` $${task.amount}`}</span></td>
                      <td className="text-sm">{new Date(task.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customers */}
        {page==='customers' && (
          <div>
            <div style={{marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:700}}>Customers</h2>
              <p className="text-sm text-gray">{customers.length} customers registered</p>
            </div>
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  {customers.map(c=>(
                    <tr key={c._id}>
                      <td style={{fontWeight:600}}>{c.name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone||'—'}</td>
                      <td><span className="badge badge-success">Active</span></td>
                      <td className="text-sm">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL — Live Activity ───────────────────────────────────── */}
      <div style={{ width:240, borderLeft:'1px solid var(--gray-200)', display:'flex', flexDirection:'column', background:'var(--white)', flexShrink:0 }}>
        <div style={{ padding:'16px 14px 10px', borderBottom:'1px solid var(--gray-200)' }}>
          <div style={{ fontWeight:700, fontSize:13 }}>Live Activity</div>
          <div className="text-xs text-gray">Real-time platform events</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--success)', animation:'pulse 2s infinite' }}/>
            <span style={{ fontSize:11, color:'var(--success)', fontWeight:600 }}>Live</span>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {activity.length===0 ? (
            <div style={{ padding:16, textAlign:'center', color:'var(--gray-400)', fontSize:12 }}>
              <div style={{ fontSize:24, marginBottom:6 }}>🔔</div>
              Events will appear here as they happen...
            </div>
          ) : activity.map(item=>(
            <div key={item.id} style={{ padding:'10px 14px', borderBottom:'1px solid var(--gray-50)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-800)' }}>{item.text}</div>
                  {item.sub && <div className="truncate" style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>{item.sub}</div>}
                  <div style={{ fontSize:10, color:'var(--gray-300)', marginTop:2 }}>
                    {item.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick stats at bottom of right panel */}
        {stats && (
          <div style={{ padding:'12px 14px', borderTop:'1px solid var(--gray-200)', background:'var(--gray-50)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', marginBottom:8, letterSpacing:0.5 }}>Quick Stats</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[
                { label:'Open tasks',    value: allTasks.filter(t=>t.status==='notifying').length, color:'var(--warning)' },
                { label:'Active chats',  value: allTasks.filter(t=>['assigned','in_progress'].includes(t.status)).length, color:'var(--primary)' },
                { label:'Completed',     value: stats.completedTasks, color:'var(--success)' },
              ].map(s=>(
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--gray-500)' }}>{s.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
