import { Invoice, FieldConfig } from "./types";

export const initialInvoices: Invoice[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    storeName: "بنده للتجزئة",
    totalAmount: 458.20,
    taxAmount: 59.76,
    date: "2024-05-24",
    category: "البقالة والمواد الغذائية",
    status: "synced"
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    storeName: "محطة بترومين",
    totalAmount: 120.00,
    taxAmount: 15.65,
    date: "2024-05-23",
    category: "النقل والمواصلات",
    status: "pending"
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    storeName: "مطعم نوزومي",
    totalAmount: 890.50,
    taxAmount: 116.15,
    date: "2024-05-22",
    category: "المطاعم والكافيهات",
    status: "synced"
  }
];

export const defaultFieldsConfig: FieldConfig[] = [
  { id: "store_name", label: "اسم المتجر", enabled: true, order: 1 },
  { id: "total_amount", label: "المبلغ الإجمالي", enabled: true, order: 2 },
  { id: "date", label: "تاريخ الفاتورة", enabled: true, order: 3 },
  { id: "category", label: "التصنيف", enabled: false, order: 4 },
  { id: "tax_amount", label: "مبلغ الضريبة", enabled: false, order: 5 }
];
