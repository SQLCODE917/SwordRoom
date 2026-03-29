#!/usr/bin/env node
import { listContractRoutes } from './index.js';

for (const route of listContractRoutes()) {
  // eslint-disable-next-line no-console
  console.log(`${route.method} ${route.path} (${route.auth})`);
}
