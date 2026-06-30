import { app } from 'electron';
import { join } from 'node:path';

type AppIconFormat = 'ico' | 'png';

export function getAppIconPath(format: AppIconFormat): string {
  return join(app.getAppPath(), 'resources', 'icons', `tomato.${format}`);
}
