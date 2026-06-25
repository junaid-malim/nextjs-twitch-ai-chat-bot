import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const records = db.getAll();
  
  const sessionMap = new Map<string, any>();
  
  for (const r of records) {
    if (!sessionMap.has(r.sessionId)) {
      sessionMap.set(r.sessionId, {
        sessionId: r.sessionId,
        sessionTime: new Date(r.timestamp).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        timestamp: r.timestamp
      });
    }
    const s = sessionMap.get(r.sessionId);
    s.promptTokens += r.promptTokens;
    s.completionTokens += r.completionTokens;
    s.totalTokens += r.totalTokens;
  }
  
  const results = Array.from(sessionMap.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return NextResponse.json(results);
}
