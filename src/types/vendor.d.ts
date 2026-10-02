/**
 * Hand-written ambient module declarations for dependencies that do not bundle types.
 * Only the API surface actually used by this package is declared; keep it in sync
 * when upgrading these dependencies.
 */

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

/**
 * yargs ships no types for its "./yargs" entry point (the path engine.ts
 * imports) and no @types package covers the subpath. Only the shorthand form
 * works here: a full `declare module 'yargs/yargs' { ... }` block is ignored
 * because the module resolves to untyped JavaScript. Call shapes that cross
 * public signatures are typed locally in engine.ts.
 */
declare module 'yargs/yargs';
