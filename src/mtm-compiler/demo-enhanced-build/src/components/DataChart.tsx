import { createSignal, createEffect } from 'solid-js';

interface DataChartProps {
  data?: number[];
  title?: string;
}

export default function DataChart(props: DataChartProps) {
  const [data, setData] = createSignal(props.data || [10, 20, 15, 30, 25]);
  const [maxValue, setMaxValue] = createSignal(0);

  createEffect(() => {
    setMaxValue(Math.max(...data()));
  });

  const addDataPoint = () => {
    const newValue = Math.floor(Math.random() * 50) + 1;
    setData([...data(), newValue]);
  };

  const clearData = () => {
    setData([]);
  };

  return (
    <div class="data-chart">
      <h3>{props.title || 'Solid Data Chart'}</h3>
      <div class="chart-container">
        {data().map((value, index) => (
          <div 
            class="bar" 
            style={{
              height: `${(value / maxValue()) * 100}px`,
              'background-color': `hsl(${(value / maxValue()) * 120}, 70%, 50%)`
            }}
            title={`Value: ${value}`}
          />
        ))}
      </div>
      <div class="chart-controls">
        <button onClick={addDataPoint}>Add Data</button>
        <button onClick={clearData}>Clear</button>
        <span>Max: {maxValue()}</span>
      </div>
    </div>
  );
}