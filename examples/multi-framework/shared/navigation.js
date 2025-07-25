/**
 * Shared Navigation System
 * 
 * Provides consistent navigation across all framework examples
 */

class NavigationSystem {
  constructor() {
    this.frameworks = [
      { id: 'react', name: 'React', icon: '⚛️', color: '#61dafb' },
      { id: 'vue', name: 'Vue.js', icon: '💚', color: '#4fc08d' },
      { id: 'svelte', name: 'Svelte', icon: '🧡', color: '#ff3e00' },
      { id: 'angular', name: 'Angular', icon: '🅰️', color: '#dd0031' },
      { id: 'vanilla', name: 'Vanilla JS', icon: '🟨', color: '#f7df1e' },
      { id: 'mtm', name: 'MTM Framework', icon: '🚀', color: '#6366f1' }
    ];

    this.currentFramework = this.detectCurrentFramework();
    this.init();
  }

  detectCurrentFramework() {
    const path = window.location.pathname;
    const framework = this.frameworks.find(f => path.includes(`/${f.id}/`));
    return framework ? framework.id : 'main';
  }

  init() {
    this.createNavigationHTML();
    this.attachEventListeners();
    this.updateActiveState();
  }

  createNavigationHTML() {
    const nav = document.createElement('nav');
    nav.className = 'framework-navigation';
    nav.innerHTML = `
      <div class="nav-container">
        <div class="nav-brand">
          <a href="../index.html" class="brand-link">
            <span class="brand-icon">🎯</span>
            <span class="brand-text">Multi-Framework Examples</span>
          </a>
        </div>
        
        <div class="nav-frameworks">
          ${this.frameworks.map(framework => `
            <a href="../${framework.id}/index.html" 
               class="nav-item ${this.currentFramework === framework.id ? 'active' : ''}"
               data-framework="${framework.id}"
               style="--framework-color: ${framework.color}">
              <span class="nav-icon">${framework.icon}</span>
              <span class="nav-label">${framework.name}</span>
            </a>
          `).join('')}
        </div>
        
        <div class="nav-actions">
          <button class="nav-button" id="performanceBtn">
            <span>📊</span>
            <span>Performance</span>
          </button>
          <button class="nav-button" id="sourceBtn">
            <span>📝</span>
            <span>Source</span>
          </button>
        </div>
      </div>
    `;

    // Insert at the beginning of body
    document.body.insertBefore(nav, document.body.firstChild);
  }

  attachEventListeners() {
    // Framework navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const framework = e.currentTarget.dataset.framework;
        this.navigateToFramework(framework);
      });
    });

    // Performance button
    const performanceBtn = document.getElementById('performanceBtn');
    if (performanceBtn) {
      performanceBtn.addEventListener('click', () => {
        this.showPerformanceModal();
      });
    }

    // Source button
    const sourceBtn = document.getElementById('sourceBtn');
    if (sourceBtn) {
      sourceBtn.addEventListener('click', () => {
        this.showSourceModal();
      });
    }
  }

  updateActiveState() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.framework === this.currentFramework);
    });
  }

  navigateToFramework(framework) {
    if (framework === this.currentFramework) return;

    const targetUrl = `../${framework}/index.html`;
    window.location.href = targetUrl;
  }

  showPerformanceModal() {
    // Import performance monitor and show modal
    import('./performance-monitor.js').then(module => {
      const monitor = module.default;
      monitor.showPerformanceModal();
    });
  }

  showSourceModal() {
    // Import source viewer and show modal
    import('./source-viewer.js').then(module => {
      const viewer = module.default;
      viewer.showSourceModal(this.currentFramework);
    });
  }

  // Method to add framework-specific content to the page
  addFrameworkInfo(frameworkId) {
    const framework = this.frameworks.find(f => f.id === frameworkId);
    if (!framework) return;

    const infoBar = document.createElement('div');
    infoBar.className = 'framework-info-bar';
    infoBar.innerHTML = `
      <div class="info-content">
        <span class="info-icon">${framework.icon}</span>
        <span class="info-text">
          <strong>${framework.name}</strong> Chunk Loading Examples
        </span>
        <span class="info-status">✅ All examples working</span>
      </div>
    `;

    const nav = document.querySelector('.framework-navigation');
    nav.insertAdjacentElement('afterend', infoBar);
  }
}

// Navigation styles
const navigationStyles = `
  .framework-navigation {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    min-height: 60px;
  }

  .nav-brand {
    flex-shrink: 0;
  }

  .brand-link {
    display: flex;
    align-items: center;
    gap: 10px;
    color: white;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.1rem;
  }

  .brand-icon {
    font-size: 1.5rem;
  }

  .nav-frameworks {
    display: flex;
    gap: 5px;
    flex: 1;
    justify-content: center;
    flex-wrap: wrap;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    color: white;
    text-decoration: none;
    transition: all 0.2s ease;
    font-weight: 500;
    border: 2px solid transparent;
    min-width: 120px;
    justify-content: center;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }

  .nav-item.active {
    background: var(--framework-color, #48bb78);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  .nav-icon {
    font-size: 1.2rem;
  }

  .nav-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .nav-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .framework-info-bar {
    background: linear-gradient(90deg, #48bb78, #38a169);
    color: white;
    padding: 12px 0;
    text-align: center;
  }

  .info-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    padding: 0 20px;
  }

  .info-icon {
    font-size: 1.5rem;
  }

  .info-text {
    font-size: 1.1rem;
  }

  .info-status {
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .nav-container {
      flex-direction: column;
      padding: 10px 20px;
      gap: 10px;
    }

    .nav-frameworks {
      order: 2;
      width: 100%;
    }

    .nav-actions {
      order: 3;
    }

    .nav-item {
      min-width: auto;
      flex: 1;
      font-size: 0.9rem;
    }

    .nav-label {
      display: none;
    }

    .info-content {
      flex-direction: column;
      gap: 8px;
    }
  }

  @media (max-width: 480px) {
    .brand-text {
      display: none;
    }

    .nav-frameworks {
      gap: 2px;
    }

    .nav-item {
      padding: 6px 8px;
    }
  }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = navigationStyles;
document.head.appendChild(styleSheet);

// Create and export navigation instance
const navigation = new NavigationSystem();

export default navigation;