export type BulkGenerateDraftHandler = () => Promise<void>;

export type RegisterBulkGenerateDraft = (
  handler: BulkGenerateDraftHandler | null
) => void;
