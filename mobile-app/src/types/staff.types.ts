export interface StaffRecord {
  id: string;
  user_id: string;
  name_en: string;
  name_ur?: string;
  phone: string;
  email?: string;
  role: string;
  joining_date: string; // ISO format
  area: string;
  business_type: string;
  address?: string;
  picture_url?: string;
  document_urls?: string[];
  status: 'active' | 'inactive';
  monthly_salary?: number;     // integer paisa (0 = not set)
  created_at: string;
  updated_at?: string;
  synced: 0 | 1;
  is_deleted: 0 | 1;
  deleted_at?: string;
}
