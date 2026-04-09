export type BulkGenerateDraftHandler = () => Promise<void>;

export type RegisterBulkGenerateDraft = (
  handler: BulkGenerateDraftHandler | null
) => void;

export type BulkSaveDraftHandler = () => Promise<void>;

export type RegisterBulkSaveDraft = (
  handler: BulkSaveDraftHandler | null
) => void;
