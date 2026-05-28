export interface Invoice {
  id: string;
  storeName: string;
  totalAmount: number;
  taxAmount: number;
  date: string;
  category: string;
  status: 'synced' | 'pending';
  syncTarget?: InvoiceSyncTarget;
  createdAt?: string;
  [key: string]: any; // Allow arbitrary user custom fields
}

export type FieldId = string;

export interface FieldConfig {
  id: FieldId;
  label: string;
  enabled: boolean;
  order: number;
}

export interface InvoiceSyncTarget {
  templateId: string;
  templateName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  fieldsConfig: FieldConfig[];
  assignedAt: string;
}

export interface ConnectedSheet {
  id: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  name: string;
  sheetName: string;
  fieldsConfig: FieldConfig[];
  basedOnTemplateId?: string;
  isShortcut?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  fieldsConfig: FieldConfig[];
  createdAt: string;
  updatedAt: string;
}
