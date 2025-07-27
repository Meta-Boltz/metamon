// Svelte example page - Demonstrates Svelte component integration
export default function SvelteExamplePage() {
  // Define functions in global scope
  setTimeout(() => {
    const weatherData = {
      'new-york': { temp: '22°C', condition: 'Partly Cloudy', humidity: '65%', wind: '12 km/h' },
      'london': { temp: '15°C', condition: 'Rainy', humidity: '80%', wind: '8 km/h' },
      'tokyo': { temp: '28°C', condition: 'Sunny', humidity: '55%', wind: '6 km/h' },
      'sydney': { temp: '25°C', condition: 'Clear', humidity: '60%', wind: '10 km/h' }
    };

    window.cardAction = function (type) {
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} card action triggered!`);
    };

    window.updateWeather = function () {
      const location = document.getElementById('location-select').value;
      const data = weatherData[location];

      document.getElementById('temperature').textContent = data.temp;
      document.getElementById('condition').textContent = data.condition;
      document.getElementById('humidity').textContent = data.humidity;
      document.getElementById('wind').textContent = data.wind;
    };
  }, 50);

  return `
    <div class="svelte-example-page">
      <header class="page-header">
        <div class="breadcrumb">
          <a href="/" class="breadcrumb-link">Home</a>
          <span class="breadcrumb-separator">→</span>
          <span class="breadcrumb-current">Svelte Example</span>
        </div>
        
        <h1>Svelte Component Integration</h1>
        <p class="page-description">This page demonstrates Svelte components working within the Enhanced MTM Framework</p>
      </header>
      
      <nav class="framework-nav">
        <a href="/mtm-example" class="framework-link mtm">MTM Example</a>
        <a href="/react-example" class="framework-link react">React Example</a>
        <a href="/vue-example" class="framework-link vue">Vue Example</a>
        <a href="/solid-example" class="framework-link solid">Solid Example</a>
        <a href="/about" class="framework-link about">About</a>
      </nav>
      
      <main class="main-content">
        <section class="component-demo">
          <h2>Svelte Components</h2>
          <p>The following components are Svelte components imported and rendered within the MTM framework:</p>
          
          <div class="component-grid">
            <div class="component-container">
              <h3>Card Component</h3>
              <div id="card-component">
                <div class="svelte-card-demo">
                  <div class="card primary">
                    <div class="card-header">
                      <h4>Primary Card</h4>
                    </div>
                    <div class="card-body">
                      <p>This is a Svelte card component with primary styling.</p>
                      <button onclick="cardAction('primary')" class="card-button">Action</button>
                    </div>
                  </div>
                  
                  <div class="card secondary">
                    <div class="card-header">
                      <h4>Secondary Card</h4>
                    </div>
                    <div class="card-body">
                      <p>This is a Svelte card component with secondary styling.</p>
                      <button onclick="cardAction('secondary')" class="card-button">Action</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="component-container">
              <h3>Weather Widget Component</h3>
              <div id="weather-component">
                <div class="svelte-weather-demo">
                  <div class="weather-widget">
                    <div class="weather-header">
                      <h4>🌤️ Weather Widget</h4>
                      <select id="location-select" onchange="updateWeather()">
                        <option value="new-york">New York</option>
                        <option value="london">London</option>
                        <option value="tokyo">Tokyo</option>
                        <option value="sydney">Sydney</option>
                      </select>
                    </div>
                    <div class="weather-content">
                      <div class="weather-main">
                        <div class="temperature" id="temperature">22°C</div>
                        <div class="condition" id="condition">Partly Cloudy</div>
                      </div>
                      <div class="weather-details">
                        <div class="detail">
                          <span class="label">Humidity:</span>
                          <span class="value" id="humidity">65%</span>
                        </div>
                        <div class="detail">
                          <span class="label">Wind:</span>
                          <span class="value" id="wind">12 km/h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section class="code-example">
          <h2>Code Example</h2>
          <pre><code>// Import Svelte components
import Card from '@components/Card.svelte';
import WeatherWidget from '@components/WeatherWidget.svelte';

// Use in MTM template
&lt;Card title="Example Card" variant="primary"&gt;
  Card content here
&lt;/Card&gt;
&lt;WeatherWidget location="New York" /&gt;</code></pre>
        </section>
        
        <section class="features-section">
          <h2>Svelte Integration Features</h2>
          <div class="features-grid">
            <div class="feature-card">
              <h4>🧡 Compile-Time Optimization</h4>
              <p>Svelte's compile-time optimizations work seamlessly</p>
            </div>
            <div class="feature-card">
              <h4>📦 Small Bundle Size</h4>
              <p>Svelte components add minimal overhead</p>
            </div>
            <div class="feature-card">
              <h4>🎯 Reactive Statements</h4>
              <p>Svelte's reactive statements work within MTM</p>
            </div>
            <div class="feature-card">
              <h4>🔄 Stores Integration</h4>
              <p>Svelte stores can be shared across components</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer class="page-footer">
        <p>
          <a href="/" class="footer-link">Home</a> | 
          <a href="/about" class="footer-link">About</a> |
          <a href="/react-example" class="footer-link">React</a> |
          <a href="/vue-example" class="footer-link">Vue</a> |
          <a href="/solid-example" class="footer-link">Solid</a>
        </p>
      </footer>
    </div>
    

  `;
}