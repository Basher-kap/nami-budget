import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function exportExcel(data) {
  const wb = XLSX.utils.book_new();
  const nodes = data.nodes.map((n) => ({ Id: n.id, Name: n.name, ParentId: n.parentId || '', Balance: n.balance }));
  const expenses = data.tx.filter((t) => t.type === 'expense').map((t) => ({
    'Wallet Name': t.walletName, Expense: t.description, Amount: t.amount, Date: t.date, WalletId: t.walletId, Id: t.id }));
  const deposits = data.tx.filter((t) => t.type === 'deposit').map((t) => ({
    'Wallet Name': t.walletName, Amount: t.amount, Date: t.date, WalletId: t.walletId, Id: t.id }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nodes), 'Nodes');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), 'Expenses');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deposits), 'Deposits');
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.cacheDirectory + 'NamiBudget.xlsx';
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: MIME, dialogTitle: 'Export Nami Budget' });
}

// Returns {nodes, tx} or null if cancelled. Throws on a bad file.
export async function importExcel() {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: [MIME, 'application/vnd.ms-excel', '*/*'] });
  if (r.canceled) return null;
  const b64 = await FileSystem.readAsStringAsync(r.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
  const wb = XLSX.read(b64, { type: 'base64' });
  const rows = (name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name]) : []);
  const nodes = rows('Nodes').map((n) => ({
    id: String(n.Id), name: String(n.Name), parentId: n.ParentId ? String(n.ParentId) : null, balance: Number(n.Balance) || 0 }));
  if (!nodes.length || !nodes.some((n) => !n.parentId)) throw new Error('This file has no valid "Nodes" sheet.');
  const tx = [
    ...rows('Expenses').map((t) => ({ id: String(t.Id), type: 'expense', walletId: String(t.WalletId), walletName: String(t['Wallet Name']),
      description: String(t.Expense ?? ''), amount: Number(t.Amount) || 0, date: String(t.Date) })),
    ...rows('Deposits').map((t) => ({ id: String(t.Id), type: 'deposit', walletId: String(t.WalletId), walletName: String(t['Wallet Name']),
      description: '', amount: Number(t.Amount) || 0, date: String(t.Date) })),
  ];
  return { nodes, tx };
}
