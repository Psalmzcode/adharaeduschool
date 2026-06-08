-- Track Completion Exam module type (certificate gate; termly TERM_EXAM remains optional)
ALTER TYPE "ModuleType" ADD VALUE IF NOT EXISTS 'TRACK_COMPLETION_EXAM';
