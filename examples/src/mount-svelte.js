import SvelteUserList from './components/SvelteUserList.svelte';

// Mount Svelte component
const svelteElement = document.getElementById('svelte-user-list');
if (svelteElement) {
  new SvelteUserList({
    target: svelteElement
  });
}