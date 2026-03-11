# ExpertConnect — Full-Stack Service Marketplace

## Architecture

```
expert-connect/
├── backend/           Node.js + Express + MongoDB + Socket.io
│   ├── server.js
│   ├── seed.js        (demo data)
│   └── src/
│       ├── config/    (DB connection)
│       ├── models/    (User, Task, Message, Payment)
│       ├── middleware/ (JWT auth, role guard)
│       ├── routes/    (auth, admin, task, chat, payment)
│       ├── services/  (AI tagging engine)
│       └── socket/    (real-time handler)
└── frontend/          React.js
    └── src/
        ├── context/   (Auth, Socket)
        ├── pages/
        │   ├── auth/       (Login, CustomerSignup, ProviderSignup)
        │   ├── customer/   (ChatPage)
        │   ├── serviceProvider/ (Dashboard)
        │   └── admin/      (AdminDashboard)
        └── components/    (Navbar, PaymentModal, ProtectedRoute)
```

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend Setup
```bash
cd backend
npm install
# Edit .env with your MongoDB URI
node seed.js        # Create demo users
npm run dev         # Start on port 5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start           # Start on port 3000
```

## Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@expertconnect.com | admin123 |
| Service Provider | lawyer@expertconnect.com | provider123 |
| Customer | customer@expertconnect.com | customer123 |

## User Flows

### Customer Flow
1. Sign up → lands on Chat page
2. Type request (e.g. "I need help with a contract dispute")
3. AI analyzes → matches domain experts → notifies them
4. Expert accepts within 2 minutes → profile appears in chat
5. Chat in real-time with the expert
6. Expert marks task complete → customer pays

### Service Provider Flow
1. Sign up with expertise & domains → awaits admin approval
2. Once approved → login → Dashboard
3. Receives popup notifications for matching tasks (2-min window)
4. Accept/Reject task
5. Chat with customer, mark task complete, set amount

### Admin Flow
1. Login → Admin Dashboard
2. See live stats (customers, providers, tasks, revenue)
3. Review and approve/reject service provider applications
4. Monitor all ongoing tasks with filters
5. Track payments

## Key Features

- **AI Task Routing** — keyword-based domain matching routes tasks to best-fit experts
- **Real-time** — Socket.io for chat, notifications, and live status updates
- **2-minute Accept Window** — first provider to accept wins the task
- **Role-based Auth** — JWT tokens, middleware guards per role
- **Payment Flow** — Stripe-ready (mock mode included for demo)
- **Admin Panel** — full visibility into all platform activity

## Environment Variables (backend/.env)
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/expert-connect
JWT_SECRET=your_secret
STRIPE_SECRET_KEY=sk_test_...   (optional for mock mode)
CLIENT_URL=http://localhost:3000
TASK_ACCEPT_WINDOW_MS=120000    (2 minutes)
```
