/**
 * Ambient typing for JSON imports (engine.ts imports ../package.json).
 * Kept loose so resolveJsonModule stays off and no JSON file needs to be
 * copied into the build output.
 */
declare module '*.json' {
  const value: {
    name: string;
    version: string;
    [key: string]: unknown;
  };
  export default value;
}
