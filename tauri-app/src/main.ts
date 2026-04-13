import './static/styles/global.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { uiStore } from '$stores/uiStore';
import { configStore } from '$stores/configStore';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
