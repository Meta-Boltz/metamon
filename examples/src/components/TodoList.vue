<!-- Vue TodoList Component for MTM Integration -->
<template>
  <div class="todo-list">
    <header class="todo-header">
      <h3>Vue Todo List</h3>
      <p class="todo-stats">
        {{ completedCount }} of {{ todos.length }} completed
      </p>
    </header>

    <form @submit.prevent="addTodo" class="add-todo-form">
      <input
        v-model="newTodoText"
        type="text"
        placeholder="Add a new todo..."
        class="todo-input"
        required
      />
      <button type="submit" class="add-btn" :disabled="!newTodoText.trim()">
        Add
      </button>
    </form>

    <div class="todo-filters">
      <button
        v-for="filter in filters"
        :key="filter.key"
        @click="currentFilter = filter.key"
        :class="['filter-btn', { active: currentFilter === filter.key }]"
      >
        {{ filter.label }}
      </button>
    </div>

    <ul class="todo-items">
      <li
        v-for="todo in filteredTodos"
        :key="todo.id"
        :class="['todo-item', { completed: todo.completed }]"
      >
        <input
          type="checkbox"
          v-model="todo.completed"
          class="todo-checkbox"
        />
        <span class="todo-text">{{ todo.text }}</span>
        <button
          @click="removeTodo(todo.id)"
          class="remove-btn"
          aria-label="Remove todo"
        >
          ×
        </button>
      </li>
    </ul>

    <div v-if="filteredTodos.length === 0" class="empty-state">
      <p>{{ emptyMessage }}</p>
    </div>

    <footer class="todo-footer" v-if="todos.length > 0">
      <button
        @click="clearCompleted"
        class="clear-btn"
        :disabled="completedCount === 0"
      >
        Clear Completed ({{ completedCount }})
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface Props {
  initialTodos?: Todo[];
  onTodosChange?: (todos: Todo[]) => void;
}

const props = withDefaults(defineProps<Props>(), {
  initialTodos: () => []
});

const emit = defineEmits<{
  todosChange: [todos: Todo[]];
}>();

// Reactive state
const todos = ref<Todo[]>([
  { id: 1, text: 'Learn Vue 3 Composition API', completed: true, createdAt: new Date() },
  { id: 2, text: 'Integrate with MTM framework', completed: false, createdAt: new Date() },
  { id: 3, text: 'Build awesome applications', completed: false, createdAt: new Date() }
]);

const newTodoText = ref('');
const currentFilter = ref<'all' | 'active' | 'completed'>('all');

const filters = [
  { key: 'all' as const, label: 'All' },
  { key: 'active' as const, label: 'Active' },
  { key: 'completed' as const, label: 'Completed' }
];

// Computed properties
const completedCount = computed(() => 
  todos.value.filter(todo => todo.completed).length
);

const filteredTodos = computed(() => {
  switch (currentFilter.value) {
    case 'active':
      return todos.value.filter(todo => !todo.completed);
    case 'completed':
      return todos.value.filter(todo => todo.completed);
    default:
      return todos.value;
  }
});

const emptyMessage = computed(() => {
  switch (currentFilter.value) {
    case 'active':
      return 'No active todos. Great job!';
    case 'completed':
      return 'No completed todos yet.';
    default:
      return 'No todos yet. Add one above!';
  }
});

// Methods
const addTodo = () => {
  if (newTodoText.value.trim()) {
    const newTodo: Todo = {
      id: Date.now(),
      text: newTodoText.value.trim(),
      completed: false,
      createdAt: new Date()
    };
    
    todos.value.push(newTodo);
    newTodoText.value = '';
    
    emit('todosChange', todos.value);
    if (props.onTodosChange) {
      props.onTodosChange(todos.value);
    }
  }
};

const removeTodo = (id: number) => {
  const index = todos.value.findIndex(todo => todo.id === id);
  if (index > -1) {
    todos.value.splice(index, 1);
    emit('todosChange', todos.value);
    if (props.onTodosChange) {
      props.onTodosChange(todos.value);
    }
  }
};

const clearCompleted = () => {
  todos.value = todos.value.filter(todo => !todo.completed);
  emit('todosChange', todos.value);
  if (props.onTodosChange) {
    props.onTodosChange(todos.value);
  }
};
</script>

<style scoped>
.todo-list {
  max-width: 500px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.todo-header {
  padding: 1.5rem;
  background: #667eea;
  color: white;
  text-align: center;
}

.todo-header h3 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.todo-stats {
  margin: 0;
  opacity: 0.9;
  font-size: 0.9rem;
}

.add-todo-form {
  padding: 1rem;
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #e1e5e9;
}

.todo-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.add-btn {
  padding: 0.75rem 1.5rem;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.todo-filters {
  padding: 1rem;
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #e1e5e9;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.todo-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
  gap: 0.75rem;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  opacity: 0.6;
}

.todo-checkbox {
  width: 18px;
  height: 18px;
}

.todo-text {
  flex: 1;
  font-size: 1rem;
}

.remove-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.todo-footer {
  padding: 1rem;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.clear-btn {
  padding: 0.5rem 1rem;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.clear-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>