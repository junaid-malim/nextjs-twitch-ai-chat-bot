"use client";
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

export default function UsageChartModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage')
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-4xl p-6 md:p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors p-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h2 className="text-xl font-bold mb-8 glow-text uppercase tracking-wider text-center">Historical Token Usage</h2>
        
        <div className="h-[400px] w-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-white/50 animate-pulse">Loading metrics...</div>
          ) : data.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-white/50">No usage data found yet. Start chatting!</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2a2c" vertical={false} />
                <XAxis dataKey="sessionTime" stroke="#94a3b8" angle={-45} textAnchor="end" height={60} tick={{fontSize: 12}} dy={10} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                <RechartsTooltip 
                  cursor={{fill: '#1a1a1a'}}
                  contentStyle={{ backgroundColor: 'rgba(26,26,26,0.9)', borderColor: '#2b2a2c', borderRadius: '8px', backdropFilter: 'blur(4px)' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}/>
                <Bar dataKey="promptTokens" name="Prompt Tokens" stackId="a" fill="#8B5CF6" radius={[0, 0, 4, 4]} />
                <Bar dataKey="completionTokens" name="Response Tokens" stackId="a" fill="#DB2777" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
