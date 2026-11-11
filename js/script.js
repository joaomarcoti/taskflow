"use strict";

const STORAGE_KEY = "taskflow-tasks";
const PRIORITIES = {
  high: { label: "Alta", className: "priority-high" },
  medium: { label: "Média", className: "priority-medium" },
  low: { label: "Baixa", className: "priority-low" }
};

const elements = {
  taskList: document.querySelector("#task-list"),
  dialog: document.querySelector("#task-dialog"),
  form: document.querySelector("#task-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  titleInput: document.querySelector("#task-title"),
  descriptionInput: document.querySelector("#task-description"),
  categoryInput: document.querySelector("#task-category"),
  priorityInput: document.querySelector("#task-priority"),
  dueDateInput: document.querySelector("#task-due-date"),
  priorityFilter: document.querySelector("#priority-filter"),
  statusMessage: document.querySelector("#status-message"),
  addButton: document.querySelector("#add-task-button"),
  closeButton: document.querySelector("#close-dialog-button"),
  cancelButton: document.querySelector("#cancel-dialog-button"),
  saveButton: document.querySelector("#save-task-button"),
  todayLabel: document.querySelector("#today-label"),
  totalCount: document.querySelector("#total-count"),
  doneCount: document.querySelector("#done-count"),
  pendingSummaryCount: document.querySelector("#pending-summary-count"),
  allCount: document.querySelector("#all-count"),
  pendingCount: document.querySelector("#pending-count"),
  completedCount: document.querySelector("#completed-count")
};

let tasks = loadTasks();
let activeFilter = "all";
let editingTaskId = null;
let announcementTimeout;

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    if (!savedTasks) return [];

    const parsedTasks = JSON.parse(savedTasks);
    if (!Array.isArray(parsedTasks)) throw new TypeError("Saved tasks must be an array.");
    return parsedTasks.filter(isValidTask);
  } catch (error) {
    console.error("Could not load saved TaskFlow data:", error);
    window.addEventListener("DOMContentLoaded", () => {
      announce("Não foi possível ler suas tarefas salvas. Os dados existentes não foram removidos.");
    }, { once: true });
    return [];
  }
}

function isValidTask(task) {
  const validDueDate = task && typeof task.dueDate === "string"
    && (task.dueDate === "" || isValidDateString(task.dueDate));
  return task !== null
    && typeof task === "object"
    && typeof task.id === "string"
    && typeof task.title === "string"
    && typeof task.description === "string"
    && typeof task.category === "string"
    && Object.prototype.hasOwnProperty.call(PRIORITIES, task.priority)
    && typeof task.completed === "boolean"
    && validDueDate;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function saveTasks(nextTasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
  } catch (error) {
    console.error("Could not save TaskFlow data:", error);
    announce("Não foi possível salvar as alterações neste navegador. Verifique o espaço disponível.");
    return false;
  }
  tasks = nextTasks;
  return true;
}

function announce(message) {
  window.clearTimeout(announcementTimeout);
  elements.statusMessage.textContent = "";
  announcementTimeout = window.setTimeout(() => {
    elements.statusMessage.textContent = message;
  }, 30);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" })
    .format(new Date(year, month - 1, day));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getVisibleTasks() {
  return tasks.filter((task) => {
    const matchesStatus = activeFilter === "all"
      || (activeFilter === "pending" && !task.completed)
      || (activeFilter === "completed" && task.completed);
    const matchesPriority = elements.priorityFilter.value === "all"
      || task.priority === elements.priorityFilter.value;
    return matchesStatus && matchesPriority;
  });
}

function renderTask(task) {
  const priority = PRIORITIES[task.priority];
  const overdue = task.dueDate && task.dueDate < getLocalDateString() && !task.completed;
  const dueDateMarkup = task.dueDate
    ? `<span class="task-due${overdue ? " is-overdue" : ""}">${overdue ? "Atrasada · " : "Vence · "}${escapeHTML(formatDueDate(task.dueDate))}</span>`
    : "";
  const descriptionMarkup = task.description
    ? `<p class="task-description">${escapeHTML(task.description)}</p>`
    : "";

  return `
    <article class="task-card${task.completed ? " is-completed" : ""}" data-task-id="${escapeHTML(task.id)}">
      <button class="task-check" type="button" data-action="toggle" aria-pressed="${task.completed}" aria-label="${task.completed ? "Marcar como pendente" : "Marcar como concluída"}: ${escapeHTML(task.title)}">
        ${task.completed ? '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8 3 3 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ""}
      </button>
      <div class="task-main">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        ${descriptionMarkup}
        <div class="task-meta">
          <span class="task-tag">${escapeHTML(task.category)}</span>
          <span class="priority-badge ${priority.className}">Prioridade ${priority.label}</span>
          ${dueDateMarkup}
        </div>
      </div>
      <div class="task-actions" aria-label="Ações da tarefa">
        <button class="icon-button" type="button" data-action="edit" aria-label="Editar tarefa: ${escapeHTML(task.title)}" title="Editar">✎</button>
        <button class="icon-button delete-button" type="button" data-action="delete" aria-label="Excluir tarefa: ${escapeHTML(task.title)}" title="Excluir">⌫</button>
      </div>
    </article>
  `;
}

function renderEmptyState() {
  if (tasks.length === 0) {
    return `
      <div class="empty-state">
        <span class="empty-illustration" aria-hidden="true">✦</span>
        <h3>Sua lista começa aqui</h3>
        <p>Adicione uma tarefa e transforme seus planos em ação.</p>
        <button class="button button-primary" type="button" data-action="add">+ Criar primeira tarefa</button>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <span class="empty-illustration" aria-hidden="true">✓</span>
      <h3>Nenhuma tarefa por aqui</h3>
      <p>Tente mudar os filtros para ver outras tarefas.</p>
    </div>
  `;
}

function render() {
  const pendingTasks = tasks.filter((task) => !task.completed).length;
  const completedTasks = tasks.length - pendingTasks;
  const visibleTasks = getVisibleTasks();

  elements.totalCount.textContent = String(tasks.length);
  elements.doneCount.textContent = String(completedTasks);
  elements.pendingSummaryCount.textContent = String(pendingTasks);
  elements.allCount.textContent = String(tasks.length);
  elements.pendingCount.textContent = String(pendingTasks);
  elements.completedCount.textContent = String(completedTasks);
  elements.taskList.innerHTML = visibleTasks.length
    ? visibleTasks.map(renderTask).join("")
    : renderEmptyState();

  document.querySelectorAll(".filter-button").forEach((button) => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function openTaskDialog(task = null) {
  editingTaskId = task ? task.id : null;
  elements.form.reset();
  elements.dialogTitle.textContent = task ? "Editar tarefa" : "Nova tarefa";
  elements.saveButton.textContent = task ? "Salvar alterações" : "Salvar tarefa";

  if (task) {
    elements.titleInput.value = task.title;
    elements.descriptionInput.value = task.description;
    elements.categoryInput.value = task.category;
    elements.priorityInput.value = task.priority;
    elements.dueDateInput.value = task.dueDate;
  } else {
    elements.categoryInput.value = "Estudos";
    elements.priorityInput.value = "medium";
  }

  elements.dialog.showModal();
  elements.titleInput.focus();
}

function closeTaskDialog() {
  elements.dialog.close();
}

function createTaskId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function handleFormSubmit(event) {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;

  const taskData = {
    title: elements.titleInput.value.trim(),
    description: elements.descriptionInput.value.trim(),
    category: elements.categoryInput.value,
    priority: elements.priorityInput.value,
    dueDate: elements.dueDateInput.value,
    completed: false
  };

  if (!taskData.title) {
    elements.titleInput.setCustomValidity("Informe um título para a tarefa.");
    elements.titleInput.reportValidity();
    return;
  }
  elements.titleInput.setCustomValidity("");

  let nextTasks;
  let message;
  if (editingTaskId) {
    nextTasks = tasks.map((task) => task.id === editingTaskId
      ? { ...task, ...taskData, completed: task.completed }
      : task);
    message = "Tarefa atualizada.";
  } else {
    nextTasks = [{ id: createTaskId(), ...taskData }, ...tasks];
    message = "Tarefa criada.";
  }

  if (saveTasks(nextTasks)) {
    closeTaskDialog();
    render();
    announce(message);
  }
}

function handleTaskAction(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  if (actionButton.dataset.action === "add") {
    openTaskDialog();
    return;
  }

  const card = actionButton.closest("[data-task-id]");
  if (!card) return;
  const task = tasks.find((item) => item.id === card.dataset.taskId);
  if (!task) return;

  if (actionButton.dataset.action === "toggle") {
    const updated = { ...task, completed: !task.completed };
    if (saveTasks(tasks.map((item) => item.id === task.id ? updated : item))) {
      render();
      announce(updated.completed ? "Tarefa concluída." : "Tarefa marcada como pendente.");
    }
  } else if (actionButton.dataset.action === "edit") {
    openTaskDialog(task);
  } else if (actionButton.dataset.action === "delete") {
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return;
    if (saveTasks(tasks.filter((item) => item.id !== task.id))) {
      render();
      announce("Tarefa excluída.");
    }
  }
}

function initialize() {
  elements.todayLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  elements.addButton.addEventListener("click", () => openTaskDialog());
  elements.closeButton.addEventListener("click", closeTaskDialog);
  elements.cancelButton.addEventListener("click", closeTaskDialog);
  elements.form.addEventListener("submit", handleFormSubmit);
  elements.titleInput.addEventListener("input", () => elements.titleInput.setCustomValidity(""));
  elements.taskList.addEventListener("click", handleTaskAction);
  elements.priorityFilter.addEventListener("change", render);

  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      render();
    });
  });

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closeTaskDialog();
  });

  render();
}

initialize();
