import { registerRootComponent } from 'expo';
import App from './App';

console.log('[Index] App module loaded, registering root component...');
registerRootComponent(App);
console.log('[Index] App registered successfully!');
