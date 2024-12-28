import { loadRemoteEntry } from '@angular-architects/module-federation';

loadRemoteEntry({
  type: 'module',
  remoteEntry: 'http://localhost:5001/assets/remoteEntry.js',
})
  .then(() => import('./bootstrap'))
  .catch((err) => console.error('Error loading remote entries', err));
