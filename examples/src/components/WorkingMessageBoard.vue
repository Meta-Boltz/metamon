<template>
  <div class="component-demo">
    <h3>🚀 Ultra-Modern MTM Message Board (Vue)</h3>
    
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
    
    <div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 6px; font-size: 12px;">
      <strong>🎯 Ultra-Modern MTM Features:</strong><br/>
      ✅ No frontmatter - framework detected from filename<br/>
      ✅ Unified signal system - single system for everything<br/>
      ✅ Clean template syntax - Vue-like binding<br/>
      ✅ Reactive variables with $ prefix and ! suffix
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import signal from '../shared/ultra-modern-signal.js';

// Ultra-modern MTM: $messages! = signal('messages', [])
const messagesSignal = signal.signal('messages', []);
const messages = ref(messagesSignal.value);

// Ultra-modern MTM: $newMessage! = ''
const newMessage = ref('');

// Subscribe to messages changes
let unsubscribeMessages;
onMounted(() => {
  unsubscribeMessages = messagesSignal.subscribe((newMessages) => {
    messages.value = newMessages;
  });
});

onUnmounted(() => {
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
});

// Listen for user actions from other frameworks
const unsubscribeUserAction = signal.on('user-action', (data) => {
  if (data.framework !== 'Vue') {
    const actionMessage = {
      id: Date.now() + Math.random(),
      text: `${data.framework} performed: ${data.action}`,
      framework: `${data.framework} → Vue`,
      timestamp: Date.now(),
      type: 'system'
    };
    messagesSignal.value = [...messagesSignal.value, actionMessage];
  }
});

// Ultra-modern MTM: $sendMessage = () => { ... }
const sendMessage = () => {
  if (!newMessage.value.trim()) return;
  
  const message = {
    id: Date.now(),
    text: newMessage.value,
    framework: 'Vue',
    timestamp: Date.now(),
    type: 'user'
  };
  
  messagesSignal.value = [...messagesSignal.value, message];
  
  signal.emit('message-sent', message);
  signal.emit('user-action', {
    action: 'send_message',
    framework: 'Vue',
    data: { message: newMessage.value }
  });
  
  newMessage.value = '';
};

// Ultra-modern MTM: $formatTime = ($timestamp: number) => { ... }
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};

onUnmounted(() => {
  unsubscribeUserAction();
});
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

.message-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.message-item:last-child {
  border-bottom: none;
}

.framework-indicator {
  font-size: 12px;
  color: #666;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>