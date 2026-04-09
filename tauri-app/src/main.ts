import './static/styles/global.css';
import App from './App.svelte';
import { uiStore } from '$stores/uiStore';
import { configStore } from '$stores/configStore';

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
