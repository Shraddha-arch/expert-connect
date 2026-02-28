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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontWeight: 600 }}>Select a request or create a new one</div>
            <div className="text-sm">Describe your issue and we'll match you with the best expert</div>
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
