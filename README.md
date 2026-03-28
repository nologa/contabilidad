# Contabilidad - Accountability Web App

A simple and elegant personal accountability web application to help you track your goals, tasks, and progress.

## Features

- ✅ **Goal Management**: Create, update, and track your personal goals
- 📋 **Task Tracking**: Break down goals into actionable tasks
- 📝 **Progress Logging**: Keep notes on your progress over time
- 🎨 **Beautiful UI**: Modern, responsive design with a clean interface
- 💾 **Persistent Storage**: SQLite database for reliable data storage

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
```bash
git clone https://github.com/nologa/contabilidad.git
cd contabilidad
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

### Creating a Goal

1. Fill in the "Create New Goal" form with:
   - Goal Title (required)
   - Description (optional)
   - Target Date (optional)
2. Click "Create Goal"

### Managing Goals

- Click on any goal card to open the detail view
- Add tasks to break down your goal into actionable items
- Log your progress with notes
- Mark tasks as completed by checking the checkbox
- Mark the entire goal as complete or delete it

### Tasks

- Add tasks to help you achieve your goal
- Check off tasks as you complete them
- Delete tasks that are no longer relevant

### Progress Logs

- Add notes about your progress
- Track your journey towards your goal
- All logs are timestamped automatically

## Technology Stack

- **Backend**: Node.js, Express
- **Database**: SQLite3
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Styling**: Custom CSS with modern design

## API Endpoints

- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create a new goal
- `GET /api/goals/:id` - Get a specific goal
- `PUT /api/goals/:id` - Update a goal
- `DELETE /api/goals/:id` - Delete a goal
- `GET /api/goals/:id/tasks` - Get tasks for a goal
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id/toggle` - Toggle task completion
- `DELETE /api/tasks/:id` - Delete a task
- `GET /api/goals/:id/logs` - Get progress logs for a goal
- `POST /api/logs` - Create a progress log

## License

ISC
