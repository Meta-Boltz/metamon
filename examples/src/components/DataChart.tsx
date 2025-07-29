// Solid DataChart Component for MTM Integration
import { createSignal, createEffect, For } from 'solid-js';

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface DataChartProps {
  title?: string;
  data?: DataPoint[];
  onDataChange?: (data: DataPoint[]) => void;
  className?: string;
}

const DataChart = (props: DataChartProps) => {
  const [data, setData] = createSignal<DataPoint[]>(props.data || [
    { label: 'React', value: 35, color: '#61dafb' },
    { label: 'Vue', value: 25, color: '#4fc08d' },
    { label: 'Solid', value: 20, color: '#2c4f7c' },
    { label: 'Svelte', value: 20, color: '#ff3e00' }
  ]);

  const [animationProgress, setAnimationProgress] = createSignal(0);
  const [selectedItem, setSelectedItem] = createSignal<DataPoint | null>(null);

  // Animate chart on mount
  createEffect(() => {
    let start = 0;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 1000, 1);
      setAnimationProgress(progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  });

  const total = () => data().reduce((sum, item) => sum + item.value, 0);
  
  const maxValue = () => Math.max(...data().map(item => item.value));

  const handleItemClick = (item: DataPoint) => {
    setSelectedItem(selectedItem() === item ? null : item);
  };

  const addRandomData = () => {
    const colors = ['#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#34495e'];
    const labels = ['Angular', 'Ember', 'Alpine', 'Lit', 'Preact'];
    
    const newItem: DataPoint = {
      label: labels[Math.floor(Math.random() * labels.length)],
      value: Math.floor(Math.random() * 30) + 5,
      color: colors[Math.floor(Math.random() * colors.length)]
    };

    const newData = [...data(), newItem];
    setData(newData);
    
    if (props.onDataChange) {
      props.onDataChange(newData);
    }
  };

  const removeItem = (itemToRemove: DataPoint) => {
    const newData = data().filter(item => item !== itemToRemove);
    setData(newData);
    setSelectedItem(null);
    
    if (props.onDataChange) {
      props.onDataChange(newData);
    }
  };

  return (
    <div class={`data-chart ${props.className || ''}`}>
      <header class="chart-header">
        <h3>{props.title || 'Framework Usage Chart'}</h3>
        <p class="chart-subtitle">Interactive data visualization with Solid.js</p>
      </header>

      <div class="chart-container">
        <div class="bar-chart">
          <For each={data()}>
            {(item) => {
              const percentage = () => (item.value / maxValue()) * 100;
              const animatedHeight = () => percentage() * animationProgress();
              
              return (
                <div 
                  class={`bar-item ${selectedItem() === item ? 'selected' : ''}`}
                  onClick={() => handleItemClick(item)}
                >
                  <div class="bar-container">
                    <div 
                      class="bar"
                      style={{
                        height: `${animatedHeight()}%`,
                        'background-color': item.color
                      }}
                    />
                  </div>
                  <div class="bar-label">{item.label}</div>
                  <div class="bar-value">{item.value}%</div>
                </div>
              );
            }}
          </For>
        </div>

        <div class="pie-chart">
          <svg viewBox="0 0 100 100" class="pie-svg">
            <For each={data()}>
              {(item, index) => {
                const startAngle = () => {
                  const prevItems = data().slice(0, index());
                  return prevItems.reduce((sum, prev) => sum + (prev.value / total()) * 360, 0);
                };
                
                const endAngle = () => startAngle() + (item.value / total()) * 360;
                
                const animatedEndAngle = () => startAngle() + (item.value / total()) * 360 * animationProgress();
                
                const largeArcFlag = (animatedEndAngle() - startAngle()) > 180 ? 1 : 0;
                
                const x1 = 50 + 40 * Math.cos((startAngle() * Math.PI) / 180);
                const y1 = 50 + 40 * Math.sin((startAngle() * Math.PI) / 180);
                const x2 = 50 + 40 * Math.cos((animatedEndAngle() * Math.PI) / 180);
                const y2 = 50 + 40 * Math.sin((animatedEndAngle() * Math.PI) / 180);
                
                const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                
                return (
                  <path
                    d={pathData}
                    fill={item.color}
                    stroke="white"
                    stroke-width="0.5"
                    class={`pie-slice ${selectedItem() === item ? 'selected' : ''}`}
                    onClick={() => handleItemClick(item)}
                  />
                );
              }}
            </For>
          </svg>
        </div>
      </div>

      {selectedItem() && (
        <div class="item-details">
          <h4>Selected: {selectedItem()!.label}</h4>
          <p>Value: {selectedItem()!.value}%</p>
          <p>Percentage of total: {((selectedItem()!.value / total()) * 100).toFixed(1)}%</p>
          <button 
            class="remove-btn"
            onClick={() => removeItem(selectedItem()!)}
          >
            Remove Item
          </button>
        </div>
      )}

      <div class="chart-controls">
        <button class="add-btn" onClick={addRandomData}>
          Add Random Data
        </button>
        <div class="total-display">
          Total: {total()}%
        </div>
      </div>
    </div>
  );
};

export default DataChart;