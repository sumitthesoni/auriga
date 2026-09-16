# Helpdesk Ticket Management System - Frontend

An interactive support operations console built with React, Vite, Tailwind CSS, and Lucide Icons, designed to connect to the FastAPI Helpdesk backend.

## Project Structure

```text
frontend/
├── .env.example
├── index.html
├── package.json
├── README.md
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── api/
    │   └── client.js
    ├── context/
    │   ├── AuthContext.jsx
    │   └── ToastContext.jsx
    ├── components/
    │   ├── AssigneeSelect.jsx
    │   ├── AuthGuard.jsx
    │   ├── CreateTicketModal.jsx
    │   ├── EditTicketModal.jsx
    │   ├── Layout.jsx
    │   ├── OverdueBadge.jsx
    │   ├── Pagination.jsx
    │   ├── TicketCardList.jsx
    │   ├── TicketPriorityBadge.jsx
    │   ├── TicketStatusBadge.jsx
    │   └── TicketTable.jsx
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── LoginPage.jsx
    │   ├── TicketDetailsPage.jsx
    │   └── TicketQueuePage.jsx
    └── styles/
        └── index.css
```

## Getting Started

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default backend target:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
The frontend will start at **http://localhost:5173**.

### 4. Build for Production
```bash
npm run build
```

### 5. Preview Production Build
```bash
npm run preview
```

## Backend API Specification

The frontend connects to the FastAPI backend running at `http://localhost:8000`:
- `GET /api/health` - Health check
- `POST /api/auth/login` - Email authentication (stores JWT in `localStorage`)
- `GET /api/users` - Staff user list for ticket assignment
- `GET /api/tickets/stats` - Operational metrics (open, overdue, urgent, unassigned)
- `GET /api/tickets` - Paginated ticket queue with search and filtering
- `GET /api/tickets/{id}` - Individual ticket details
- `POST /api/tickets` - Create new ticket
- `PATCH /api/tickets/{id}` - Edit title, description, priority, and status
- `POST /api/tickets/{id}/assign` - Assign or unassign operator
