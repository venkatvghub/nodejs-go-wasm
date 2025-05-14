import getWasm from '../wasm.js';
import { PiiTransformer } from './PiiTransformer.js';

// Singleton instance of the transformer
let transformerInstance: PiiTransformer | null = null;

/**
 * Get the singleton instance of the PiiTransformer
 * Lazily initialize it when first accessed
 */
function getTransformer(): PiiTransformer {
  if (!transformerInstance) {
    transformerInstance = new PiiTransformer(getWasm());
  }
  return transformerInstance;
}

// Make this a default export
export default getTransformer; 