import React, { useState } from 'react';
import api from '../services/api';

export default function PaymentModal({ task, onClose, onPaid }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState(task.amount || '');

  const handlePay = async () => {
    if (!amount || parseFloat(amount) <= 0) return setError('Please enter a valid amount.');
    setLoading(true);
    setError('');
    try {
      // Create payment intent
      const { data: intentData } = await api.post('/payment/create-intent', {
        taskId: task._id,
      });

      // Confirm payment (mock flow — real Stripe would use Elements)
      await api.post('/payment/confirm', { paymentId: intentData.paymentId });

      onPaid();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">💳 Complete Payment</div>

        <div style={{ marginBottom: 16, color: 'var(--gray-600)', fontSize: 14 }}>
          <strong>Task:</strong> {task.description?.slice(0, 80)}...
        </div>

        {task.amount > 0 ? (
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)', marginBottom: 16 }}>
            ${task.amount.toFixed(2)} USD
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Amount (USD)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
          Demo mode: Payment will be simulated. In production, integrate Stripe Elements.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" style={{ flex: 1 }} onClick={handlePay} disabled={loading}>
            {loading ? 'Processing...' : `Pay $${parseFloat(amount || task.amount || 0).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
