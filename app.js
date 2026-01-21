// ===================================
// Application State
// ===================================
const state = {
    tasks: [],
    currentView: 'kanban',
    activeTimer: null,
    timeEntries: [],
    ganttZoom: 'week',
    editingTaskId: null
};

// Default columns for Kanban board
const KANBAN_COLUMNS = [
    { id: 'backlog', title: 'Backlog', color: 'hsl(0, 0%, 55%)' },
    { id: 'design', title: 'Design Phase', color: 'hsl(280, 70%, 60%)' },
    { id: 'development', title: 'Development', color: 'hsl(220, 90%, 56%)' },
    { id: 'review', title: 'Review', color: 'hsl(38, 92%, 50%)' },
    { id: 'completed', title: 'Completed', color: 'hsl(142, 71%, 45%)' }
];

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadSampleData();
});

function initializeApp() {
    // Load data from localStorage
    loadFromStorage();

    // Setup event listeners
    setupNavigationListeners();
    setupModalListeners();
    setupFormListeners();
    setupHeaderButtons();
    setupProjectCheckboxes();
    setupMobileSidebar();

    // Render initial view
    renderKanbanBoard();
    updateStats();
    restoreProjectCheckboxes();

    // Start timer update interval
    setInterval(updateActiveTimer, 1000);
}

// ===================================
// Header Buttons
// ===================================
function setupHeaderButtons() {
    const btnSave = document.getElementById('btn-save');
    const btnAddColumn = document.getElementById('btn-add-column');

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveToStorage();
            // Visual feedback
            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.3334 4L6.00008 11.3333L2.66675 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Saved!
            `;
            setTimeout(() => {
                btnSave.innerHTML = originalText;
            }, 2000);
        });
    }

    if (btnAddColumn) {
        btnAddColumn.addEventListener('click', () => {
            const title = prompt('Enter column title:');
            if (title) {
                const id = title.toLowerCase().replace(/\s+/g, '-');
                KANBAN_COLUMNS.push({
                    id: id,
                    title: title,
                    color: `hsl(${Math.random() * 360}, 70%, 60%)`
                });
                renderKanbanBoard();
                // Note: In a real app we'd need to save column config to storage too
            }
        });
    }
}

// ===================================
// Projects to Complete
// ===================================
function setupProjectCheckboxes() {
    const checkboxes = document.querySelectorAll('.projects-to-complete input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
        checkbox.addEventListener('change', () => {
            saveProjectState();
        });
    });
}

function saveProjectState() {
    const checkboxes = document.querySelectorAll('.projects-to-complete input[type="checkbox"]');
    const state = Array.from(checkboxes).map(cb => cb.checked);
    localStorage.setItem('architectpro_projects', JSON.stringify(state));
}

function restoreProjectCheckboxes() {
    const savedState = localStorage.getItem('architectpro_projects');
    if (savedState) {
        const state = JSON.parse(savedState);
        const checkboxes = document.querySelectorAll('.projects-to-complete input[type="checkbox"]');
        checkboxes.forEach((cb, index) => {
            if (state[index]) {
                cb.checked = true;
            }
        });
    }
}

function setupMobileSidebar() {
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (btnMobileMenu && sidebar && overlay) {
        btnMobileMenu.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

// ===================================
// Navigation
// ===================================
function setupNavigationListeners() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchView(view) {
    state.currentView = view;

    // Close sidebar on mobile when switching views
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }

    // Hide all views
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.remove('active');
    });

    // Show selected view
    const viewContainer = document.getElementById(`${view}-view`);
    if (viewContainer) {
        viewContainer.classList.add('active');
    }

    // Update header title
    const titles = {
        kanban: 'Kanban Board',
        gantt: 'Gantt Chart',
        timeline: 'Time Tracking'
    };
    document.getElementById('view-title').textContent = titles[view] || 'Dashboard';

    // Render the appropriate view
    switch (view) {
        case 'kanban':
            renderKanbanBoard();
            break;
        case 'gantt':
            renderGanttChart();
            break;
        case 'timeline':
            renderTimeTracking();
            break;
    }
}

// ===================================
// Kanban Board
// ===================================
function renderKanbanBoard() {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';

    KANBAN_COLUMNS.forEach(column => {
        const columnTasks = state.tasks.filter(task => task.status === column.id);
        const columnElement = createKanbanColumn(column, columnTasks);
        board.appendChild(columnElement);
    });

    setupDragAndDrop();
}

function createKanbanColumn(column, tasks) {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'kanban-column';
    columnDiv.dataset.columnId = column.id;

    columnDiv.innerHTML = `
        <div class="column-header">
            <div class="column-title">
                <span>${column.title}</span>
                <span class="column-count">${tasks.length}</span>
            </div>
        </div>
        <div class="column-tasks" data-column="${column.id}">
            ${tasks.map(task => createTaskCard(task)).join('')}
        </div>
    `;

    return columnDiv;
}

function createTaskCard(task) {
    const priorityColors = {
        low: 'low',
        medium: 'medium',
        high: 'high',
        critical: 'critical'
    };

    const tags = task.tags || [];
    const timeSpent = calculateTimeSpent(task.id);

    return `
        <div class="task-card" 
             draggable="true" 
             data-task-id="${task.id}"
             data-priority="${task.priority}">
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <span class="task-priority" data-priority="${task.priority}">${task.priority}</span>
            </div>
            ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
            ${tags.length > 0 ? `
                <div class="task-tags">
                    ${tags.map(tag => `<span class="task-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="task-footer">
                <div class="task-time">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M7 3.5V7L9.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>${timeSpent}h / ${task.estimatedHours || 0}h</span>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="startTaskTimer('${task.id}')" title="Start Timer">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M4 3L10 7L4 11V3Z" fill="currentColor"/>
                        </svg>
                    </button>
                    <button class="task-action-btn" onclick="editTask('${task.id}')" title="Edit Task">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 12h2l7-7-2-2-7 7v2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <button class="task-action-btn" onclick="deleteTask('${task.id}')" title="Delete Task">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ===================================
// Drag and Drop
// ===================================
function setupDragAndDrop() {
    const cards = document.querySelectorAll('.task-card');
    const columns = document.querySelectorAll('.column-tasks');

    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });

    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragleave', handleDragLeave);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.column-tasks').forEach(col => {
        col.style.background = '';
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.style.background = 'hsla(220, 90%, 56%, 0.1)';
    return false;
}

function handleDragLeave(e) {
    this.style.background = '';
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    this.style.background = '';

    if (draggedElement) {
        const taskId = draggedElement.dataset.taskId;
        const newStatus = this.dataset.column;

        // Update task status
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            saveToStorage();
            renderKanbanBoard();
        }
    }

    return false;
}

// ===================================
// Gantt Chart
// ===================================
function renderGanttChart() {
    const ganttChart = document.getElementById('gantt-chart');

    // Setup zoom controls
    setupGanttZoomControls();

    // Generate timeline
    const timeline = generateTimeline();
    const tasksHtml = state.tasks
        .filter(task => task.startDate && task.endDate)
        .map(task => createGanttTaskRow(task, timeline))
        .join('');

    ganttChart.innerHTML = `
        <div class="gantt-timeline">
            <div class="gantt-timeline-header">
                ${timeline.map(date => `
                    <div class="gantt-timeline-cell">${formatGanttDate(date)}</div>
                `).join('')}
            </div>
        </div>
        <div class="gantt-tasks">
            ${tasksHtml || '<p style="text-align: center; color: var(--color-text-tertiary); padding: 2rem;">No tasks with dates assigned</p>'}
        </div>
    `;
}

function setupGanttZoomControls() {
    const zoomButtons = document.querySelectorAll('.zoom-btn');
    zoomButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            zoomButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.ganttZoom = btn.dataset.zoom;
            renderGanttChart();
        });
    });
}

function generateTimeline() {
    const today = new Date();
    const timeline = [];
    const days = state.ganttZoom === 'day' ? 14 : state.ganttZoom === 'week' ? 12 : 6;

    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        if (state.ganttZoom === 'day') {
            date.setDate(today.getDate() + i);
        } else if (state.ganttZoom === 'week') {
            date.setDate(today.getDate() + (i * 7));
        } else {
            date.setMonth(today.getMonth() + i);
        }
        timeline.push(date);
    }

    return timeline;
}

function formatGanttDate(date) {
    if (state.ganttZoom === 'day') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (state.ganttZoom === 'week') {
        return `Week ${getWeekNumber(date)}`;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function createGanttTaskRow(task, timeline) {
    const startDate = new Date(task.startDate);
    const endDate = new Date(task.endDate);
    const totalDays = timeline.length;

    // Calculate position and width
    const timelineStart = timeline[0];
    const timelineEnd = timeline[timeline.length - 1];

    const totalRange = timelineEnd - timelineStart;
    const taskStart = startDate - timelineStart;
    const taskDuration = endDate - startDate;

    const leftPercent = (taskStart / totalRange) * 100;
    const widthPercent = (taskDuration / totalRange) * 100;

    return `
        <div class="gantt-task-row">
            <div class="gantt-task-label">${escapeHtml(task.title)}</div>
            <div class="gantt-task-timeline">
                <div class="gantt-task-bar" 
                     style="left: ${Math.max(0, leftPercent)}%; width: ${Math.min(100 - leftPercent, widthPercent)}%;"
                     title="${task.title}: ${formatDate(startDate)} - ${formatDate(endDate)}">
                    ${task.title.length < 20 ? escapeHtml(task.title) : ''}
                </div>
            </div>
        </div>
    `;
}

// ===================================
// Time Tracking
// ===================================
function renderTimeTracking() {
    const entriesContainer = document.getElementById('entries-container');

    if (state.timeEntries.length === 0) {
        entriesContainer.innerHTML = '<p style="text-align: center; color: var(--color-text-tertiary); padding: 2rem;">No time entries yet. Start a timer from a task!</p>';
        return;
    }

    const entriesHtml = state.timeEntries
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .map(entry => {
            const task = state.tasks.find(t => t.id === entry.taskId);
            const duration = entry.endTime
                ? (new Date(entry.endTime) - new Date(entry.startTime)) / 1000 / 60 / 60
                : 0;

            return `
                <div class="time-entry">
                    <div class="time-entry-header">
                        <div class="time-entry-task">${task ? escapeHtml(task.title) : 'Unknown Task'}</div>
                        <div class="time-entry-duration">${duration.toFixed(2)}h</div>
                    </div>
                    <div class="time-entry-date">${formatDateTime(new Date(entry.startTime))}</div>
                </div>
            `;
        })
        .join('');

    entriesContainer.innerHTML = entriesHtml;
}

function startTaskTimer(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Stop existing timer if any
    if (state.activeTimer) {
        stopTaskTimer();
    }

    state.activeTimer = {
        taskId: taskId,
        startTime: new Date().toISOString(),
        elapsed: 0
    };

    document.getElementById('active-timer-task').textContent = task.title;
    document.getElementById('btn-stop-timer').disabled = false;

    saveToStorage();
}

function stopTaskTimer() {
    if (!state.activeTimer) return;

    const entry = {
        id: generateId(),
        taskId: state.activeTimer.taskId,
        startTime: state.activeTimer.startTime,
        endTime: new Date().toISOString()
    };

    state.timeEntries.push(entry);
    state.activeTimer = null;

    document.getElementById('active-timer-task').textContent = 'No active task';
    document.getElementById('active-timer-display').textContent = '00:00:00';
    document.getElementById('btn-stop-timer').disabled = true;

    saveToStorage();
    updateStats();

    if (state.currentView === 'timeline') {
        renderTimeTracking();
    }
}

function updateActiveTimer() {
    if (!state.activeTimer) return;

    const startTime = new Date(state.activeTimer.startTime);
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);

    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('active-timer-display').textContent = display;
}

function calculateTimeSpent(taskId) {
    const entries = state.timeEntries.filter(e => e.taskId === taskId);
    const total = entries.reduce((sum, entry) => {
        if (entry.endTime) {
            const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / 1000 / 60 / 60;
            return sum + duration;
        }
        return sum;
    }, 0);

    return total.toFixed(1);
}

// ===================================
// Modal & Forms
// ===================================
function setupModalListeners() {
    const modal = document.getElementById('task-modal');
    const btnAddTask = document.getElementById('btn-add-task');
    const btnClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel');
    const overlay = modal ? modal.querySelector('.modal-overlay') : null;
    const btnStopTimer = document.getElementById('btn-stop-timer');

    if (btnAddTask) btnAddTask.addEventListener('click', () => openTaskModal());
    if (btnClose) btnClose.addEventListener('click', () => closeTaskModal());
    if (btnCancel) btnCancel.addEventListener('click', () => closeTaskModal());
    if (overlay) overlay.addEventListener('click', () => closeTaskModal());
    if (btnStopTimer) btnStopTimer.addEventListener('click', () => stopTaskTimer());
}

function setupFormListeners() {
    const form = document.getElementById('task-form');
    form.addEventListener('submit', handleTaskSubmit);
}

function openTaskModal(taskId = null) {
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');

    state.editingTaskId = taskId;

    if (taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('modal-title').textContent = 'Edit Task';
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-description').value = task.description || '';
            document.getElementById('task-status').value = task.status;
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-start-date').value = task.startDate || '';
            document.getElementById('task-end-date').value = task.endDate || '';
            document.getElementById('task-estimated-hours').value = task.estimatedHours || '';
            document.getElementById('task-tags').value = (task.tags || []).join(', ');
        }
    } else {
        document.getElementById('modal-title').textContent = 'Add New Task';
        form.reset();
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        document.getElementById('task-start-date').value = today;
        document.getElementById('task-end-date').value = nextWeek;
    }

    modal.classList.add('active');
}

function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    modal.classList.remove('active');
    state.editingTaskId = null;
}

function handleTaskSubmit(e) {
    e.preventDefault();

    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        status: document.getElementById('task-status').value,
        priority: document.getElementById('task-priority').value,
        startDate: document.getElementById('task-start-date').value,
        endDate: document.getElementById('task-end-date').value,
        estimatedHours: parseFloat(document.getElementById('task-estimated-hours').value) || 0,
        tags: document.getElementById('task-tags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
    };

    if (state.editingTaskId) {
        // Update existing task
        const task = state.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
            Object.assign(task, taskData);
        }
    } else {
        // Create new task
        const newTask = {
            id: generateId(),
            ...taskData,
            createdAt: new Date().toISOString()
        };
        state.tasks.push(newTask);
    }

    saveToStorage();
    closeTaskModal();
    renderKanbanBoard();
    updateStats();

    if (state.currentView === 'gantt') {
        renderGanttChart();
    }
}

function editTask(taskId) {
    openTaskModal(taskId);
}

function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        state.timeEntries = state.timeEntries.filter(e => e.taskId !== taskId);
        saveToStorage();
        renderKanbanBoard();
        updateStats();
    }
}

// ===================================
// Statistics
// ===================================
function updateStats() {
    const activeTasks = state.tasks.filter(t => t.status !== 'completed').length;
    const totalHours = state.timeEntries.reduce((sum, entry) => {
        if (entry.endTime) {
            const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / 1000 / 60 / 60;
            return sum + duration;
        }
        return sum;
    }, 0);

    document.getElementById('active-tasks-count').textContent = activeTasks;
    document.getElementById('total-hours').textContent = `${totalHours.toFixed(1)}h`;
}

// ===================================
// Storage
// ===================================
function saveToStorage() {
    localStorage.setItem('architectpro_tasks', JSON.stringify(state.tasks));
    localStorage.setItem('architectpro_timeEntries', JSON.stringify(state.timeEntries));
    localStorage.setItem('architectpro_activeTimer', JSON.stringify(state.activeTimer));
}

function loadFromStorage() {
    const tasks = localStorage.getItem('architectpro_tasks');
    const timeEntries = localStorage.getItem('architectpro_timeEntries');
    const activeTimer = localStorage.getItem('architectpro_activeTimer');

    if (tasks) state.tasks = JSON.parse(tasks);
    if (timeEntries) state.timeEntries = JSON.parse(timeEntries);
    if (activeTimer) state.activeTimer = JSON.parse(activeTimer);

    // Restore active timer UI if exists
    if (state.activeTimer) {
        const task = state.tasks.find(t => t.id === state.activeTimer.taskId);
        if (task) {
            const timerTaskElem = document.getElementById('active-timer-task');
            const stopTimerBtn = document.getElementById('btn-stop-timer');
            if (timerTaskElem) timerTaskElem.textContent = task.title;
            if (stopTimerBtn) stopTimerBtn.disabled = false;
        }
    }
}

// ===================================
// Sample Data
// ===================================
function loadSampleData() {
    if (state.tasks.length === 0) {
        state.tasks = [
            {
                id: generateId(),
                title: 'Initial Site Analysis',
                description: 'Conduct comprehensive site analysis including topography, climate, and zoning regulations',
                status: 'completed',
                priority: 'high',
                startDate: '2025-11-01',
                endDate: '2025-11-15',
                estimatedHours: 40,
                tags: ['Research', 'Site Analysis'],
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'Conceptual Design Development',
                description: 'Create initial design concepts and sketches based on client requirements',
                status: 'design',
                priority: 'critical',
                startDate: '2025-11-16',
                endDate: '2025-12-05',
                estimatedHours: 80,
                tags: ['Design', 'Concept'],
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'Structural Engineering Coordination',
                description: 'Coordinate with structural engineers for load calculations and foundation design',
                status: 'development',
                priority: 'high',
                startDate: '2025-11-20',
                endDate: '2025-12-10',
                estimatedHours: 60,
                tags: ['Engineering', 'Coordination'],
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: '3D Visualization & Rendering',
                description: 'Create photorealistic 3D renderings for client presentation',
                status: 'development',
                priority: 'medium',
                startDate: '2025-11-25',
                endDate: '2025-12-15',
                estimatedHours: 50,
                tags: ['Visualization', '3D'],
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'Building Permit Documentation',
                description: 'Prepare complete documentation package for building permit submission',
                status: 'review',
                priority: 'high',
                startDate: '2025-12-01',
                endDate: '2025-12-20',
                estimatedHours: 70,
                tags: ['Documentation', 'Permits'],
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'MEP Systems Design',
                description: 'Design mechanical, electrical, and plumbing systems',
                status: 'backlog',
                priority: 'medium',
                startDate: '2025-12-10',
                endDate: '2026-01-10',
                estimatedHours: 90,
                tags: ['MEP', 'Engineering'],
                createdAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'Interior Design Specifications',
                description: 'Develop detailed interior design specifications and material selections',
                status: 'backlog',
                priority: 'low',
                startDate: '2025-12-15',
                endDate: '2026-01-20',
                estimatedHours: 45,
                tags: ['Interior', 'Design'],
                createdAt: new Date().toISOString()
            }
        ];

        saveToStorage();
        renderKanbanBoard();
        updateStats();
    }
}

// ===================================
// Utility Functions
// ===================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDateTime(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Make functions globally accessible for inline event handlers
window.startTaskTimer = startTaskTimer;
window.editTask = editTask;
window.deleteTask = deleteTask;
