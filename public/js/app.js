// API Base URL
const API_URL = '/api';

// Current goal being viewed
let currentGoal = null;

// DOM Elements
const goalForm = document.getElementById('goalForm');
const goalsContainer = document.getElementById('goalsContainer');
const modal = document.getElementById('goalModal');
const closeBtn = document.querySelector('.close');
const taskForm = document.getElementById('taskForm');
const logForm = document.getElementById('logForm');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadGoals();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    goalForm.addEventListener('submit', handleCreateGoal);
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    taskForm.addEventListener('submit', handleCreateTask);
    logForm.addEventListener('submit', handleCreateLog);
    
    document.getElementById('completeGoalBtn').addEventListener('click', handleCompleteGoal);
    document.getElementById('deleteGoalBtn').addEventListener('click', handleDeleteGoal);
}

// Load all goals
async function loadGoals() {
    try {
        const response = await fetch(`${API_URL}/goals`);
        const goals = await response.json();
        
        if (goals.length === 0) {
            goalsContainer.innerHTML = '<p class="empty-state">No goals yet. Create your first goal above!</p>';
        } else {
            goalsContainer.innerHTML = goals.map(goal => createGoalCard(goal)).join('');
            
            // Add click listeners to goal cards
            document.querySelectorAll('.goal-card').forEach(card => {
                card.addEventListener('click', () => {
                    const goalId = card.dataset.goalId;
                    openGoalModal(goalId);
                });
            });
        }
    } catch (error) {
        console.error('Error loading goals:', error);
        goalsContainer.innerHTML = '<p class="empty-state">Error loading goals. Please try again.</p>';
    }
}

// Create goal card HTML
function createGoalCard(goal) {
    const targetDate = goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'No target date';
    return `
        <div class="goal-card ${goal.status}" data-goal-id="${goal.id}">
            <h3>${escapeHtml(goal.title)}</h3>
            <p>${escapeHtml(goal.description || 'No description')}</p>
            <p><strong>Target:</strong> ${targetDate}</p>
            <span class="goal-status ${goal.status}">${goal.status}</span>
        </div>
    `;
}

// Handle create goal form submission
async function handleCreateGoal(e) {
    e.preventDefault();
    
    const goalData = {
        title: document.getElementById('goalTitle').value,
        description: document.getElementById('goalDescription').value,
        target_date: document.getElementById('goalTargetDate').value
    };
    
    try {
        const response = await fetch(`${API_URL}/goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(goalData)
        });
        
        if (response.ok) {
            goalForm.reset();
            loadGoals();
        }
    } catch (error) {
        console.error('Error creating goal:', error);
        alert('Failed to create goal. Please try again.');
    }
}

// Open goal detail modal
async function openGoalModal(goalId) {
    try {
        const response = await fetch(`${API_URL}/goals/${goalId}`);
        currentGoal = await response.json();
        
        // Update modal content
        document.getElementById('modalGoalTitle').textContent = currentGoal.title;
        document.getElementById('modalGoalDescription').textContent = currentGoal.description || 'No description';
        document.getElementById('modalGoalTarget').textContent = currentGoal.target_date 
            ? `Target: ${new Date(currentGoal.target_date).toLocaleDateString()}`
            : 'No target date';
        
        // Load tasks and logs
        await loadTasks(goalId);
        await loadLogs(goalId);
        
        // Update complete button
        const completeBtn = document.getElementById('completeGoalBtn');
        if (currentGoal.status === 'completed') {
            completeBtn.textContent = 'Mark Active';
            completeBtn.classList.remove('btn-success');
            completeBtn.classList.add('btn-primary');
        } else {
            completeBtn.textContent = 'Mark Complete';
            completeBtn.classList.remove('btn-primary');
            completeBtn.classList.add('btn-success');
        }
        
        // Show modal
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading goal:', error);
        alert('Failed to load goal details. Please try again.');
    }
}

// Load tasks for a goal
async function loadTasks(goalId) {
    try {
        const response = await fetch(`${API_URL}/goals/${goalId}/tasks`);
        const tasks = await response.json();
        
        const tasksList = document.getElementById('tasksList');
        if (tasks.length === 0) {
            tasksList.innerHTML = '<li style="opacity: 0.5;">No tasks yet</li>';
        } else {
            tasksList.innerHTML = tasks.map(task => `
                <li class="${task.completed ? 'completed' : ''}">
                    <input type="checkbox" 
                           class="task-checkbox" 
                           ${task.completed ? 'checked' : ''}
                           onchange="toggleTask(${task.id})">
                    <span class="task-text">${escapeHtml(task.title)}</span>
                    <button class="task-delete" onclick="deleteTask(${task.id})">Delete</button>
                </li>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Load progress logs for a goal
async function loadLogs(goalId) {
    try {
        const response = await fetch(`${API_URL}/goals/${goalId}/logs`);
        const logs = await response.json();
        
        const logsList = document.getElementById('logsList');
        if (logs.length === 0) {
            logsList.innerHTML = '<li style="opacity: 0.5;">No progress logs yet</li>';
        } else {
            logsList.innerHTML = logs.map(log => `
                <li>
                    <div>${escapeHtml(log.note)}</div>
                    <div class="log-date">${new Date(log.created_at).toLocaleString()}</div>
                </li>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

// Handle create task
async function handleCreateTask(e) {
    e.preventDefault();
    
    const taskData = {
        goal_id: currentGoal.id,
        title: document.getElementById('taskTitle').value
    };
    
    try {
        const response = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            document.getElementById('taskTitle').value = '';
            await loadTasks(currentGoal.id);
        }
    } catch (error) {
        console.error('Error creating task:', error);
        alert('Failed to create task. Please try again.');
    }
}

// Toggle task completion
async function toggleTask(taskId) {
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}/toggle`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            await loadTasks(currentGoal.id);
        }
    } catch (error) {
        console.error('Error toggling task:', error);
        alert('Failed to update task. Please try again.');
    }
}

// Delete task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadTasks(currentGoal.id);
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
    }
}

// Handle create log
async function handleCreateLog(e) {
    e.preventDefault();
    
    const logData = {
        goal_id: currentGoal.id,
        note: document.getElementById('logNote').value
    };
    
    try {
        const response = await fetch(`${API_URL}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData)
        });
        
        if (response.ok) {
            document.getElementById('logNote').value = '';
            await loadLogs(currentGoal.id);
        }
    } catch (error) {
        console.error('Error creating log:', error);
        alert('Failed to create log. Please try again.');
    }
}

// Handle complete/activate goal
async function handleCompleteGoal() {
    const newStatus = currentGoal.status === 'completed' ? 'active' : 'completed';
    
    try {
        const response = await fetch(`${API_URL}/goals/${currentGoal.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: currentGoal.title,
                description: currentGoal.description,
                target_date: currentGoal.target_date,
                status: newStatus
            })
        });
        
        if (response.ok) {
            closeModal();
            loadGoals();
        }
    } catch (error) {
        console.error('Error updating goal:', error);
        alert('Failed to update goal. Please try again.');
    }
}

// Handle delete goal
async function handleDeleteGoal() {
    if (!confirm('Are you sure you want to delete this goal? This will also delete all tasks and logs associated with it.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/goals/${currentGoal.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeModal();
            loadGoals();
        }
    } catch (error) {
        console.error('Error deleting goal:', error);
        alert('Failed to delete goal. Please try again.');
    }
}

// Close modal
function closeModal() {
    modal.style.display = 'none';
    currentGoal = null;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
