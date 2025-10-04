import { useState } from 'react';
import './App.css';
import { Globe } from './Globe';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <Globe/>
    </div>
  );
}

export default App;