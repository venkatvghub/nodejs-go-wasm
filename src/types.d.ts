// Declare module types to fix import errors
declare module "*.js" {
  const content: any;
  export default content;
  export * from content;
}

// Add WASI interface
declare module "wasi" {
  export interface WASIOptions {
    args?: string[];
    env?: Record<string, string>;
    version: string;
  }
  
  export class WASI {
    constructor(options: WASIOptions);
    wasiImport: Record<string, any>;
    start(instance: WebAssembly.Instance): void;
    initialize(instance: WebAssembly.Instance): void;
  }
}

// Add type for JSON imports
declare module "*.json" {
  const value: any;
  export default value;
} 