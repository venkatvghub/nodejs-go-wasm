import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the WASM file
const wasmPath = path.join(__dirname, 'crypto.wasm');

// WASM instance
let wasmInstance: any = null;

/**
 * Load the WASM module and initialize with encryption key
 * @param encryptionKey Optional 32-byte encryption key to use
 */
function getWasm(): any {
  if (wasmInstance) {
    return wasmInstance;
  }

  try {
    console.log(`Loading WASM module from ${wasmPath}`);
    
    // Read the WASM file
    const wasmBuffer = fs.readFileSync(wasmPath);
    
    // Create a simple set of environment functions
    const importObject = {
      env: {
        abort: (_msg: number, _file: number, line: number, column: number) => {
          console.error(`Abort called at ${line}:${column}`);
        },
      },
      wasi_snapshot_preview1: {
        // Process and argument handling
        proc_exit: (code: number) => {
          if (code !== 0) {
            console.error(`WASM exited with code ${code}`);
          }
        },
        args_sizes_get: () => { return 0; },
        args_get: () => { return 0; },
        
        // File descriptors
        fd_write: () => { return 0; },
        fd_read: () => { return 0; },
        fd_close: () => { return 0; },
        fd_seek: () => { return 0; },
        fd_prestat_get: () => { return 0; },
        fd_prestat_dir_name: () => { return 0; },
        
        // Environment variables
        environ_sizes_get: () => { return 0; },
        environ_get: () => { return 0; },
        
        // Misc
        random_get: () => { return 0; },
        clock_time_get: () => { return 0; },
        poll_oneoff: () => { return 0; },
      }
    };
    
    // Compile and instantiate the WASM module
    const module = new WebAssembly.Module(wasmBuffer);
    const instance = new WebAssembly.Instance(module, importObject);
    
    // Extract exports
    wasmInstance = instance.exports;
    
    console.log('WASM module loaded successfully with exports:', Object.keys(wasmInstance));
    return wasmInstance;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    throw error;
  }
}

export default getWasm; 