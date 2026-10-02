/**
 * Hand-written ambient module declarations for dependencies that do not bundle types.
 * Only the API surface actually used by this package is declared; keep it in sync
 * when upgrading these dependencies.
 */

declare module 'constitute' {
  export class Container {
    constitute<T = unknown>(target: unknown): T;
    bindClass(target: unknown, ...args: unknown[]): unknown;
    bindValue(target: unknown, ...args: unknown[]): unknown;
    bindMethod(target: unknown, ...args: unknown[]): unknown;
  }
  export function Dependencies(
    ...dependencies: unknown[]
  ): <T>(target: T) => T;
  const constitute: {
    Container: typeof Container;
    Dependencies: typeof Dependencies;
  };
  export default constitute;
}

declare module 'app-root-path' {
  export const path: string;
  export function resolve(...args: string[]): string;
  export function require(module: string): unknown;
  export function setPath(path: string): void;
}

declare module 'cloud-config-client' {
  export interface SpringConfigSource {
    forEach(callback: (key: string, value: unknown) => void): void;
  }
  export function load(options: {
    endpoint: string;
    name: string;
    profiles: string[];
    label?: string;
  }): Promise<SpringConfigSource>;
}

declare module 'continuation-local-storage' {
  export interface Namespace {
    active: boolean;
    set(key: string, value: unknown): unknown;
    get(key: string): unknown;
    run(fn: (...args: unknown[]) => unknown, ...args: unknown[]): unknown;
    bind(fn: (...args: unknown[]) => unknown, context?: object): (...args: unknown[]) => unknown;
    bindEmitter(...args: unknown[]): unknown;
    createContext(): object;
  }
  export function createNamespace(name: string): Namespace;
  export function getNamespace(name: string): Namespace | undefined;
  export function destroyNamespace(name: string): void;
  export function reset(name: string): void;
}

declare module 'doctrine' {
  export interface AnnotationTag {
    title: string;
    description: string | null;
    [key: string]: unknown;
  }
  export interface Annotation {
    tags: AnnotationTag[];
    [key: string]: unknown;
  }
  export function parse(
    content: string,
    options?: { unwrap?: boolean; sloppy?: boolean; [key: string]: unknown }
  ): Annotation;
}

declare module 'jwt-simple' {
  export function encode(
    payload: object,
    key: string,
    algorithm?: string,
    options?: object
  ): string;
  export function decode(
    token: string,
    key: string,
    noVerify?: boolean,
    algorithm?: string
  ): object;
  const jwt: {
    encode: typeof encode;
    decode: typeof decode;
  };
  export default jwt;
}

/**
 * yargs ships no types for its "./yargs" entry point (the path engine.ts
 * imports) and no @types package covers the subpath. Only the shorthand form
 * works here: a full `declare module 'yargs/yargs' { ... }` block is ignored
 * because the module resolves to untyped JavaScript. Call shapes that cross
 * public signatures are typed locally in engine.ts.
 */
declare module 'yargs/yargs';
