import type { SnapConfig } from '@metamask/snaps-cli';
import { resolve } from 'path';

const config: SnapConfig = {
  input: resolve(__dirname, 'src/index.tsx'),
  server: {
    port: 5050,
  },
  polyfills: {
    buffer: true,
    crypto: true,
  },
  stats: {
    builtIns: {
      ignore: ['crypto'],
    },
  },
};

export default config;
