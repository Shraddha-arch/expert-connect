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
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const STATUS_DOT = {
  notifying: '#f59e0b', assigned: '#22c55e', in_progress: '#22c55e',
  pending_completion: '#a78bfa', completed: '#6366f1', expired: '#ef4444',
};
const STATUS_LABEL = {
  notifying: 'Finding expert…', assigned: 'Expert assigned', in_progress: 'In progress',
  pending_completion: 'Awaiting approval', completed: 'Completed', expired: 'Expired',
};

/* ── SVG Icons ──────────────────────────────────────────────────────────── */
const IconPencil = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconSend = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? '#fff' : 'none'} stroke={active ? 'none' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      : <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>
    }
  </svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/* ── Asterisk / Claude logo ─────────────────────────────────────────────── */
function AsteriskLogo({ size = 48 }) { // eslint-disable-line no-unused-vars
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {[0, 30, 60, 90, 120, 150].map((deg) => (
        <line
          key={deg}
          x1="50" y1="12" x2="50" y2="88"
          stroke="var(--primary)"
          strokeWidth="7"
          strokeLinecap="round"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </svg>
  );
}

/* ── Sidebar conversation item ─────────────────────────────────────────── */
function ConvItem({ task, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', padding: '7px 10px', textAlign: 'left', border: 'none',
        borderRadius: 7, cursor: 'pointer', marginBottom: 1,
        background: active ? '#2a2a2a' : hover ? '#1e1e1e' : 'transparent',
        transition: 'background 0.1s', display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: STATUS_DOT[task.status] || '#555',
      }} />
      <span style={{
        flex: 1, fontSize: 13, color: active ? '#ececec' : '#9a9a9a',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontWeight: active ? 500 : 400,
      }}>
        {task.description.length > 32 ? task.description.slice(0, 32) + '…' : task.description}
      </span>
      <span style={{ fontSize: 10, color: '#4a4a4a', flexShrink: 0 }}>{timeAgo(task.createdAt)}</span>
    </button>
  );
}

/* ── Provider chip ─────────────────────────────────────────────────────── */
function ProviderChip({ provider }) {
  if (!provider) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #252525',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', background: 'rgba(204,120,92,0.2)',
        color: '#cc785c', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}>
        {provider.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#e0e0e0' }}>{provider.name}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
          {provider.expertise?.map((ex, i) => (
            <span key={i} style={{
              background: 'rgba(204,120,92,0.12)', color: '#cc785c',
              padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
            }}>{ex.domain}</span>
          ))}
          {provider.rating > 0 && (
            <span style={{ fontSize: 11, color: '#fbbf24' }}>★ {provider.rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Message bubble ─────────────────────────────────────────────────────── */
function MessageBubble({ message, myId }) {
  const isMine = message.senderId?._id === myId || message.senderId === myId;
  const isSystem = message.type === 'system' || message.senderRole === 'system';

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
        <div style={{
          background: 'rgba(204,120,92,0.08)', border: '1px solid rgba(204,120,92,0.18)',
          color: '#cc785c', borderRadius: 10, fontSize: 12.5, padding: '9px 20px',
          maxWidth: 560, textAlign: 'center', lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
      gap: 10, alignItems: 'flex-start', padding: '2px 0',
    }}>
      {!isMine && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: '#2e2e2e',
          color: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 3,
        }}>
          {(message.senderId?.name || 'E').charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ maxWidth: '75%' }}>
        {!isMine && (
          <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>
            {message.senderId?.name}
          </div>
        )}
        <div style={{
          padding: isMine ? '10px 16px' : '2px 0',
          borderRadius: isMine ? '18px 18px 4px 18px' : 0,
          background: isMine ? '#2c2c2c' : 'transparent',
          color: '#e0e0e0', fontSize: 14.5, lineHeight: 1.65,
        }}>
          {message.content}
        </div>
        <div style={{ fontSize: 10, color: '#4a4a4a', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function CustomerChatPage() {
  const { user } = useAuth();
  const { getSocket } = useSocket();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [tasks, setTasks]                     = useState([]);
  const [activeTask, setActiveTask]           = useState(null);
  const [messages, setMessages]               = useState([]);
  const [inputText, setInputText]             = useState('');
  const [newRequest, setNewRequest]           = useState(location.state?.prefillQuery || '');
  const [loadingTasks, setLoadingTasks]       = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [typingUser, setTypingUser]           = useState(null);
  const [showPayment, setShowPayment]         = useState(false);
  const [statusMsg, setStatusMsg]             = useState('');
  const [approvingCompletion, setApprovingCompletion] = useState(false);
  const [waitDialog, setWaitDialog]           = useState(null);
  const [extending, setExtending]             = useState(false);
  const [sidebarOpen, setSidebarOpen]         = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeRoomRef  = useRef(null);
  const autoSubmitted  = useRef(false);
  const textareaRef    = useRef(null);
  const chatInputRef   = useRef(null);

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

    const onNewMessage       = (msg) => { setMessages((p) => [...p, msg]); setTimeout(scrollToBottom, 50); };
    const onTaskAssigned     = ({ taskId, provider, price }) => {
      setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: 'assigned', serviceProviderId: provider, price } : t));
      setActiveTask((p) => p?._id === taskId ? { ...p, status: 'assigned', serviceProviderId: provider, price } : p);
      setStatusMsg(`Expert ${provider.name} has been assigned!`);
      setTimeout(() => setStatusMsg(''), 5000);
    };
    const onTaskExpired      = ({ taskId }) => {
      setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: 'expired' } : t));
      setActiveTask((p) => {
        if (p?._id === taskId) { setWaitDialog(taskId); return { ...p, status: 'expired' }; }
        return p;
      });
    };
    const onTaskCompleted    = ({ taskId, amount }) => {
      setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: 'completed', amount } : t));
      setActiveTask((p) => p?._id === taskId ? { ...p, status: 'completed', amount } : p);
    };
    const onCompletionReq    = ({ taskId, price }) => {
      setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: 'pending_completion', price } : t));
      setActiveTask((p) => p?._id === taskId ? { ...p, status: 'pending_completion', price } : p);
    };
    const onTyping           = ({ name }) => { setTypingUser(name); clearTimeout(typingTimerRef.current); typingTimerRef.current = setTimeout(() => setTypingUser(null), 2000); };
    const onStopTyping       = () => setTypingUser(null);

    socket.on('new_message',                onNewMessage);
    socket.on('task_assigned',              onTaskAssigned);
    socket.on('task_expired',               onTaskExpired);
    socket.on('task_completed',             onTaskCompleted);
    socket.on('task_completion_requested',  onCompletionReq);
    socket.on('user_typing',                onTyping);
    socket.on('user_stop_typing',           onStopTyping);
    return () => {
      socket.off('new_message',               onNewMessage);
      socket.off('task_assigned',             onTaskAssigned);
      socket.off('task_expired',              onTaskExpired);
      socket.off('task_completed',            onTaskCompleted);
      socket.off('task_completion_requested', onCompletionReq);
      socket.off('user_typing',               onTyping);
      socket.off('user_stop_typing',          onStopTyping);
    };
  }, [getSocket]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  /* ── Auto-submit from landing page ──────────────────────────────────── */
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
      setTasks((p) => [task, ...p]);
      setNewRequest('');
      selectTask(task);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Send chat message ──────────────────────────────────────────────── */
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeTask) return;
    const socket = getSocket();
    socket?.emit('send_message', { chatRoomId: activeTask.chatRoomId, content: inputText, taskId: activeTask._id });
    setInputText('');
    socket?.emit('stop_typing', { chatRoomId: activeTask.chatRoomId });
    if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    const socket = getSocket();
    if (activeTask) {
      socket?.emit('typing', { chatRoomId: activeTask.chatRoomId });
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => socket?.emit('stop_typing', { chatRoomId: activeTask.chatRoomId }), 1000);
    }
  };

  const handleWaitMore = async () => {
    if (!waitDialog) return;
    setExtending(true);
    try {
      const { data: task } = await api.post(`/tasks/${waitDialog}/extend`);
      setTasks((p) => p.map((t) => t._id === task._id ? task : t));
      setActiveTask(task);
      const { data: msgs } = await api.get(`/chat/${task.chatRoomId}`);
      setMessages(msgs);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not extend wait time');
    } finally {
      setExtending(false);
      setWaitDialog(null);
    }
  };

  const handleNewChat = () => { setWaitDialog(null); setActiveTask(null); };

  const approveCompletion = async () => {
    if (!activeTask) return;
    setApprovingCompletion(true);
    try {
      const { data } = await api.post(`/tasks/${activeTask._id}/complete`);
      setActiveTask(data);
      setTasks((p) => p.map((t) => t._id === data._id ? data : t));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve completion');
    } finally {
      setApprovingCompletion(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = `How can I help you, ${firstName}?`;

  /* ─── Quick actions ──────────────────────────────────────────────────── */
  const quickActions = [
    { label: '📋 Review SOP',        prompt: 'Please review this SOP and provide feedback: ', example: 'e.g. Our onboarding SOP needs compliance review' },
    { label: '💻 Code Review',       prompt: 'Please review this code and suggest improvements: ', example: 'e.g. Review my Python data pipeline for bugs' },
    { label: '🏥 Healthcare Report', prompt: 'Please review this healthcare report: ', example: 'e.g. Analyze this patient lab results report' },
    { label: '📄 Document Review',   prompt: 'Please review this document and provide feedback: ', example: 'e.g. Review my business proposal document' },
    { label: '📊 Business Report',   prompt: 'Please review this business report: ', example: 'e.g. Review our Q3 financial performance report' },
  ];

  /* ─── Rotating placeholder ───────────────────────────────────────────── */
  const placeholderExamples = quickActions.map(a => a.prompt + a.example.replace('e.g. ', '').toLowerCase());
  const [phIdx, setPhIdx] = useState(0);
  const [typedPh, setTypedPh] = useState('');
  useEffect(() => {
    if (newRequest) return; // don't animate while user is typing
    let charIdx = 0;
    let deleting = false;
    let current = placeholderExamples[phIdx];
    const tick = () => {
      if (!deleting) {
        setTypedPh(current.slice(0, charIdx + 1));
        charIdx++;
        if (charIdx === current.length) { deleting = true; setTimeout(tick, 1600); return; }
      } else {
        setTypedPh(current.slice(0, charIdx - 1));
        charIdx--;
        if (charIdx === 0) { deleting = false; setPhIdx(i => (i + 1) % placeholderExamples.length); return; }
      }
      setTimeout(tick, deleting ? 35 : 55);
    };
    const t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, [phIdx, newRequest]); // eslint-disable-line

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#1a1a1a', color: '#e0e0e0', position: 'relative' }}>

      {/* ══ MOBILE SIDEBAR OVERLAY ══════════════════════════════════════ */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 90 }}
        />
      )}

      {/* ══ LEFT SIDEBAR ════════════════════════════════════════════════ */}
      <div style={{
        width: isMobile ? '80vw' : 256,
        maxWidth: isMobile ? 320 : 256,
        flexShrink: 0, background: '#171717',
        borderRight: '1px solid #252525', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        ...(isMobile ? {
          position: 'fixed', top: 60, left: 0, bottom: 0, zIndex: 100,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        } : {}),
      }}>

        {/* Top actions: New chat + Search */}
        <div style={{ padding: '12px 10px 8px', display: 'flex', gap: 2 }}>
          <SidebarBtn icon={<IconPencil />} label="New request" onClick={() => setActiveTask(null)} style={{ flex: 1 }} />
          <SidebarBtn icon={<IconSearch />} label="Search" />
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {loadingTasks ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 28 }}>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 12px', color: '#444', fontSize: 12 }}>
              No conversations yet.<br />Start a new request!
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10.5, color: '#3d3d3d', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: 700, padding: '10px 4px 6px' }}>
                Recents
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

        {/* Bottom: user profile */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #252525', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,120,92,0.25)',
            color: '#cc785c', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#c8c8c8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 10, color: '#444' }}>Free plan</div>
          </div>
        </div>
      </div>

      {/* ══ MAIN AREA ═══════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a1a1a', minWidth: 0 }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderBottom: '1px solid #252525', background: '#171717',
          }}>
            <button
              onClick={() => setSidebarOpen(v => !v)}
              style={{
                background: 'transparent', border: 'none', color: '#888', cursor: 'pointer',
                padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#cc785c' }}>
              {activeTask ? (activeTask.serviceProviderId ? `Chat with ${activeTask.serviceProviderId.name}` : 'ExpertConnect') : 'ExpertConnect'}
            </span>
          </div>
        )}

        {!activeTask ? (
          /* ── EMPTY STATE (Claude home screen) ─────────────────────── */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: isMobile ? '0 16px 40px' : '0 24px 60px', overflowY: 'auto',
          }}>
            {/* Greeting */}
            <h1 style={{
              fontSize: 28, fontWeight: 700, color: '#e8e8e8',
              marginBottom: 32, textAlign: 'center', lineHeight: 1.3,
            }}>
              {greeting}
            </h1>

            {/* Main input box */}
            <form onSubmit={handleNewRequest} style={{ width: '100%', maxWidth: 680, marginBottom: 16 }}>
              <div style={{
                position: 'relative', background: '#252525', borderRadius: 16,
                border: '1px solid #333', boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
              }}>
                {/* Attach button (left bottom) */}
                <button
                  type="button"
                  style={{
                    position: 'absolute', left: 12, bottom: 12,
                    width: 30, height: 30, borderRadius: 8,
                    background: 'transparent', border: '1px solid #3a3a3a',
                    color: '#666', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Attach file (coming soon)"
                >
                  <IconPlus />
                </button>

                <textarea
                  ref={textareaRef}
                  style={{
                    width: '100%', minHeight: 120, padding: '16px 52px 52px 52px',
                    background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 15, color: '#e8e8e8', resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                  placeholder={typedPh || 'Describe the document or task you need reviewed…'}
                  value={newRequest}
                  onChange={(e) => {
                    setNewRequest(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNewRequest(e); } }}
                />

                {/* Bottom-right actions */}
                <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Model pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: '#1e1e1e', border: '1px solid #333', borderRadius: 20,
                    padding: '5px 10px', fontSize: 11.5, color: '#888', cursor: 'default',
                  }}>
                    <span>ExpertConnect</span>
                  </div>
                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={submitting || !newRequest.trim()}
                    style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: newRequest.trim() && !submitting ? '#cc785c' : '#2e2e2e',
                      border: 'none', cursor: newRequest.trim() ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    {submitting
                      ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} />
                      : <IconSend active={!!newRequest.trim()} />
                    }
                  </button>
                </div>
              </div>
            </form>

            {/* Quick-action pill buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 680 }}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setNewRequest(action.prompt);
                    setTimeout(() => {
                      const ta = textareaRef.current;
                      if (ta) {
                        ta.focus();
                        ta.style.height = 'auto';
                        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
                        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 50);
                  }}
                  style={{
                    padding: '7px 16px', background: '#252525', border: '1px solid #333',
                    borderRadius: 20, color: '#9a9a9a', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4a4a4a'; e.currentTarget.style.color = '#e0e0e0'; e.currentTarget.style.background = '#2c2c2c'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#9a9a9a'; e.currentTarget.style.background = '#252525'; }}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Example queries */}
            <div style={{ marginTop: 24, maxWidth: 680, width: '100%' }}>
              <div style={{ fontSize: 11, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>
                Example queries
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: '📋', text: 'Review my case report on employee onboarding SOP compliance.' },
                  { icon: '💻', text: 'Review my case report on API authentication and security vulnerabilities.' },
                  { icon: '🏥', text: 'Review my case report on patient post-surgery lab results.' },
                  { icon: '📄', text: 'Review my case report on vendor contract terms and risk clauses.' },
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setNewRequest(ex.text);
                      setTimeout(() => {
                        const ta = textareaRef.current;
                        if (ta) {
                          ta.focus();
                          ta.style.height = 'auto';
                          ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
                          ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 50);
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', background: 'transparent',
                      border: '1px solid #2a2a2a', borderRadius: 10,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'all 0.15s', width: '100%',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.borderColor = '#3a3a3a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#2a2a2a'; }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{ex.icon}</span>
                    <span style={{ fontSize: 13, color: '#5a5a5a', lineHeight: 1.5 }}>{ex.text}</span>
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
              padding: '12px 24px', borderBottom: '1px solid #252525',
              background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e0' }}>
                  {activeTask.serviceProviderId
                    ? `Chat with ${activeTask.serviceProviderId.name}`
                    : STATUS_LABEL[activeTask.status] || 'Connecting…'}
                </div>
                <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                  {activeTask.description}
                </div>
              </div>
              <StatusBadge status={activeTask.status} />
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
              <div style={{ padding: '8px 24px', background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ fontSize: 13, color: '#4ade80' }}>{statusMsg}</div>
              </div>
            )}

            {/* Notifying state */}
            {activeTask.status === 'notifying' && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 24px', gap: 24, textAlign: 'center',
              }}>
                <div style={{ position: 'relative', width: 70, height: 70 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #cc785c', opacity: 0.15, animation: 'pulse 2s infinite' }} />
                  <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '1.5px solid #cc785c', opacity: 0.3, animation: 'pulse 2s infinite 0.6s' }} />
                  <div style={{ position: 'absolute', inset: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#e0e0e0', marginBottom: 8 }}>Finding the right expert…</div>
                  <div style={{ fontSize: 13, color: '#555', maxWidth: 360, lineHeight: 1.7 }}>
                    Matching your request with available experts. This usually takes under 2 minutes.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#252525', borderRadius: 20, border: '1px solid #303030' }}>
                  <div className="spinner" style={{ width: 11, height: 11, border: '2px solid #333', borderTopColor: '#cc785c', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#555' }}>Notifying available experts…</span>
                </div>
              </div>
            )}

            {/* Expired fallback (dialog handles wait prompt) */}
            {activeTask.status === 'expired' && !waitDialog && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 24px', gap: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#e0e0e0', marginBottom: 4 }}>No expert was available this time</div>
                <div style={{ fontSize: 13, color: '#555', maxWidth: 360, lineHeight: 1.65 }}>All experts were busy. Start a new chat to try again.</div>
                <button className="btn btn-primary" onClick={() => setActiveTask(null)} style={{ borderRadius: 10, padding: '9px 24px', marginTop: 4 }}>
                  New Chat
                </button>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px' }}>
              <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {loadingMessages
                  ? <div className="loading-center"><div className="spinner" /></div>
                  : messages.map((msg) => <MessageBubble key={msg._id} message={msg} myId={user._id} />)
                }
                {typingUser && (
                  <div style={{ fontSize: 12, color: '#555', paddingLeft: 36 }}>{typingUser} is typing…</div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Chat input */}
            {['assigned', 'in_progress'].includes(activeTask.status) && (
              <div style={{ padding: '8px 24px 16px', background: '#1a1a1a', borderTop: '1px solid #252525' }}>
                {activeTask.price > 0 && (
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textAlign: 'center' }}>
                    Session rate: <strong style={{ color: '#4ade80' }}>${activeTask.price.toFixed(2)}</strong>
                    <span style={{ marginLeft: 6, color: '#3a3a3a' }}>· Share full details below</span>
                  </div>
                )}
                <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', background: '#252525', borderRadius: 14, border: '1px solid #333' }}>
                  <textarea
                    ref={chatInputRef}
                    value={inputText}
                    onChange={handleTyping}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Message the expert…"
                    autoFocus
                    rows={1}
                    style={{
                      width: '100%', padding: '13px 52px 13px 16px', border: 'none', outline: 'none',
                      background: 'transparent', fontSize: 14, fontFamily: 'inherit', color: '#e8e8e8',
                      resize: 'none', minHeight: 48, maxHeight: 160, lineHeight: 1.55,
                      boxSizing: 'border-box', overflowY: 'auto',
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    style={{
                      position: 'absolute', right: 10, bottom: 10,
                      width: 30, height: 30, borderRadius: 8,
                      background: inputText.trim() ? '#cc785c' : '#2a2a2a',
                      border: 'none', cursor: inputText.trim() ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <IconSend active={!!inputText.trim()} />
                  </button>
                </div>
              </div>
            )}

            {/* Pending completion */}
            {activeTask.status === 'pending_completion' && (
              <div style={{ padding: '14px 24px', background: '#0f1f0f', borderTop: '1px solid #1a3a1a', textAlign: 'center' }}>
                <p style={{ marginBottom: 4, color: '#4ade80', fontWeight: 600, fontSize: 14 }}>Expert has marked the work as done</p>
                <p style={{ marginBottom: 12, color: '#86efac', fontSize: 13 }}>Amount due: <strong>${(activeTask.price || 0).toFixed(2)}</strong></p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #2a2a2a' }}>Dispute</button>
                  <button className="btn btn-success" onClick={approveCompletion} disabled={approvingCompletion}>
                    {approvingCompletion ? 'Approving…' : 'Approve & Pay'}
                  </button>
                </div>
              </div>
            )}

            {/* Completed — needs payment */}
            {activeTask.status === 'completed' && activeTask.paymentStatus !== 'paid' && (
              <div style={{ padding: '14px 24px', background: '#0f1f0f', borderTop: '1px solid #1a3a1a', textAlign: 'center' }}>
                <p style={{ marginBottom: 10, color: '#86efac', fontSize: 13 }}>
                  Session complete — pay <strong style={{ color: '#4ade80' }}>${(activeTask.price || activeTask.amount || 0).toFixed(2)}</strong>
                </p>
                <button className="btn btn-success" onClick={() => setShowPayment(true)}>Complete Payment</button>
              </div>
            )}

            {/* Paid */}
            {activeTask.paymentStatus === 'paid' && (
              <div style={{ padding: '12px 24px', background: '#0f1f0f', borderTop: '1px solid #1a3a1a', textAlign: 'center', color: '#4ade80', fontSize: 13 }}>
                Payment complete — thank you for using ExpertConnect!
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ Wait dialog ══════════════════════════════════════════════════ */}
      {waitDialog && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div style={{
            background: '#222', border: '1px solid #333', borderRadius: 18,
            padding: '36px 32px', maxWidth: 420, width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8e8', marginBottom: 10 }}>
              No expert available yet
            </div>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.65, marginBottom: 28 }}>
              No expert accepted within 2 minutes.<br />
              Would you like to wait <strong style={{ color: '#cc785c' }}>10 more minutes</strong> for one to become available?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={handleNewChat}
                style={{
                  padding: '10px 24px', background: 'transparent', border: '1px solid #333',
                  borderRadius: 10, color: '#888', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
                }}
              >
                New Chat
              </button>
              <button
                onClick={handleWaitMore}
                disabled={extending}
                style={{
                  padding: '10px 24px', background: '#cc785c', border: 'none',
                  borderRadius: 10, color: '#fff', cursor: extending ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontFamily: 'inherit', fontWeight: 600, opacity: extending ? 0.7 : 1,
                }}
              >
                {extending ? 'Extending…' : 'Wait 10 More Minutes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayment && activeTask && (
        <PaymentModal
          task={activeTask}
          onClose={() => setShowPayment(false)}
          onPaid={() => {
            setShowPayment(false);
            setActiveTask((t) => ({ ...t, paymentStatus: 'paid' }));
            setTasks((p) => p.map((t) => t._id === activeTask._id ? { ...t, paymentStatus: 'paid' } : t));
          }}
        />
      )}
    </div>
  );
}

/* ── Helper components ─────────────────────────────────────────────────── */
function SidebarBtn({ icon, label, onClick, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
        background: hover ? '#222' : 'transparent', border: 'none',
        borderRadius: 8, color: hover ? '#ccc' : '#666', cursor: 'pointer',
        fontSize: 13, fontFamily: 'inherit', transition: 'all 0.12s', ...style,
      }}
    >
      {icon}
      {style?.flex && <span>{label}</span>}
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    notifying:          { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', label: 'Finding expert' },
    assigned:           { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e', label: 'Assigned' },
    in_progress:        { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e', label: 'In progress' },
    pending_completion: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', label: 'Pending approval' },
    completed:          { bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', label: 'Completed' },
    expired:            { bg: 'rgba(248,113,113,0.1)', color: '#f87171', label: 'Expired' },
  };
  const s = map[status] || { bg: '#222', color: '#666', label: status };
  return (
    <span style={{
      padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}
