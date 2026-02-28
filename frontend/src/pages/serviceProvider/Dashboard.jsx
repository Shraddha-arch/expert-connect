import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const DOMAIN_OPTIONS = [
  'legal','medical','financial','technical','design',
  'writing','marketing','education','engineering','consulting',
];

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function secsLeft(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
}

// Countdown timer inside each available task card
function LiveTimer({ expiresAt, onExpire }) {
  const [secs, setSecs] = useState(secsLeft(expiresAt));
  useEffect(() => {
    if (secs <= 0) { onExpire(); return; }
    const id = setInterval(() => {
      const s = secsLeft(expiresAt);
      setSecs(s);
      if (s <= 0) { clearInterval(id); onExpire(); }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const m = Math.floor(secs / 60), s = secs % 60;
  const color = secs < 30 ? 'var(--danger)' : secs < 60 ? 'var(--warning)' : 'var(--success)';
  return <span style={{ fontWeight:700, color, fontSize:13 }}>{m}:{s.toString().padStart(2,'0')}</span>;
}

// Chat message bubble
function MessageBubble({ message, myId }) {
  const isMine = message.senderId?._id === myId || message.senderId === myId;
  const isSystem = message.type === 'system' || message.senderRole === 'system';
  if (isSystem) return (
    <div style={{ textAlign:'center' }}>
      <div className="msg-bubble system">{message.content}</div>
    </div>
  );
  return (
    <div className={`msg-row ${isMine ? 'mine' : ''}`}>
      {!isMine && <div className="avatar" style={{ width:28, height:28, fontSize:11, flexShrink:0 }}>{(message.senderId?.name||'U').charAt(0).toUpperCase()}</div>}
      <div>
        {!isMine && <div className="msg-name">{message.senderId?.name}</div>}
        <div className={`msg-bubble ${isMine?'mine':'other'}`}>{message.content}</div>
        <div className="msg-time" style={{ textAlign:isMine?'right':'left' }}>{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}

// Profile editor section
function ProfileEditor({ user, onSaved }) {
  const { updateUser } = useAuth();
  const [basic, setBasic] = useState({ name:user.name||'', phone:user.phone||'', bio:user.bio||'' });
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicMsg, setBasicMsg] = useState('');
  const [expList, setExpList] = useState(
    user.expertise?.length
      ? user.expertise.map(ex => ({ domain:ex.domain||'', tags:(ex.tags||[]).join(', '), years:ex.yearsOfExperience||'', desc:ex.description||'' }))
      : [{ domain:'', tags:'', years:'', desc:'' }]
  );
  const [expSaving, setExpSaving] = useState(false);
  const [expMsg, setExpMsg] = useState('');
  const [expErr, setExpErr] = useState('');

  const saveBasic = async (e) => {
    e.preventDefault(); setBasicSaving(true); setBasicMsg('');
    try {
      const { data } = await api.patch('/auth/profile', basic);
      updateUser(data); onSaved?.(data);
      setBasicMsg('success:Profile saved!');
    } catch (err) { setBasicMsg('error:' + (err.response?.data?.message||'Failed')); }
    finally { setBasicSaving(false); setTimeout(()=>setBasicMsg(''),4000); }
  };

  const submitExp = async (e) => {
    e.preventDefault(); setExpErr('');
    if (expList.some(ex=>!ex.domain)) return setExpErr('Select a domain for each entry.');
    setExpSaving(true);
    try {
      const expertise = expList.map(ex => ({ domain:ex.domain, tags:ex.tags.split(',').map(t=>t.trim()).filter(Boolean), yearsOfExperience:parseInt(ex.years)||0, description:ex.desc }));
      const { data } = await api.patch('/auth/expertise', { expertise });
      updateUser(data.user); onSaved?.(data.user);
      setExpMsg('Expertise submitted for admin review. You will be notified once approved.');
    } catch (err) { setExpErr(err.response?.data?.message||'Failed'); }
    finally { setExpSaving(false); }
  };

  const updateExp = (i, field, val) => setExpList(prev => { const u=[...prev]; u[i]={...u[i],[field]:val}; return u; });

  const [msgType, msgText] = basicMsg.split(':');

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:24 }}>
      {user.status==='pending' && <div className="alert alert-info" style={{marginBottom:16}}>⏳ Profile under admin review. You'll be notified once approved.</div>}
      {user.status==='rejected' && <div className="alert alert-error" style={{marginBottom:16}}>✕ Rejected{user.rejectionReason?`: ${user.rejectionReason}`:''}.  Update and resubmit.</div>}

      {/* Basic Info */}
      <div className="card" style={{marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Basic Information</h3>
        <p className="text-sm text-gray" style={{marginBottom:14}}>Saves instantly — no admin review needed.</p>
        <form onSubmit={saveBasic} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={basic.name} onChange={e=>setBasic(f=>({...f,name:e.target.value}))} required/></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={basic.phone} onChange={e=>setBasic(f=>({...f,phone:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Bio</label><textarea className="form-textarea" rows={3} value={basic.bio} onChange={e=>setBasic(f=>({...f,bio:e.target.value}))} placeholder="Your professional background..."/></div>
          {basicMsg && <div className={`alert ${msgType==='success'?'alert-success':'alert-error'}`}>{msgText}</div>}
          <div><button className="btn btn-primary" type="submit" disabled={basicSaving}>{basicSaving?'Saving…':'Save Info'}</button></div>
        </form>
      </div>

      {/* Expertise */}
      <div className="card">
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Expertise & Domains</h3>
        <p className="text-sm text-gray" style={{marginBottom:14}}>Changes require <strong>admin re-approval</strong>. AI uses this to match you to customer requests.</p>
        <form onSubmit={submitExp} style={{display:'flex',flexDirection:'column',gap:12}}>
          {expList.map((ex,i)=>(
            <div key={i} className="expertise-item">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <span style={{fontWeight:600,fontSize:13}}>Domain #{i+1}</span>
                {expList.length>1 && <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--danger)',padding:'2px 8px'}} onClick={()=>setExpList(p=>p.filter((_,j)=>j!==i))}>Remove</button>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div className="form-group"><label className="form-label">Domain *</label>
                  <select className="form-select" value={ex.domain} onChange={e=>updateExp(i,'domain',e.target.value)} required>
                    <option value="">Select domain</option>
                    {DOMAIN_OPTIONS.map(d=><option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Years Experience</label><input className="form-input" type="number" min="0" value={ex.years} onChange={e=>updateExp(i,'years',e.target.value)} placeholder="e.g. 5"/></div>
              </div>
              <div className="form-group" style={{marginBottom:10}}><label className="form-label">Skills & Tags <span className="text-gray text-xs">(comma separated)</span></label><input className="form-input" value={ex.tags} onChange={e=>updateExp(i,'tags',e.target.value)} placeholder="e.g. contract law, litigation, IP"/></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" rows={2} value={ex.desc} onChange={e=>updateExp(i,'desc',e.target.value)} placeholder="Describe your expertise..."/></div>
              {ex.tags && <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}}>{ex.tags.split(',').map(t=>t.trim()).filter(Boolean).map((t,j)=><span key={j} className="badge badge-primary" style={{fontSize:11}}>{t}</span>)}</div>}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={()=>setExpList(p=>[...p,{domain:'',tags:'',years:'',desc:''}])}>+ Add Domain</button>
          {expErr && <div className="alert alert-error">{expErr}</div>}
          {expMsg && <div className="alert alert-success">{expMsg}</div>}
          <div style={{borderTop:'1px solid var(--gray-100)',paddingTop:12,display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-primary" type="submit" disabled={expSaving}>{expSaving?'Submitting…':'Submit for Review'}</button>
            <span className="text-xs text-gray">Admin will review and notify you</span>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function ProviderDashboard() {
  const { user, updateUser } = useAuth();
  const { getSocket } = useSocket();

  const [view, setView] = useState('tasks');              // 'tasks' | 'profile'
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'mine'
  const [availableTasks, setAvailableTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable !== false);
  const [typingUser, setTypingUser] = useState(null);
  const [completingTask, setCompletingTask] = useState(false);
  const [accepting, setAccepting] = useState(null);
  // Price modal state
  const [priceModal, setPriceModal] = useState(null); // taskId being priced
  const [priceInput, setPriceInput] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeRoomRef = useRef(null);
  const pollRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });

  const fetchAvailable = useCallback(async () => {
    if (user?.status !== 'approved') return;
    setLoadingAvail(true);
    try { const { data } = await api.get('/tasks/available'); setAvailableTasks(data); }
    catch {} finally { setLoadingAvail(false); }
  }, [user?.status]);

  const fetchMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const { data } = await api.get('/tasks/my');
      setMyTasks(data);
    } finally { setLoadingMine(false); }
  }, []);

  useEffect(() => {
    fetchMine();
    fetchAvailable();
    pollRef.current = setInterval(fetchAvailable, 15000);
    return () => clearInterval(pollRef.current);
  }, []);

  const openChat = useCallback(async (task) => {
    setActiveTask(task);
    setLoadingMsgs(true);
    const socket = getSocket();
    if (activeRoomRef.current) socket?.emit('leave_room', { chatRoomId:activeRoomRef.current });
    activeRoomRef.current = task.chatRoomId;
    socket?.emit('join_room', { chatRoomId:task.chatRoomId });
    try { const { data } = await api.get(`/chat/${task.chatRoomId}`); setMessages(data); }
    finally { setLoadingMsgs(false); }
    setTimeout(scrollToBottom, 100);
  }, [getSocket]);

  // Open price modal instead of accepting immediately
  const startAccept = (taskId) => {
    setPriceModal(taskId);
    setPriceInput('');
  };

  const confirmAccept = async () => {
    if (!priceInput || parseFloat(priceInput) <= 0) return;
    const taskId = priceModal;
    setPriceModal(null);
    setAccepting(taskId);
    try {
      const { data: task } = await api.post(`/tasks/${taskId}/accept`, { price: parseFloat(priceInput) });
      setAvailableTasks(prev => prev.filter(t => t._id !== taskId));
      setMyTasks(prev => [task, ...prev]);
      setActiveTab('mine');
      openChat(task);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not accept — task may already be taken');
      fetchAvailable();
    } finally { setAccepting(null); }
  };

  const handleReject = async (taskId) => {
    try { await api.post(`/tasks/${taskId}/reject`); } catch {}
    setAvailableTasks(prev => prev.filter(t => t._id !== taskId));
  };

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMsg    = (msg) => { setMessages(p => [...p, msg]); setTimeout(scrollToBottom, 50); };
    const onAvail     = () => fetchAvailable();
    const onTaken     = ({ taskId }) => setAvailableTasks(p => p.filter(t => t._id !== taskId));
    const onNewNotif  = () => { fetchAvailable(); setActiveTab('available'); };
    const onTyping    = ({ name }) => { setTypingUser(name); clearTimeout(typingTimerRef.current); typingTimerRef.current = setTimeout(()=>setTypingUser(null),2000); };
    const onStopType  = () => setTypingUser(null);
    const onApproved   = ({ message }) => { updateUser({...user, status:'approved'}); setProfileMsg('✅ '+message); setTimeout(()=>setProfileMsg(''),6000); fetchAvailable(); };
    const onRejected   = ({ message, reason }) => { updateUser({...user, status:'rejected', rejectionReason:reason}); setProfileMsg('❌ '+message); };
    const onCompleted  = ({ taskId }) => {
      setMyTasks(prev => prev.map(t => t._id===taskId ? {...t, status:'completed'} : t));
      setActiveTask(prev => prev?._id===taskId ? {...prev, status:'completed'} : prev);
    };

    socket.on('new_message',          onNewMsg);
    socket.on('task_available',       onAvail);
    socket.on('task_taken',           onTaken);
    socket.on('new_task_notification',onNewNotif);
    socket.on('user_typing',          onTyping);
    socket.on('user_stop_typing',     onStopType);
    socket.on('account_approved',     onApproved);
    socket.on('account_rejected',     onRejected);
    socket.on('task_completed',       onCompleted);

    return () => {
      socket.off('new_message',           onNewMsg);
      socket.off('task_available',        onAvail);
      socket.off('task_taken',            onTaken);
      socket.off('new_task_notification', onNewNotif);
      socket.off('user_typing',           onTyping);
      socket.off('user_stop_typing',      onStopType);
      socket.off('account_approved',      onApproved);
      socket.off('account_rejected',      onRejected);
      socket.off('task_completed',        onCompleted);
    };
  }, [getSocket, fetchAvailable, user]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeTask) return;
    getSocket()?.emit('send_message', { chatRoomId:activeTask.chatRoomId, content:inputText, taskId:activeTask._id });
    setInputText('');
    getSocket()?.emit('stop_typing', { chatRoomId:activeTask.chatRoomId });
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (activeTask) {
      getSocket()?.emit('typing', { chatRoomId:activeTask.chatRoomId });
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => getSocket()?.emit('stop_typing', { chatRoomId:activeTask.chatRoomId }), 1000);
    }
  };

  const requestCompletion = async () => {
    if (!activeTask) return;
    setCompletingTask(true);
    try {
      const { data } = await api.post(`/tasks/${activeTask._id}/request-completion`);
      setActiveTask(data);
      setMyTasks(prev => prev.map(t => t._id===data._id ? data : t));
    } catch (err) { alert(err.response?.data?.message||'Failed'); }
    finally { setCompletingTask(false); }
  };

  const toggleAvailability = () => {
    const v = !isAvailable; setIsAvailable(v);
    getSocket()?.emit('set_availability', { isAvailable:v });
  };

  const sc = { assigned:'badge-primary', in_progress:'badge-primary', completed:'badge-success', expired:'badge-danger', open:'badge-gray', notifying:'badge-warning' };

  return (
    <div style={{ height:'calc(100vh - 60px)', display:'flex', flexDirection:'column', background:'var(--gray-50)', color:'var(--gray-900)' }}>

      {/* Price modal */}
      {priceModal && (
        <div className="modal-overlay" onClick={()=>setPriceModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{background:'var(--white)',border:'1px solid var(--gray-200)'}}>
            <div className="modal-title" style={{color:'var(--gray-900)'}}>Set Your Price</div>
            <p style={{fontSize:13,color:'var(--gray-500)',marginBottom:16}}>
              Specify the amount you'll charge for this task. The customer will see this price before the session starts.
            </p>
            <div className="form-group" style={{marginBottom:20}}>
              <label className="form-label">Price (USD) *</label>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--gray-500)',fontWeight:600}}>$</span>
                <input
                  className="form-input" type="number" min="1" step="0.01" autoFocus
                  placeholder="e.g. 50.00"
                  value={priceInput} onChange={e=>setPriceInput(e.target.value)}
                  style={{paddingLeft:28}}
                  onKeyDown={e=>{ if(e.key==='Enter') confirmAccept(); }}
                />
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setPriceModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={confirmAccept} disabled={!priceInput||parseFloat(priceInput)<=0}>
                Confirm & Accept Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval/rejection banner */}
      {profileMsg && (
        <div className={`alert ${profileMsg.startsWith('✅')?'alert-success':'alert-error'}`} style={{margin:'8px 16px',borderRadius:8}}>
          {profileMsg}
        </div>
      )}

      {/* Top nav */}
      <div style={{ background:'var(--white)', borderBottom:'1px solid var(--gray-200)', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex' }}>
          <button className={`tab ${view==='tasks'?'active':''}`} onClick={()=>setView('tasks')} style={{border:'none',background:'none',cursor:'pointer'}}>Tasks</button>
          <button className={`tab ${view==='profile'?'active':''}`} onClick={()=>setView('profile')} style={{border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            My Profile
            {user.status==='pending' && <span className="badge badge-warning" style={{fontSize:10}}>Pending</span>}
            {user.status==='rejected' && <span className="badge badge-danger"  style={{fontSize:10}}>Rejected</span>}
          </button>
        </div>
        {view==='tasks' && (
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {user.expertise?.slice(0,2).map((ex,i)=><span key={i} className="tag" style={{fontSize:11}}>{ex.domain}</span>)}
            </div>
            <button className={`btn btn-sm ${isAvailable?'btn-success':'btn-outline'}`} onClick={toggleAvailability} disabled={user.status!=='approved'}>
              {isAvailable ? '● Available' : '○ Away'}
            </button>
          </div>
        )}
      </div>

      {/* Profile view */}
      {view==='profile' && (
        <div style={{flex:1,overflowY:'auto'}}>
          <ProfileEditor user={user} onSaved={(u)=>{
            setProfileMsg(u.status==='pending' ? '⏳ Expertise submitted — awaiting admin approval.' : '✅ Profile saved.');
            setTimeout(()=>setProfileMsg(''),6000);
          }}/>
        </div>
      )}

      {/* Tasks view */}
      {view==='tasks' && (
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>

          {/* LEFT — task lists */}
          <div style={{width:320,borderRight:'1px solid var(--gray-200)',display:'flex',flexDirection:'column',background:'var(--white)'}}>

            {/* Sub-tabs */}
            <div style={{display:'flex',borderBottom:'2px solid var(--gray-200)'}}>
              {[
                { id:'available', label:'Available', count: availableTasks.length },
                { id:'mine',      label:'My Tasks',  count: myTasks.filter(t=>['assigned','in_progress'].includes(t.status)).length },
              ].map(tab=>(
                <button key={tab.id}
                  onClick={()=>setActiveTab(tab.id)}
                  style={{flex:1,padding:'10px 0',fontSize:13,fontWeight:activeTab===tab.id?700:400,color:activeTab===tab.id?'var(--primary)':'var(--gray-500)',background:'none',border:'none',cursor:'pointer',borderBottom:activeTab===tab.id?'2px solid var(--primary)':'2px solid transparent',marginBottom:-2,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}
                >
                  {tab.label}
                  {tab.count>0 && <span style={{background:activeTab===tab.id?'var(--primary)':'var(--gray-300)',color:'white',borderRadius:10,padding:'1px 6px',fontSize:10}}>{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* Available tasks */}
            {activeTab==='available' && (
              <div style={{flex:1,overflowY:'auto'}}>
                {user.status!=='approved' ? (
                  <div style={{padding:24,textAlign:'center',color:'var(--gray-400)',fontSize:13}}>
                    <div style={{fontSize:36,marginBottom:8}}>⏳</div>
                    Account pending admin approval.
                    <br/><button className="btn btn-outline btn-sm" style={{marginTop:10}} onClick={()=>setView('profile')}>Update Profile</button>
                  </div>
                ) : availableTasks.length===0 ? (
                  <div style={{padding:24,textAlign:'center',color:'var(--gray-400)',fontSize:13}}>
                    <div style={{fontSize:36,marginBottom:8}}>📭</div>
                    No open requests right now.
                    <br/><span style={{fontSize:11,color:'var(--gray-300)'}}>Auto-refreshes every 15s</span>
                    <br/><button className="btn btn-outline btn-sm" style={{marginTop:8}} onClick={fetchAvailable} disabled={loadingAvail}>
                      {loadingAvail?'Refreshing…':'↻ Refresh'}
                    </button>
                  </div>
                ) : (
                  availableTasks.map(task => {
                    const isExpired = new Date(task.acceptWindowExpiry) < Date.now();
                    return (
                      <div key={task._id} style={{borderBottom:'1px solid var(--gray-100)',padding:'14px 16px'}}>
                        {/* Header row */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                            {task.matchedDomains?.slice(0,2).map(d=><span key={d} className="tag" style={{fontSize:10}}>{d}</span>)}
                            {task.aiTags?.slice(0,2).map(t=><span key={t} className="badge badge-gray" style={{fontSize:10}}>{t}</span>)}
                          </div>
                          {isExpired
                            ? <span className="badge badge-danger" style={{fontSize:10}}>Expired</span>
                            : <LiveTimer expiresAt={task.acceptWindowExpiry} onExpire={fetchAvailable}/>
                          }
                        </div>
                        {/* Description */}
                        <div style={{fontSize:13,color:'var(--gray-800)',marginBottom:6,lineHeight:1.4}}>
                          {task.description.slice(0,110)}{task.description.length>110?'…':''}
                        </div>
                        <div className="text-xs text-gray" style={{marginBottom:isExpired?0:10}}>
                          From: <strong>{task.customerId?.name||'Customer'}</strong> &nbsp;·&nbsp; {new Date(task.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                        </div>
                        {/* Actions */}
                        {!isExpired && (
                          <div style={{display:'flex',gap:8}}>
                            <button className="btn btn-danger btn-sm" style={{flex:1}} onClick={()=>handleReject(task._id)} disabled={!!accepting}>
                              Decline
                            </button>
                            <button className="btn btn-success btn-sm" style={{flex:2}} onClick={()=>startAccept(task._id)} disabled={!!accepting}>
                              {accepting===task._id ? 'Accepting…' : '✓ Accept & Set Price'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* My tasks */}
            {activeTab==='mine' && (
              <div style={{flex:1,overflowY:'auto'}}>
                {loadingMine ? (
                  <div className="loading-center"><div className="spinner"/></div>
                ) : myTasks.length===0 ? (
                  <div style={{padding:24,textAlign:'center',color:'var(--gray-400)',fontSize:13}}>
                    <div style={{fontSize:36,marginBottom:8}}>📋</div>
                    No tasks yet.<br/>Accept requests from the Available tab.
                  </div>
                ) : myTasks.map(task=>(
                  <div key={task._id} onClick={()=>openChat(task)}
                    style={{padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid var(--gray-100)',background:activeTask?._id===task._id?'var(--primary-light)':'transparent'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span className={`badge ${sc[task.status]||'badge-gray'}`}>{task.status}</span>
                      <span style={{fontSize:10,color:'var(--gray-400)'}}>{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="truncate" style={{fontSize:13}}>{task.description}</div>
                    <div className="text-xs text-gray" style={{marginTop:4}}>Customer: {task.customerId?.name||'—'}</div>
                    {task.status==='completed' && task.paymentStatus==='paid' && <span className="badge badge-success" style={{fontSize:10,marginTop:4}}>💰 Paid</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Chat */}
          <div className="chat-main">
            {!activeTask ? (
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'var(--gray-400)'}}>
                <div style={{fontSize:56}}>💬</div>
                <div style={{fontWeight:600,fontSize:16}}>No task selected</div>
                <div className="text-sm">Accept a request from the Available tab to start chatting</div>
              </div>
            ) : (
              <>
                <div className="chat-header">
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>Chat with {activeTask.customerId?.name||'Customer'}</div>
                    <div className="text-sm text-gray truncate" style={{maxWidth:400}}>{activeTask.description}</div>
                  </div>
                  <span className={`badge ${sc[activeTask.status]||'badge-gray'}`}>{activeTask.status}</span>
                </div>

                <div className="chat-messages">
                  {loadingMsgs
                    ? <div className="loading-center"><div className="spinner"/></div>
                    : messages.map(msg=><MessageBubble key={msg._id} message={msg} myId={user._id}/>)
                  }
                  {typingUser && <div className="text-xs text-gray" style={{padding:'4px 8px'}}>{typingUser} is typing…</div>}
                  <div ref={messagesEndRef}/>
                </div>

                {['assigned','in_progress'].includes(activeTask.status) && (
                  <>
                    <form className="chat-input-area" onSubmit={sendMessage}>
                      <input className="chat-input" value={inputText} onChange={handleTyping} placeholder="Type your message…" autoFocus/>
                      <button className="btn btn-primary" type="submit" disabled={!inputText.trim()}>Send</button>
                    </form>
                    <div style={{padding:'10px 20px',borderTop:'1px solid var(--gray-200)',background:'var(--gray-100)',display:'flex',gap:10,alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{fontSize:13,color:'var(--gray-500)'}}>
                        Agreed price: <strong style={{color:'var(--success)'}}>
                          {activeTask.price > 0 ? `$${activeTask.price.toFixed(2)}` : '—'}
                        </strong>
                      </div>
                      <button className="btn btn-success btn-sm" onClick={requestCompletion} disabled={completingTask}>
                        {completingTask ? 'Requesting…' : '🏁 Request Completion'}
                      </button>
                    </div>
                  </>
                )}

                {activeTask.status==='pending_completion' && (
                  <div style={{padding:14,background:'#1c2a1c',borderTop:'1px solid #166534',textAlign:'center',color:'#34d399',fontSize:13}}>
                    ⏳ Completion requested — waiting for customer approval.
                  </div>
                )}

                {activeTask.status==='completed' && (
                  <div style={{padding:14,background:'#022c22',borderTop:'1px solid #064e3b',textAlign:'center',color:'#34d399',fontSize:13}}>
                    ✅ Task completed. {activeTask.paymentStatus==='paid' ? '💰 Payment received!' : 'Awaiting customer payment.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
