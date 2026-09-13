import { getDatabase } from './db';
import { createUser, hashPassword } from './userDb';
import { createTransaction } from './transactionDb';
import { createCashEntry } from './cashbookDb';

export const seedDatabase = async (): Promise<void> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE phone = ?', ['03000000000']);
  if ((row?.count ?? 0) > 0) return;

  // createUser(name, phone, password, role, businessName, parentId, name_ur, businessType, area)
  const admin = await createUser('Admin', '03000000000', 'Admin@12345', 'admin', 'admin', undefined, undefined, undefined, undefined, 'Bahawalpur');
  const ahmed = await createUser('Ahmed Khan', '03001234567', 'Staff@123', 'staff', 'staff', 'Khan General Store', admin.id, undefined, 'Retailer', 'Lahore');
  const sara  = await createUser('Sara Malik',  '03011234567', 'SubStaff@123',  'staff', 'substaff', 'Malik Cloth House', ahmed.id, undefined, 'Wholesaler', 'Karachi');
  await createUser('Bilal Raza', '03021234567', 'Bilal@123', 'staff', 'staff', 'Raza Electronics', admin.id, undefined, 'Retailer', 'Islamabad');

  // Amounts are in paisa (1 Rs = 100 paisa)
  await createTransaction(ahmed.id, 'Ali Traders',        1_500_000, 'lena', 'Monthly supply payment', '2024-01-05');
  await createTransaction(ahmed.id, 'Karachi Wholesale',    850_000, 'dena', 'Stock purchase',          '2024-01-08');
  await createTransaction(ahmed.id, 'Hassan & Sons',      2_200_000, 'lena', 'Outstanding payment',     '2024-01-12');
  await createTransaction(ahmed.id, 'Punjab Distributors',  500_000, 'dena', 'Delivery charges',        '2024-01-15');
  await createTransaction(ahmed.id, 'City Mart',            980_000, 'lena', 'Invoice #1045',            '2024-01-20');

  await createTransaction(sara.id,  'Textile Mills PK',  4_500_000, 'dena', 'Fabric order',            '2024-01-03');
  await createTransaction(sara.id,  'Boutique Shehnai',  1_800_000, 'lena', 'Stitching charges',       '2024-01-07');
  await createTransaction(sara.id,  'Zara Imports',      1_250_000, 'dena', 'Imported fabric',         '2024-01-14');
  await createTransaction(sara.id,  'Nadia Fashion',     3_000_000, 'lena', 'Bulk order payment',      '2024-01-18');

  await createCashEntry(ahmed.id, 'Cash Sale',          500_000, 'in',  '2024-01-06');
  await createCashEntry(ahmed.id, 'Rent',             1_200_000, 'out', '2024-01-10');
  await createCashEntry(ahmed.id, 'Recovery from Ali',  350_000, 'in',  '2024-01-16');
  await createCashEntry(ahmed.id, 'Electricity Bill',   220_000, 'out', '2024-01-20');
};

// Seed test admin account on first app launch
export async function seedTestUsers() {
  const db = await getDatabase();
  
  // Check if test admin already exists
  const existing = await db.getFirstAsync(
    'SELECT * FROM users WHERE phone = ?',
    ['03339999999']
  );
  
  if (!existing) {
    // Create test admin
    await db.runAsync(
      `INSERT INTO users (id, name, phone, passwordHash, role, account_level, businessName, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'test-admin-001',
        'DigiKhata Admin',
        '03339999999',
        await hashPassword('admin123'),
        'admin',
        'admin',
        'DigiKhata Test Store',
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }
}
