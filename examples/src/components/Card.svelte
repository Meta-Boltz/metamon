<!-- Svelte Card Component for MTM Integration -->
<script>
  export let title = '';
  export let className = '';
  export let variant = 'default';
  
  $: cardClasses = `card card--${variant} ${className}`.trim();
</script>

<div class={cardClasses}>
  {#if title}
    <header class="card__header">
      <h3 class="card__title">{title}</h3>
    </header>
  {/if}
  
  <div class="card__content">
    <slot></slot>
  </div>
</div>

<style>
  .card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    margin-bottom: 1rem;
  }
  
  .card--default {
    border: 1px solid #e1e5e9;
  }
  
  .card--primary {
    border: 1px solid #667eea;
    border-top: 4px solid #667eea;
  }
  
  .card--success {
    border: 1px solid #27ae60;
    border-top: 4px solid #27ae60;
  }
  
  .card__header {
    padding: 1rem 1.5rem 0;
  }
  
  .card__title {
    margin: 0;
    color: #2c3e50;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .card__content {
    padding: 1rem 1.5rem 1.5rem;
  }
  
  .card__content :global(p:first-child) {
    margin-top: 0;
  }
  
  .card__content :global(p:last-child) {
    margin-bottom: 0;
  }
</style>