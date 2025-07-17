import { render } from 'solid-js/web';
import SolidThemeToggleSimple from './components/SolidThemeToggleSimple.jsx';

// Mount Solid component
const solidElement = document.getElementById('solid-theme-toggle');
if (solidElement) {
  render(SolidThemeToggleSimple, solidElement);
}