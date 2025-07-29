// React Counter Component for MTM Integration
import React, { useState, useEffect } from 'react';

interface CounterProps {
  initialValue?: number;
  onIncrement?: () => void;
  className?: string;
}

const Counter: React.FC<CounterProps> = ({ 
  initialValue = 0, 
  onIncrement,
  className = ''
}) => {
  const [count, setCount] = useState(initialValue);

  useEffect(() => {
    setCount(initialValue);
  }, [initialValue]);

  const handleIncrement = () => {
    setCount(prev => prev + 1);
    if (onIncrement) {
      onIncrement();
    }
  };

  const handleDecrement = () => {
    setCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className={`counter-component ${className}`}>
      <h3>React Counter Component</h3>
      <div className="counter-display">
        <button onClick={handleDecrement} className="counter-btn">
          -
        </button>
        <span className="counter-value">{count}</span>
        <button onClick={handleIncrement} className="counter-btn">
          +
        </button>
      </div>
      <p className="counter-info">
        This is a React component imported into MTM
      </p>
    </div>
  );
};

export default Counter;