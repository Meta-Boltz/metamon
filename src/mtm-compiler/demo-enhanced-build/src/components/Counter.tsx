import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
  step?: number;
}

export default function Counter({ initialValue = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="counter">
      <h3>React Counter</h3>
      <div className="counter-display">
        <button onClick={() => setCount(count - step)}>-</button>
        <span className="count">{count}</span>
        <button onClick={() => setCount(count + step)}>+</button>
      </div>
    </div>
  );
}