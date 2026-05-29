import type { AppData } from '../types';
import { normalizeAppData, saveData, todayStr } from './storage';

export function exportAppData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadAppData(data: AppData, filename?: string): void {
  const blob = new Blob([exportAppData(data)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `stock-trading-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedData(raw: string): AppData {
  const parsed = JSON.parse(raw) as Partial<AppData>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无效的备份文件');
  }
  return normalizeAppData(parsed);
}

export function importAppDataFromFile(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseImportedData(String(reader.result ?? ''));
        saveData(data);
        resolve(data);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('导入失败'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
