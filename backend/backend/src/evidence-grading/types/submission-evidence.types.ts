export type ExtractionStatus = 'pending' | 'ok' | 'partial' | 'failed';

export type SubmissionType = 'word' | 'excel' | 'html' | 'zip' | 'scratch' | 'image' | 'mixed' | 'text';

export interface SubmissionEvidence {
  extractedText?: string;
  codeFiles?: {
    filename: string;
    language: string;
    content: string;
  }[];
  tables?: {
    sheetName: string;
    headers: string[];
    rows: unknown[][];
    formulas: { cell: string; formula: string }[];
  }[];
  images?: {
    url: string;
    description?: string;
  }[];
  scratchData?: {
    spriteCount: number;
    blockCount: number;
    hasSound: boolean;
    hasMotion: boolean;
    hasLoops: boolean;
    hasConditionals: boolean;
    hasVariables: boolean;
    scriptSummary: string[];
  };
  metadata: {
    fileType: string;
    sourceUrl?: string;
    fileName?: string;
    pages?: number;
    wordCount?: number;
    sheets?: number;
    lineCount?: number;
    validationWarnings?: string[];
  };
}

export interface EvidenceFetchInput {
  evidenceUrl?: string | null;
  evidenceText?: string | null;
  textBody?: string | null;
  fileUrl?: string | null;
  submissionType?: string | null;
  allowedExtensions?: string[] | null;
  maxSizeMB?: number | null;
  lessonObjective?: string | null;
}
