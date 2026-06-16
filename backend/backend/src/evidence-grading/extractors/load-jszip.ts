import * as JSZipModule from 'jszip';

/** Works under ts-node (seed) and Nest compile — JSZip CJS default export varies. */
const JSZipCtor = (JSZipModule as { default?: typeof JSZipModule }).default ?? JSZipModule;

export { JSZipCtor as JSZip };
