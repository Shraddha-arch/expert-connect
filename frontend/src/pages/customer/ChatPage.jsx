import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import PaymentModal from '../../components/PaymentModal';

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_DOT = {
  notifying:         '#f59e0b',
  assigned:          '#22c55e',
  in_progress:       '#22c55e',
  pending_completion:'#a78bfa',
  completed:         '#6366f1',
  expired:           '#ef4444',
};

const STATUS_LABEL = {
  notifying:          'Finding expert…',
  assigned:           'Expert assigned',
  in_progress:        'In progress',
  pending_completion: 'Awaiting approval',
  completed:          'Completed',
  expired:            'Expired',
};

/* ── Sidebar conversation item ─────────────────────────────────────────── */
function ConvItem({ task, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', padding: '9px 12px', textAlign: 'left', border: 'none',
        borderRadius: 8, cursor: 'pointer', marginBottom: 1,
        background: active ? '#2a2a2a' : hover ? '#1f1f1f' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: active ? 500 : 400,
        color: active ? '#fff' : '#d4d4d4',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {task.description.length > 38 ? task.description.slice(0, 38) + '…' : task.description}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: STATUS_DOT[task.status] || '#555',
        }} />
        <span style={{ fontSize: 11, color: '#666' }}>
          {STATUS_LABEL[task.status] || task.status}
        </span>
        <span style={{ fontSize: 11, color: '#444', marginLeft: 'auto' }}>
          {timeAgo(task.createdAt)}
        </span>
      </div>
    </button>
  );
}

/* ── Provider profile chip ─────────────────────────────────────────────── */
function ProviderChip({ provider }) {
  if (!provider) return null;
  const initial = provider.name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', background: 'var(--gray-50)',
      borderBottom: '1px solid var(--gray-200)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, flexShrink: 0,
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{provider.name}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {provider.expertise?.map((ex, i) => (
            <span key={i} style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>
              {ex.domain}
            </span>
          ))}
          {provider.rating > 0 && (
            <span style={{ color: 'var(--warning)' }}>★ {provider.rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Message bubble ────────────────────────────────────────────────────── */
function MessageBubble({ message, myId }) {
  const isMine = message.senderId?._id === myId || message.senderId === myId;
  const isSystem = message.type === 'system' || message.senderRole === 'system';

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
          color: '#fbbf24', borderRadius: 8, fontSize: 12, padding: '8px 16px',
          maxWidth: 560, textAlign: 'center', lineHeight: 1.5, whiteSpace: 'pre-line',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
      {!isMine && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {(message.senderId?.name || 'E').charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ maxWidth: '65%' }}>
        {!isMine && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 3, paddingLeft: 2 }}>
            {message.senderId?.name}
          </div>
        )}
        <div style={{
          padding: '10px 15px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isMine ? 'var(--primary)' : 'var(--gray-100)',
          color: isMine ? '#fff' : 'var(--gray-900)',
          fontSize: 14, lineHeight: 1.55,
        }}>
          {message.content}
        </div>
        <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 4, textAlign: isMine ? 'right' : 'left', paddingLeft: 2, paddingRight: 2 }}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function CustomerChatPage() {
  const { user } = useAuth();
  const { getSocket } = useSocket();
  const location = useLocation();

  const [tasks, setTasks]                   = useState([]);
  const [activeTask, setActiveTask]         = useState(null);
  const [messages, setMessages]             = useState([]);
  const [inputText, setInputText]           = useState('');
  const [newRequest, setNewRequest]         = useState(location.state?.prefillQuery || '');
  const [loadingTasks, setLoadingTasks]     = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [typingUser, setTypingUser]         = useState(null);
  const [showPayment, setShowPayment]       = useState(false);
  const [statusMsg, setStatusMsg]           = useState('');
  const [approvingCompletion, setApprovingCompletion] = useState(false);

  const messagesEndRef  = useRef(null);
  const typingTimerRef  = useRef(null);
  const activeRoomRef   = useRef(null);
  const autoSubmitted   = useRef(false);
  const textareaRef     = useRef(null);
  const chatInputRef    = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  /* ── Load tasks ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/tasks/my');
        setTasks(data);
        const active = data.find((t) =>
          ['assigned', 'in_progress', 'notifying', 'pending_completion', 'completed'].includes(t.status)
        );
        if (active) selectTask(active);
      } finally {
        setLoadingTasks(false);
      }
    };
    load();
  }, []);

  /* ── Select task / load messages ────────────────────────────────────── */
  const selectTask = useCallback(async (task) => {
    setActiveTask(task);
    setLoadingMessages(true);
    const socket = getSocket();
    if (activeRoomRef.current) socket?.emit('leave_room', { chatRoomId: activeRoomRef.current });
    activeRoomRef.current = task.chatRoomId;
    socket?.emit('join_room', { chatRoomId: task.chatRoomId });
    try {
      const { data } = await api.get(`/chat/${task.chatRoomId}`);
      setMessages(data);
    } finally {
      setLoadingMessages(false);
    }
    setTimeout(scrollToBottom, 100);
  }, [getSocket]);

  /* ── Socket events ─────────────────────────────────────────────────── */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    };
    const onTaskAssigned = ({ taskId, provider }) => {
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: 'assigned', serviceProviderId: provider } : t));
      setActiveTask((prev) => prev?._id === taskId ? { ...prev, status: 'assigned', serviceProviderId: provider } : prev);
      setStatusMsg(`Expert ${provider.name} has been assigned!`);
      setTimeout(() => setStatusMsg(''), 5000);
    };
    const onTaskExpired = ({ taskId }) => {
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: 'expired' } : t));
      setActiveTask((prev) => prev?._id === taskId ? { ...prev, status: 'expired' } : prev);
    };
    const onTaskCompleted = ({ taskId, amount }) => {
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: 'completed', amount } : t));
      setActiveTask((prev) => prev?._id === taskId ? { ...prev, status: 'completed', amount } : prev);
    };
    const onCompletionRequested = ({ taskId }) => {
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: 'pending_completion' } : t));
      setActiveTask((prev) => prev?._id === taskId ? { ...prev, status: 'pending_completion' } : prev);
    };
    const onTyping    = ({ name }) => { setTypingUser(name); clearTimeout(typingTimerRef.current); typingTimerRef.current = setTimeout(() => setTypingUser(null), 2000); };
    const onStopTyping = () => setTypingUser(null);

    socket.on('new_message', onNewMessage);
    socket.on('task_assigned', onTaskAssigned);
    socket.on('task_expired', onTaskExpired);
    socket.on('task_completed', onTaskCompleted);
    socket.on('task_completion_requested', onCompletionRequested);
    socket.on('user_typing', onTyping);
    socket.on('user_stop_typing', onStopTyping);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('task_assigned', onTaskAssigned);
      socket.off('task_expired', onTaskExpired);
      socket.off('task_completed', onTaskCompleted);
      socket.off('task_completion_requested', onCompletionRequested);
      socket.off('user_typing', onTyping);
      socket.off('user_stop_typing', onStopTyping);
    };
  }, [getSocket]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  /* ── Auto-submit on mount (from landing page flow) ──────────────────── */
  useEffect(() => {
    if (!loadingTasks && !activeTask && location.state?.autoSubmit && location.state?.prefillQuery && !autoSubmitted.current) {
      autoSubmitted.current = true;
      handleNewRequest({ preventDefault: () => {} });
    }
  }, [loadingTasks]);

  /* ── Submit new request ─────────────────────────────────────────────── */
  const handleNewRequest = async (e) => {
    e.preventDefault();
    if (!newRequest.trim()) return;
    setSubmitting(true);
    try {
      const { data: task } = await api.post('/tasks', { description: newRequest });
      setTasks((prev) => [task, ...prev]);
      setNewRequest('');
      selectTask(task);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Send chat message ──────────────────────────────────────────────── */
  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeTask) return;
    const socket = getSocket();
    socket?.emit('send_message', { chatRoomId: activeTask.chatRoomId, content: inputText, taskId: activeTask._id });
    setInputText('');
    socket?.emit('stop_typing', { chatRoomId: activeTask.chatRoomId });
    if (chatInputRef.current) { chatInputRef.current.style.height = 'auto'; }
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    // auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    const socket = getSocket();
    if (activeTask) {
      socket?.emit('typing', { chatRoomId: activeTask.chatRoomId });
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => socket?.emit('stop_typing', { chatRoomId: activeTask.chatRoomId }), 1000);
    }
  };

  const approveCompletion = async () => {
    if (!activeTask) return;
    setApprovingCompletion(true);
    try {
      const { data } = await api.post(`/tasks/${activeTask._id}/complete`);
      setActiveTask(data);
      setTasks((prev) => prev.map((t) => t._id === data._id ? data : t));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve completion');
    } finally {
      setApprovingCompletion(false);
    }
  };

  const statusBadgeColor = {
    open: 'badge-gray', notifying: 'badge-warning', assigned: 'badge-primary',
    in_progress: 'badge-primary', pending_completion: 'badge-warning',
    completed: 'badge-success', expired: 'badge-danger',
  };

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="chat-layout">

      {/* ── LEFT SIDEBAR (Claude-style dark) ─────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0, background: '#171717',
        borderRight: '1px solid #252525', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '14px 12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #252525' }}>
          <span style={{ color: '#e5e5e5', fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>ExpertConnect</span>
          <button
            onClick={() => setActiveTask(null)}
            title="New request"
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 5, borderRadius: 6, display: 'flex', lineHeight: 1 }}
          >
            {/* compose / new chat icon */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="11" />
            </svg>
          </button>
        </div>

        {/* New request button */}
        <div style={{ padding: '10px 10px 6px' }}>
          <button
            onClick={() => setActiveTask(null)}
            style={{
              width: '100%', padding: '8px 12px', background: '#252525',
              border: '1px solid #333', borderRadius: 8, color: '#ccc',
              cursor: 'pointer', fontSize: 13, textAlign: 'left', display: 'flex',
              alignItems: 'center', gap: 7, transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2e2e2e'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#252525'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Request
          </button>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {loadingTasks ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: '#555', fontSize: 12, lineHeight: 1.6 }}>
              No conversations yet.<br />Start your first request!
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, padding: '8px 4px 4px' }}>
                Recent
              </div>
              {tasks.map((task) => (
                <ConvItem
                  key={task._id}
                  task={task}
                  active={activeTask?._id === task._id}
                  onClick={() => selectTask(task)}
                />
              ))}
            </>
          )}
        </div>

        {/* User profile at bottom */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #252525', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#e5e5e5', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: '#555' }}>Customer</div>
          </div>
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────────────── */}
      <div className="chat-main">

        {/* ── EMPTY STATE: No active task ───────────────────────────── */}
        {!activeTask ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '40px 24px', gap: 28, overflowY: 'auto',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 6 }}>
                How can I help you, {user?.name?.split(' ')[0]}?
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>
                Describe your problem — we'll connect you with the right expert instantly.
              </div>
            </div>

            {/* Input box */}
            <form onSubmit={handleNewRequest} style={{ width: '100%', maxWidth: 660 }}>
              <div style={{
                position: 'relative', background: 'var(--white)', borderRadius: 16,
                border: '1.5px solid var(--gray-300)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}>
                <textarea
                  ref={textareaRef}
                  style={{
                    width: '100%', minHeight: 110, padding: '18px 18px 54px',
                    background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 14, color: 'var(--gray-800)', resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                  placeholder="e.g. I need legal advice on a contract dispute..."
                  value={newRequest}
                  onChange={(e) => setNewRequest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNewRequest(e); } }}
                />
                <div style={{ position: 'absolute', bottom: 10, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>⏎ to send</span>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={submitting || !newRequest.trim()}
                    style={{ borderRadius: 10, padding: '7px 16px', fontSize: 13 }}
                  >
                    {submitting ? 'Searching…' : '🔍 Find Expert'}
                  </button>
                </div>
              </div>
            </form>

            {/* Quick start cards */}
            <div style={{ width: '100%', maxWidth: 660 }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: 600 }}>
                Quick Start
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { icon: '🏥', label: 'Health Advisor',  color: '#34d399', topic: 'Persistent headache & fatigue',        intent: 'I want to review my symptoms',      prompt: 'I need medical advice about persistent headache & fatigue. I want to review my symptoms with an expert.' },
                  { icon: '⚖️', label: 'Legal Advisor',   color: '#818cf8', topic: 'Contract dispute with my employer',    intent: 'I want to review my legal options', prompt: 'I need legal advice regarding a contract dispute with my employer. I want to review my legal options.' },
                  { icon: '💻', label: 'Code Advisor',    color: '#38bdf8', topic: 'Debugging a React useEffect issue',    intent: 'I want to review my code',          prompt: 'I need help with a coding problem: debugging a React useEffect issue. I want to review my code with an expert.' },
                  { icon: '✍️', label: 'Post Advisor',    color: '#fb923c', topic: 'Launching my product on LinkedIn',     intent: 'I want to review my post draft',    prompt: 'I need help writing a post about launching my new product on LinkedIn. I want to review my post draft.' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { setNewRequest(item.prompt); textareaRef.current?.focus(); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                      padding: '14px', background: 'var(--white)', border: '1px solid var(--gray-200)',
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 2px 12px ${item.color}22`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-800)' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 2, lineHeight: 1.4 }}>{item.topic}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>{item.intent}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

        ) : (
          /* ── ACTIVE TASK: Chat view ──────────────────────────────── */
          <>
            {/* Header */}
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid var(--gray-200)',
              background: 'var(--white)', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {activeTask.serviceProviderId
                    ? `Chat with ${activeTask.serviceProviderId.name}`
                    : STATUS_LABEL[activeTask.status] || 'Connecting…'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                  {activeTask.description}
                </div>
              </div>
              <span className={`badge ${statusBadgeColor[activeTask.status] || 'badge-gray'}`} style={{ flexShrink: 0 }}>
                {activeTask.status.replace('_', ' ')}
              </span>
              {activeTask.status === 'completed' && activeTask.paymentStatus !== 'paid' && (
                <button className="btn btn-success btn-sm" onClick={() => setShowPayment(true)} style={{ flexShrink: 0 }}>
                  Pay ${(activeTask.price || activeTask.amount || 0).toFixed(2)}
                </button>
              )}
              {activeTask.paymentStatus === 'paid' && (
                <span className="badge badge-success" style={{ flexShrink: 0 }}>Paid ✓</span>
              )}
            </div>

            {/* Provider chip */}
            {activeTask.serviceProviderId && <ProviderChip provider={activeTask.serviceProviderId} />}

            {/* Status banner */}
            {statusMsg && (
              <div style={{ padding: '8px 20px', background: '#052e16', borderBottom: '1px solid #166534' }}>
                <div className="alert alert-success" style={{ margin: 0, padding: '8px 12px', fontSize: 13 }}>{statusMsg}</div>
              </div>
            )}

            {/* Notifying state */}
            {activeTask.status === 'notifying' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 20, textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 76, height: 76 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.2, animation: 'pulse 2s infinite' }} />
                  <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.4, animation: 'pulse 2s infinite 0.5s' }} />
                  <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    🔍
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Finding the right expert for you…</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)', maxWidth: 380, lineHeight: 1.6 }}>
                    We're matching your request with available experts. This usually takes under 2 minutes.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--gray-100)', borderRadius: 20 }}>
                  <div className="spinner" style={{ width: 13, height: 13, border: '2px solid var(--gray-300)', borderTopColor: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Notifying available experts…</span>
                </div>
              </div>
            )}

            {/* Expired state */}
            {activeTask.status === 'expired' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>😔</div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>No expert was available this time</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)', maxWidth: 380, lineHeight: 1.6 }}>
                    All experts were busy. Don't worry — try again and we'll match you right away.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => setActiveTask(null)} style={{ borderRadius: 10, padding: '9px 24px', marginTop: 4 }}>
                  🔄 Try Again
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
              <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {loadingMessages ? (
                  <div className="loading-center"><div className="spinner" /></div>
                ) : (
                  messages.map((msg) => <MessageBubble key={msg._id} message={msg} myId={user._id} />)
                )}
                {typingUser && (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', paddingLeft: 40 }}>{typingUser} is typing…</div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Chat input (Claude-style textarea) */}
            {['assigned', 'in_progress'].includes(activeTask.status) && (
              <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--gray-200)', background: 'var(--white)' }}>
                {activeTask.price > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8, textAlign: 'center' }}>
                    💰 Agreed price: <strong style={{ color: 'var(--success)' }}>${activeTask.price.toFixed(2)}</strong>
                    <span style={{ marginLeft: 6 }}>· Share full task details below</span>
                  </div>
                )}
                <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', background: 'var(--white)', borderRadius: 14, border: '1.5px solid var(--gray-300)', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                  <textarea
                    ref={chatInputRef}
                    value={inputText}
                    onChange={handleTyping}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Share your task details… (Enter to send, Shift+Enter for newline)"
                    autoFocus
                    rows={1}
                    style={{
                      width: '100%', padding: '13px 52px 13px 16px', border: 'none', outline: 'none',
                      background: 'transparent', fontSize: 14, fontFamily: 'inherit',
                      resize: 'none', minHeight: 48, maxHeight: 160, lineHeight: 1.5,
                      boxSizing: 'border-box', overflowY: 'auto',
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    style={{
                      position: 'absolute', right: 10, bottom: 10,
                      width: 32, height: 32, borderRadius: 8,
                      background: inputText.trim() ? 'var(--primary)' : 'var(--gray-200)',
                      border: 'none', cursor: inputText.trim() ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={inputText.trim() ? '#fff' : '#999'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Pending completion */}
            {activeTask.status === 'pending_completion' && (
              <div style={{ padding: '14px 20px', background: '#1a2e1a', borderTop: '1px solid #166534', textAlign: 'center' }}>
                <p style={{ marginBottom: 4, color: '#34d399', fontWeight: 600, fontSize: 14 }}>🏁 Expert has marked the work as done</p>
                <p style={{ marginBottom: 12, color: '#6ee7b7', fontSize: 13 }}>Amount due: <strong>${(activeTask.price || 0).toFixed(2)}</strong></p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#94a3b8' }}>Dispute</button>
                  <button className="btn btn-success" onClick={approveCompletion} disabled={approvingCompletion}>
                    {approvingCompletion ? 'Approving…' : '✅ Approve & Proceed to Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* Completed — needs payment */}
            {activeTask.status === 'completed' && activeTask.paymentStatus !== 'paid' && (
              <div style={{ padding: '14px 20px', background: '#022c22', borderTop: '1px solid #064e3b', textAlign: 'center' }}>
                <p style={{ marginBottom: 10, color: '#34d399', fontSize: 13 }}>
                  Task completed! Please pay <strong>${(activeTask.price || activeTask.amount || 0).toFixed(2)}</strong> to close this session.
                </p>
                <button className="btn btn-success" onClick={() => setShowPayment(true)}>Complete Payment</button>
              </div>
            )}

            {/* Paid */}
            {activeTask.paymentStatus === 'paid' && (
              <div style={{ padding: '14px 20px', background: '#022c22', borderTop: '1px solid #064e3b', textAlign: 'center', color: '#34d399', fontSize: 13 }}>
                ✅ Payment completed. Thank you for using ExpertConnect!
              </div>
            )}
          </>
        )}
      </div>

      {showPayment && activeTask && (
        <PaymentModal
          task={activeTask}
          onClose={() => setShowPayment(false)}
          onPaid={() => {
            setShowPayment(false);
            setActiveTask((t) => ({ ...t, paymentStatus: 'paid' }));
            setTasks((prev) => prev.map((t) => t._id === activeTask._id ? { ...t, paymentStatus: 'paid' } : t));
          }}
        />
      )}
    </div>
  );
}
