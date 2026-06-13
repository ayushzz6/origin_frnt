// Minimal ambient types for the `jsdom` dev dependency, which ships no bundled
// types and has no `@types/jsdom` in this project. Used only by unit tests that
// need a DOM (e.g. the select-to-ask highlight-capture tests).
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis & { document: Document };
  }
}
