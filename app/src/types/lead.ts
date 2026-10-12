export interface Lead {
  id: string; // leadgen_id from Meta — used as the dedup key
  formId: string;
  pageId: string;
  name?: string;
  email?: string;
  phone?: string;
  rawFieldData: Record<string, string>; // full field_data
  receivedAt: string; // ISO timestamp
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
