/**
 * 应用入口文件
 * 负责初始化 Vue 应用、挂载路由和状态管理
 */
import './core/styles/index.scss';

import { createApp } from 'vue';

import App from './core/App.vue';
import { router } from './core/router';
import { pinia } from './core/store';

const app = createApp(App);

$(() => {
  app.use(pinia);
  app.use(router);
  app.mount('#app');
});
