<template>
  <div class="component-demo">
    <div class="message-input">
      <input 
        v-model="newMessage" 
        @keyup.enter="sendMessage"
        class="input" 
        placeholder="Type a message and press Enter..."
      />
      <button @click="sendMessage" class="button" :disabled="!newMessage.trim()">
        Send Message
      </button>
    </div>

    <div class="message-list">
      <div v-if="messages.length === 0" style="text-align: center; color: #666;">
        No messages yet. Send the first one!
      </div>
      <div 
        v-for="message in messages" 
        :key="message.id"
        class="message-item"
      >
        <div>
          <strong>{{ message.text }}</strong>
          <div style="font-size: 11px; color: #666;">
            {{ formatTime(message.timestamp) }}
          </div>
        </div>
        <span class="framework-indicator">{{ message.framework }}</span>
      </div>
    </div>

    <div class="message-stats">
      <small>
        Total messages: {{ messages.length }} | 
        Listening for messages from all frameworks
      </small>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { signals, pubsub } from '../shared/state.js';

const messages = ref(signals.messages.value);
const newMessage = ref('');

let unsubscribeMessages;
let unsubscribeUserActions;

onMounted(() => {
  // Subscribe to message changes
  unsubscribeMessages = signals.messages.subscribe((newMessages) => {
    messages.value = [...newMessages];
  });

  // Listen for user actions from other frameworks
  unsubscribeUserActions = pubsub.subscribe('user-action', (data) => {
    if (data.framework !== 'Vue') {
      const actionMessage = {
        id: Date.now() + Math.random(),
        text: `${data.framework} performed: ${data.action}`,
        framework: `${data.framework} → Vue`,
        timestamp: Date.now(),
        type: 'system'
      };
      
      const currentMessages = signals.messages.value;
      signals.messages.update([...currentMessages, actionMessage]);
    }
  });
});

onUnmounted(() => {
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeUserActions) unsubscribeUserActions();
});

const sendMessage = () => {
  if (!newMessage.value.trim()) return;
  
  const message = {
    id: Date.now(),
    text: newMessage.value,
    framework: 'Vue',
    timestamp: Date.now(),
    type: 'user'
  };
  
  const currentMessages = signals.messages.value;
  signals.messages.update([...currentMessages, message]);
  
  pubsub.emit('message-sent', message);
  pubsub.emit('user-action', {
    action: 'send_message',
    framework: 'Vue',
    data: { message: newMessage.value }
  });
  
  newMessage.value = '';
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};
</script>

<style scoped>
.message-input {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.message-input input {
  flex: 1;
}

.message-stats {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
  color: #666;
}
</style>