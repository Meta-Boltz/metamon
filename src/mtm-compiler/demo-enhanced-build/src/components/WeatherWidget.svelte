<script lang="ts">
  export let location: string = 'New York';
  export let unit: 'C' | 'F' = 'C';

  interface WeatherData {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
  }

  let weather: WeatherData = {
    temperature: unit === 'C' ? 22 : 72,
    condition: 'Sunny',
    humidity: 65,
    windSpeed: 12
  };

  let loading = false;

  async function refreshWeather() {
    loading = true;
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    weather = {
      temperature: unit === 'C' 
        ? Math.floor(Math.random() * 30) + 5
        : Math.floor(Math.random() * 54) + 41,
      condition: ['Sunny', 'Cloudy', 'Rainy', 'Windy'][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 40) + 40,
      windSpeed: Math.floor(Math.random() * 20) + 5
    };
    
    loading = false;
  }

  function toggleUnit() {
    if (unit === 'C') {
      unit = 'F';
      weather.temperature = Math.round(weather.temperature * 9/5 + 32);
    } else {
      unit = 'C';
      weather.temperature = Math.round((weather.temperature - 32) * 5/9);
    }
  }
</script>

<div class="weather-widget">
  <h3>Svelte Weather Widget</h3>
  <div class="location">{location}</div>
  
  {#if loading}
    <div class="loading">Loading weather data...</div>
  {:else}
    <div class="weather-info">
      <div class="temperature">
        {weather.temperature}°{unit}
        <button on:click={toggleUnit} class="unit-toggle">
          Switch to °{unit === 'C' ? 'F' : 'C'}
        </button>
      </div>
      <div class="condition">{weather.condition}</div>
      <div class="details">
        <div>Humidity: {weather.humidity}%</div>
        <div>Wind: {weather.windSpeed} km/h</div>
      </div>
    </div>
  {/if}
  
  <button on:click={refreshWeather} disabled={loading} class="refresh-btn">
    {loading ? 'Refreshing...' : 'Refresh Weather'}
  </button>
</div>

<style>
  .weather-widget {
    padding: 1.5rem;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    background: linear-gradient(135deg, #74b9ff, #0984e3);
    color: white;
    text-align: center;
    min-width: 250px;
  }
  
  .location {
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 1rem;
  }
  
  .temperature {
    font-size: 3em;
    font-weight: bold;
    margin: 1rem 0;
    position: relative;
  }
  
  .unit-toggle {
    position: absolute;
    top: 0;
    right: -60px;
    font-size: 0.3em;
    padding: 0.2em 0.4em;
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }
  
  .condition {
    font-size: 1.3em;
    margin-bottom: 1rem;
  }
  
  .details {
    display: flex;
    justify-content: space-around;
    margin: 1rem 0;
    font-size: 0.9em;
  }
  
  .refresh-btn {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .refresh-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.3);
  }
  
  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loading {
    font-style: italic;
    margin: 2rem 0;
  }
</style>