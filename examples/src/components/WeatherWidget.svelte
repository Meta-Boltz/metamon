<!-- Svelte Weather Widget Component for MTM Integration -->
<script>
  import { writable, derived } from 'svelte/store';
  import { onMount } from 'svelte';

  export let city = 'San Francisco';
  export let onWeatherChange = null;
  export let className = '';

  // Stores
  const weather = writable(null);
  const loading = writable(true);
  const error = writable(null);
  const selectedCity = writable(city);

  // Derived stores
  const temperature = derived(weather, $weather => 
    $weather ? Math.round($weather.temperature) : null
  );

  const temperatureColor = derived(temperature, $temp => {
    if (!$temp) return '#666';
    if ($temp < 32) return '#3498db'; // Cold - blue
    if ($temp < 60) return '#f39c12'; // Cool - orange
    if ($temp < 80) return '#27ae60'; // Warm - green
    return '#e74c3c'; // Hot - red
  });

  const cities = [
    'San Francisco',
    'New York',
    'London',
    'Tokyo',
    'Sydney',
    'Paris',
    'Berlin',
    'Toronto'
  ];

  const weatherConditions = [
    { condition: 'sunny', icon: '☀️', temp: [70, 85] },
    { condition: 'cloudy', icon: '☁️', temp: [60, 75] },
    { condition: 'rainy', icon: '🌧️', temp: [45, 65] },
    { condition: 'snowy', icon: '❄️', temp: [20, 35] },
    { condition: 'stormy', icon: '⛈️', temp: [55, 70] },
    { condition: 'foggy', icon: '🌫️', temp: [50, 65] }
  ];

  // Mock weather API call
  const fetchWeather = async (cityName) => {
    loading.set(true);
    error.set(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Generate mock weather data
      const condition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      const tempRange = condition.temp;
      const temperature = Math.floor(Math.random() * (tempRange[1] - tempRange[0] + 1)) + tempRange[0];
      
      const mockWeather = {
        city: cityName,
        temperature,
        condition: condition.condition,
        icon: condition.icon,
        humidity: Math.floor(Math.random() * 40) + 40,
        windSpeed: Math.floor(Math.random() * 15) + 5,
        description: `${condition.condition.charAt(0).toUpperCase() + condition.condition.slice(1)} weather`,
        lastUpdated: new Date().toLocaleTimeString()
      };

      weather.set(mockWeather);
      
      if (onWeatherChange) {
        onWeatherChange(mockWeather);
      }
    } catch (err) {
      error.set('Failed to fetch weather data');
    } finally {
      loading.set(false);
    }
  };

  const handleCityChange = (event) => {
    const newCity = event.target.value;
    selectedCity.set(newCity);
    fetchWeather(newCity);
  };

  const refreshWeather = () => {
    fetchWeather($selectedCity);
  };

  onMount(() => {
    fetchWeather($selectedCity);
  });
</script>

<div class="weather-widget {className}">
  <header class="weather-header">
    <h3>🌤️ Weather Widget</h3>
    <p class="widget-subtitle">Powered by Svelte stores</p>
  </header>

  <div class="city-selector">
    <label for="city-select">Choose a city:</label>
    <select 
      id="city-select"
      value={$selectedCity} 
      on:change={handleCityChange}
      class="city-select"
    >
      {#each cities as cityOption}
        <option value={cityOption}>{cityOption}</option>
      {/each}
    </select>
    <button on:click={refreshWeather} class="refresh-btn" title="Refresh weather">
      🔄
    </button>
  </div>

  <div class="weather-content">
    {#if $loading}
      <div class="loading-state">
        <div class="loading-spinner">🌀</div>
        <p>Loading weather for {$selectedCity}...</p>
      </div>
    {:else if $error}
      <div class="error-state">
        <p class="error-message">❌ {$error}</p>
        <button on:click={refreshWeather} class="retry-btn">
          Try Again
        </button>
      </div>
    {:else if $weather}
      <div class="weather-display">
        <div class="main-weather">
          <div class="weather-icon">{$weather.icon}</div>
          <div class="temperature" style="color: {$temperatureColor}">
            {$temperature}°F
          </div>
          <div class="condition">{$weather.description}</div>
        </div>

        <div class="weather-details">
          <div class="detail-item">
            <span class="detail-label">💧 Humidity:</span>
            <span class="detail-value">{$weather.humidity}%</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">💨 Wind:</span>
            <span class="detail-value">{$weather.windSpeed} mph</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">📍 Location:</span>
            <span class="detail-value">{$weather.city}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">🕐 Updated:</span>
            <span class="detail-value">{$weather.lastUpdated}</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .weather-widget {
    max-width: 400px;
    margin: 0 auto;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .weather-header {
    padding: 1.5rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.1);
  }

  .weather-header h3 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
  }

  .widget-subtitle {
    margin: 0;
    opacity: 0.9;
    font-size: 0.9rem;
  }

  .city-selector {
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .city-selector label {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .city-select {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    font-size: 0.9rem;
  }

  .refresh-btn {
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .weather-content {
    padding: 1.5rem;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-state {
    text-align: center;
  }

  .loading-spinner {
    font-size: 2rem;
    animation: spin 2s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-state {
    text-align: center;
  }

  .error-message {
    margin-bottom: 1rem;
    color: #ffcccb;
  }

  .retry-btn {
    padding: 0.5rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
  }

  .weather-display {
    width: 100%;
  }

  .main-weather {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .weather-icon {
    font-size: 4rem;
    margin-bottom: 0.5rem;
  }

  .temperature {
    font-size: 3rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }

  .condition {
    font-size: 1.1rem;
    opacity: 0.9;
    text-transform: capitalize;
  }

  .weather-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .detail-value {
    font-weight: 600;
    font-size: 0.9rem;
  }
</style>