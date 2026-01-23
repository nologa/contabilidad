const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('./accountability.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      target_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER,
      title TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS progress_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);
}

// API Routes

// Get all goals
app.get('/api/goals', (req, res) => {
  db.all('SELECT * FROM goals ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get a single goal
app.get('/api/goals/:id', (req, res) => {
  db.get('SELECT * FROM goals WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

// Create a new goal
app.post('/api/goals', (req, res) => {
  const { title, description, target_date } = req.body;
  db.run(
    'INSERT INTO goals (title, description, target_date) VALUES (?, ?, ?)',
    [title, description, target_date],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

// Update a goal
app.put('/api/goals/:id', (req, res) => {
  const { title, description, target_date, status } = req.body;
  db.run(
    'UPDATE goals SET title = ?, description = ?, target_date = ?, status = ? WHERE id = ?',
    [title, description, target_date, status, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ changes: this.changes });
    }
  );
});

// Delete a goal
app.delete('/api/goals/:id', (req, res) => {
  db.run('DELETE FROM goals WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Get tasks for a goal
app.get('/api/goals/:id/tasks', (req, res) => {
  db.all(
    'SELECT * FROM tasks WHERE goal_id = ? ORDER BY created_at',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Create a new task
app.post('/api/tasks', (req, res) => {
  const { goal_id, title } = req.body;
  db.run(
    'INSERT INTO tasks (goal_id, title) VALUES (?, ?)',
    [goal_id, title],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

// Toggle task completion
app.put('/api/tasks/:id/toggle', (req, res) => {
  db.get('SELECT completed FROM tasks WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const newCompleted = row.completed ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    
    db.run(
      'UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?',
      [newCompleted, completedAt, req.params.id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ changes: this.changes });
      }
    );
  });
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Get progress logs for a goal
app.get('/api/goals/:id/logs', (req, res) => {
  db.all(
    'SELECT * FROM progress_logs WHERE goal_id = ? ORDER BY created_at DESC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Create a progress log
app.post('/api/logs', (req, res) => {
  const { goal_id, note } = req.body;
  db.run(
    'INSERT INTO progress_logs (goal_id, note) VALUES (?, ?)',
    [goal_id, note],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
