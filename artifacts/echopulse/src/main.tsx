import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Apply dark mode class for cyberpunk theme
document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(<App />);
