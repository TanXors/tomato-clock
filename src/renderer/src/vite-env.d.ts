/// <reference types="vite/client" />

import type { TomatoApi } from '../../shared/types';

declare global {
  interface Window {
    tomatoApi: TomatoApi;
  }
}
