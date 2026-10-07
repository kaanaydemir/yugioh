// Built-in default cinematics. Importing this module registers them (once) at DEFAULT_PRIORITY.
import './flow';
import './summon';
import './battle';
import './cards';
import { installStrikes } from './strikes';

let installed = false;

export function installDefaults(): void {
  if (installed) return;
  installed = true;
  installStrikes();
}
