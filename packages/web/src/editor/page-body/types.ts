export type BlockEntity = {
  id: string;
  type: string;
  content: Record<string, unknown>;
  properties: Record<string, unknown>;
  sortOrder: number;
};
