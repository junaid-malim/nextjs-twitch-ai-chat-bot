import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'usage.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
}

export type TokenUsage = {
  id: string;
  sessionId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: string;
};

export const db = {
  insert: (record: Omit<TokenUsage, 'id' | 'timestamp'>) => {
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const newRecord: TokenUsage = {
        ...record,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString()
      };
      data.push(newRecord);
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
      return newRecord;
    } catch (e) {
      console.error("Failed to write to usage.json", e);
    }
  },
  getAll: () => {
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8')) as TokenUsage[];
    } catch (e) {
      return [];
    }
  }
};
