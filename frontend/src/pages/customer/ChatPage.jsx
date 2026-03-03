import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import PaymentModal from '../../components/PaymentModal';

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ProviderProfile({ provider }) {
  if (!provider) return null;
  const initial = provider.name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div className="provider-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div className="avatar-lg" style={{
          width: 48, height: 48, borderRadius: '50%', background: 'var(--primary)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 20
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>{provider.name}</div>
          <div className="text-sm text-gray">{provider.email}</div>
          {provider.rating > 0 && (
            <div style={{ fontSize: 12, color: 'var(--warning)' }}>
              ★ {provider.rating.toFixed(1)} · {provider.completedTasks} tasks
            </div>
          )}
        </div>
      </div>
      {provider.expertise?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {provider.expertise.map((ex, i) => (
            <span key={i} className="tag">{ex.domain}</span>
          ))}
          {provider.expertise.flatMap((ex) => ex.tags || []).slice(0, 5).map((tag, i) => (
            <span key={`tag-${i}`} className="badge badge-gray">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, myId }) {
  const isMine = message.senderId?._id === myId || message.senderId === myId;
  const isSystem = message.type === 'system' || message.senderRole === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="msg-bubble system">{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`msg-row ${isMine ? 'mine' : ''}`}>
      {!isMine && (
        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>
          {(message.senderId?.name || 'U').charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        {!isMine && <div className="msg-name">{message.senderId?.name}</div>}
        <div className={`msg-bubble ${isMine ? 'mine' : 'other'}`}>{message.content}</div>
        <div className={`msg-time`} style={{ textAlign: isMine ? 'right' : 'left' }}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function CustomerChatPage() {
  const { user } = useAuth();
  const { getSocket } = useSocket();
  const location = useLocation();

  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [newRequest, setNewRequest] = useState(location.state?.prefillQuery || '');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeRoomRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Load tasks
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/tasks/my');
        setTasks(data);
        // Auto-select latest active task
        const active = data.find((t) => ['assigned', 'in_progress', 'notifying', 'completed'].includes(t.status));
        if (active) selectTask(active);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetch();
  }, []);

  // Load messages when active task changes
  const selectTask = useCallback(async (task) => {
    setActiveTask(task);
    setLoadingMessages(true);
    const socket = getSocket();

    // Leave old room
    if (activeRoomRef.current) socket?.emit('leave_room', { chatRoomId: activeRoomRef.current });

    // Join new room
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

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    };

    const onTaskAssigned = ({ taskId, provider, chatRoomId }) => {
      setTasks((prev) =>
        prev.map((t) => t._id === taskId ? { ...t, status: 'assigned', serviceProviderId: provider } : t)
      );
      setActiveTask((prev) => prev?._id === taskId ? { ...prev, status: 'assigned', serviceProviderId: provider } : prev);
      setStatusMsg(`Expert ${provider.name} has been assigned to your request!`);
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

    const onTyping = ({ name }) => {
      setTypingUser(name);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingUser(null), 2000);
    };

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

  // Submit new request
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

  // Send chat message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeTask) return;
    const socket = getSocket();
    socket?.emit('send_message', {
      chatRoomId: activeTask.chatRoomId,
      content: inputText,
      taskId: activeTask._id,
    });
    setInputText('');
    getSocket()?.emit('stop_typing', { chatRoomId: activeTask.chatRoomId });
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    const socket = getSocket();
    if (activeTask) {
      socket?.emit('typing', { chatRoomId: activeTask.chatRoomId });
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket?.emit('stop_typing', { chatRoomId: activeTask.chatRoomId });
      }, 1000);
    }
  };

  const [approvingCompletion, setApprovingCompletion] = useState(false);

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

  const statusColor = {
    open: 'badge-gray', notifying: 'badge-warning', assigned: 'badge-primary',
    in_progress: 'badge-primary', pending_completion: 'badge-warning',
    completed: 'badge-success', expired: 'badge-danger',
  };

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>My Requests</div>
          <form onSubmit={handleNewRequest}>
            <textarea
              className="form-textarea"
              style={{ fontSize: 13, marginBottom: 8, borderRadius: 8 }}
              placeholder="Describe your request... (e.g. 'I need legal advice on a contract dispute')"
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              rows={3}
              required
            />
            <button className="btn btn-primary btn-full btn-sm" type="submit" disabled={submitting}>
              {submitting ? 'Finding expert...' : '🔍 Find Expert'}
            </button>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingTasks ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
              No requests yet. Start by describing what you need above.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task._id}
                onClick={() => selectTask(task)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                  background: activeTask?._id === task._id ? 'var(--primary-light)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span className={`badge ${statusColor[task.status] || 'badge-gray'}`}>
                    {task.status}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="truncate" style={{ fontSize: 13, color: 'var(--gray-700)' }}>
                  {task.description}
                </div>
                {task.serviceProviderId && (
                  <div className="text-xs text-gray" style={{ marginTop: 4 }}>
                    Expert: {task.serviceProviderId.name}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {!activeTask ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 32 }}>

            {/* Greeting */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>
                How can I help you, {user?.name?.split(' ')[0]}?
              </div>
              <div style={{ fontSize: 15, color: 'var(--gray-500)' }}>
                Describe your problem and we'll connect you with the right expert instantly.
              </div>
            </div>

            {/* Input box */}
            <form onSubmit={handleNewRequest} style={{ width: '100%', maxWidth: 680 }}>
              <div style={{ position: 'relative', background: 'var(--white)', borderRadius: 16, border: '1px solid var(--gray-300)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <textarea
                  style={{ width: '100%', minHeight: 120, padding: '20px 20px 60px', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--gray-800)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
                  placeholder="e.g. I need legal advice on a contract dispute..."
                  value={newRequest}
                  onChange={(e) => setNewRequest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNewRequest(e); } }}
                />
                <div style={{ position: 'absolute', bottom: 12, right: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Press Enter to send</span>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={submitting || !newRequest.trim()}
                    style={{ borderRadius: 10, padding: '8px 18px', fontSize: 13 }}
                  >
                    {submitting ? 'Searching...' : '🔍 Find Expert'}
                  </button>
                </div>
              </div>
            </form>

            {/* Suggestion tabs */}
            <div style={{ width: '100%', maxWidth: 680 }}>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                Quick Start
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { icon: '🏥', label: 'Health Advisor',  color: '#34d399', topic: 'Persistent headache & fatigue',        intent: 'I want to review my symptoms',         prompt: 'I need medical advice about persistent headache & fatigue. I want to review my symptoms with an expert.' },
                  { icon: '⚖️', label: 'Legal Advisor',   color: '#818cf8', topic: 'Contract dispute with my employer',    intent: 'I want to review my legal options',    prompt: 'I need legal advice regarding a contract dispute with my employer. I want to review my legal options.' },
                  { icon: '💻', label: 'Code Advisor',    color: '#38bdf8', topic: 'Debugging a React useEffect issue',    intent: 'I want to review my code',             prompt: 'I need help with a coding problem: debugging a React useEffect issue. I want to review my code with an expert.' },
                  { icon: '✍️', label: 'Post Advisor',    color: '#fb923c', topic: 'Launching my new product on LinkedIn', intent: 'I want to review my post draft',        prompt: 'I need help writing a post about launching my new product on LinkedIn. I want to review my post draft.' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setNewRequest(item.prompt)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                      padding: '16px', background: 'var(--white)', border: '1px solid var(--gray-200)',
                      borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <span style={{ fontSize: 24 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 2, lineHeight: 1.4 }}>{item.topic}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3, lineHeight: 1.4, fontStyle: 'italic' }}>{item.intent}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {activeTask.serviceProviderId ? `Chat with ${activeTask.serviceProviderId.name}` : 'Finding Expert...'}
                </div>
                <div className="text-sm text-gray truncate" style={{ maxWidth: 400 }}>
                  {activeTask.description}
                </div>
              </div>
              <span className={`badge ${statusColor[activeTask.status] || 'badge-gray'}`}>
                {activeTask.status}
              </span>
              {activeTask.status === 'completed' && activeTask.paymentStatus !== 'paid' && (
                <button className="btn btn-success btn-sm" onClick={() => setShowPayment(true)}>
                  Pay ${(activeTask.price || activeTask.amount || 0).toFixed(2)}
                </button>
              )}
              {activeTask.paymentStatus === 'paid' && (
                <span className="badge badge-success">Paid ✓</span>
              )}
            </div>

            {/* Provider Profile */}
            {activeTask.serviceProviderId && (
              <div style={{ padding: '0 16px', paddingTop: 12 }}>
                <ProviderProfile provider={activeTask.serviceProviderId} />
              </div>
            )}

            {/* Status message */}
            {statusMsg && (
              <div style={{ padding: '0 16px' }}>
                <div className="alert alert-success">{statusMsg}</div>
              </div>
            )}

            {/* Notifying state */}
            {activeTask.status === 'notifying' && (
              <div style={{ padding: '0 16px' }}>
                <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="spinner" style={{ width: 16, height: 16, border: '2px solid #c7d2fe', borderTopColor: 'var(--primary)' }} />
                  Searching for available experts... (up to 2 minutes)
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
              {loadingMessages ? (
                <div className="loading-center"><div className="spinner" /></div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg._id} message={msg} myId={user._id} />
                ))
              )}
              {typingUser && (
                <div className="text-xs text-gray" style={{ padding: '4px 8px' }}>
                  {typingUser} is typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {['assigned', 'in_progress'].includes(activeTask.status) && (
              <>
                {activeTask.price > 0 && (
                  <div style={{ padding: '8px 20px', background: 'var(--gray-100)', borderTop: '1px solid var(--gray-200)', fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>💰</span>
                    <span>Agreed price: <strong style={{ color: 'var(--success)' }}>${activeTask.price.toFixed(2)}</strong></span>
                    <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>· Please share your full task details below</span>
                  </div>
                )}
                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <input
                    className="chat-input"
                    value={inputText}
                    onChange={handleTyping}
                    placeholder="Share your task details..."
                    autoFocus
                  />
                  <button className="btn btn-primary" type="submit" disabled={!inputText.trim()}>
                    Send
                  </button>
                </form>
              </>
            )}

            {/* Provider requested completion — customer approves */}
            {activeTask.status === 'pending_completion' && (
              <div style={{ padding: 16, background: '#1e2a1e', borderTop: '1px solid #166534', textAlign: 'center' }}>
                <p style={{ marginBottom: 4, color: '#34d399', fontWeight: 600 }}>🏁 Expert has marked the work as done</p>
                <p style={{ marginBottom: 12, color: '#6ee7b7', fontSize: 13 }}>
                  Amount due: <strong>${(activeTask.price || 0).toFixed(2)}</strong>
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#94a3b8' }}>
                    Dispute
                  </button>
                  <button className="btn btn-success" onClick={approveCompletion} disabled={approvingCompletion}>
                    {approvingCompletion ? 'Approving…' : '✅ Approve & Proceed to Payment'}
                  </button>
                </div>
              </div>
            )}

            {activeTask.status === 'completed' && activeTask.paymentStatus !== 'paid' && (
              <div style={{ padding: 16, background: '#022c22', borderTop: '1px solid #064e3b', textAlign: 'center' }}>
                <p style={{ marginBottom: 10, color: '#34d399' }}>Task completed! Please make payment of <strong>${(activeTask.price || activeTask.amount || 0).toFixed(2)}</strong> to close this session.</p>
                <button className="btn btn-success" onClick={() => setShowPayment(true)}>
                  Complete Payment
                </button>
              </div>
            )}

            {activeTask.paymentStatus === 'paid' && (
              <div style={{ padding: 16, background: '#022c22', borderTop: '1px solid #064e3b', textAlign: 'center', color: '#34d399' }}>
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
