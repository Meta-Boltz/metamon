import { createApp } from 'vue';
import VueMessageBoard from './components/VueMessageBoard.vue';

// Mount Vue component
const vueElement = document.getElementById('vue-message-board');
if (vueElement) {
  const vueApp = createApp(VueMessageBoard);
  vueApp.mount(vueElement);
}