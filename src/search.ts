import { searchDocuments as generatedDocuments } from './generated/search';
import type { SearchDocument } from './search/engine';

export const searchDocuments: readonly SearchDocument[] = generatedDocuments;
export * from './search/engine';
