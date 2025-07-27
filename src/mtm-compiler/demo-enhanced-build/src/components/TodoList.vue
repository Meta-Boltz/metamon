<template>
  <div class="todo-list">
    <h3>Vue Todo List</h3>
    <div class="todo-input">
      <input v-model="newTodo" @keyup.enter="addTodo" placeholder="Add todo...">
      <button @click="addTodo">Add</button>
    </div>
    <ul>
      <li v-for="todo in todos" :key="todo.id" :class="{ completed: todo.completed }">
        <input type="checkbox" v-model="todo.completed">
        <span>{{ todo.text }}</span>
        <button @click="removeTodo(todo.id)">Remove</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const newTodo = ref('');
const todos = reactive<Todo[]>([
  { id: 1, text: 'Learn MTM Framework', completed: false },
  { id: 2, text: 'Build awesome apps', completed: false }
]);

let nextId = 3;

function addTodo() {
  if (newTodo.value.trim()) {
    todos.push({
      id: nextId++,
      text: newTodo.value,
      completed: false
    });
    newTodo.value = '';
  }
}

function removeTodo(id: number) {
  const index = todos.findIndex(todo => todo.id === id);
  if (index > -1) {
    todos.splice(index, 1);
  }
}
</script>

<style scoped>
.todo-list { padding: 1rem; border: 1px solid #ddd; border-radius: 8px; }
.todo-input { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.todo-input input { flex: 1; padding: 0.5rem; }
.completed span { text-decoration: line-through; opacity: 0.6; }
</style>