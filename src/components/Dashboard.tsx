"use client";

import { useEffect, useState, useRef } from "react";
import tmi from "tmi.js";
import LogoutButton from "@/components/LogoutButton";
import UsageChartModal from "@/components/UsageChartModal";

export default function Dashboard({ accessToken, followedChannels = [], userImage }: { accessToken: string, followedChannels?: string[], userImage?: string | null }) {
  const [messages, setMessages] = useState<{ id: string, author: string, text: string, isBot: boolean, isError?: boolean }[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string>("Listening will appear here...");
  const [botUsername, setBotUsername] = useState<string>("sparky_bot");
  const [targetChannel, setTargetChannel] = useState<string>(followedChannels.length > 0 ? followedChannels[0] : "edonia");
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [channelEmotes, setChannelEmotes] = useState<string[]>([]);
  const [revealAi, setRevealAi] = useState<boolean>(false);
  const [autoReply, setAutoReply] = useState<boolean>(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState<boolean>(true);
  const [tokenUsage, setTokenUsage] = useState({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  const [sessionId, setSessionId] = useState<string>("");
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  
  const revealAiRef = useRef<boolean>(false);
  const autoReplyRef = useRef<boolean>(false);
  
  useEffect(() => { revealAiRef.current = revealAi; }, [revealAi]);
  useEffect(() => { autoReplyRef.current = autoReply; }, [autoReply]);
  
  const clientRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const chatContextRef = useRef<string[]>([]); // Keep last few messages for AI context
  const lastReplyTimeRef = useRef<number>(0); // Cooldown to prevent spam
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAutoScrollEnabled && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isAutoScrollEnabled]);

  useEffect(() => {
    // Initialize Speech Recognition
    if (typeof window !== "undefined" && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscription(finalTranscript);
          handleAudioTranscription(finalTranscript);
        } else {
          setTranscription(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
      };
    }

    return () => {
      if (clientRef.current) clientRef.current.disconnect();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isActive, targetChannel]);

  const handleAudioTranscription = async (text: string) => {
    if (!isActive || !autoReplyRef.current) return;
    
    // We only trigger AI if someone said something substantial in the stream
    if (text.length > 10) {
      const now = Date.now();
      if (now - lastReplyTimeRef.current >= 30000) {
        lastReplyTimeRef.current = now;
        triggerAiReply(targetChannel, "Stream Audio", text);
      }
    }
  };

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScrollEnabled(isAtBottom);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedMessageIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMessageIds(newSet);
  };

  const handleManualReply = () => {
    const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id));
    if (selectedMsgs.length === 0) return;
    
    let authorName = "Selected Messages";
    let combinedText = selectedMsgs.map(m => `${m.author}: ${m.text}`).join('\n');
    
    if (selectedMsgs.length === 1) {
      authorName = selectedMsgs[0].author;
      combinedText = selectedMsgs[0].text;
    }
    
    triggerAiReply(targetChannel, authorName, combinedText, true);
    setSelectedMessageIds(new Set());
  };

  const triggerAiReply = async (channelName: string, author: string, text: string, isManual = false) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          author, 
          text, 
          context: isManual ? [] : chatContextRef.current.slice(-5),
          emotes: channelEmotes,
          revealAi: revealAiRef.current,
          sessionId
        })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          addMessage("System Alert", "⚠️ Gemini API Quota Exceeded! You have hit your daily/hourly limit.", false, true);
        } else {
          addMessage("System Error", errData.error || "Failed to connect to API", false, true);
        }
        return;
      }

      const data = await response.json();
      
      if (data.usage) {
        setTokenUsage(prev => ({
          promptTokens: prev.promptTokens + data.usage.promptTokens,
          completionTokens: prev.completionTokens + data.usage.completionTokens,
          totalTokens: prev.totalTokens + data.usage.totalTokens
        }));
      }

      if (data.reply && clientRef.current) {
        clientRef.current.say(channelName, data.reply);
        addMessage(botUsername, data.reply, true);
      }
    } catch (err) {
      console.error("Failed to fetch AI reply:", err);
      addMessage("System Error", "Network or server failure while reaching AI.", false, true);
    }
  };

  const addMessage = (author: string, text: string, isBot = false, isError = false) => {
    const newMsg = { id: Math.random().toString(), author, text, isBot, isError };
    setMessages(prev => [...prev.slice(-49), newMsg]); // keep last 50
    if (!isError) {
      chatContextRef.current = [...chatContextRef.current.slice(-4), `${author}: ${text}`];
    }
  };

  const toggleBot = async () => {
    if (isActive) {
      // Stop
      setIsActive(false);
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      if (recognitionRef.current) recognitionRef.current.stop();
    } else {
      // Start
      if (!targetChannel) {
        alert("Please enter a target channel!");
        return;
      }

      setIsActive(true);
      setSessionId(Math.random().toString(36).substring(2, 15));
      setTokenUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      
      // Clear previous messages and fetch Recent Chat History
      setMessages([]);
      try {
        const res = await fetch(`https://recent-messages.robotty.de/api/v2/recent-messages/${targetChannel}?limit=25`);
        const data = await res.json();
        if (data && data.messages) {
          const history = data.messages.map((line: string) => {
            const authorMatch = line.match(/(?:^|;)display-name=([^;\s]+)/);
            const msgMatch = line.match(/PRIVMSG #[^\s]+ :(.+)$/);
            return { author: authorMatch ? authorMatch[1] : 'User', text: msgMatch ? msgMatch[1] : '' };
          }).filter((m: any) => m.text);
          
          setMessages(history.map((m: any) => ({ id: Math.random().toString(), author: m.author, text: m.text, isBot: false })));
          chatContextRef.current = history.map((m: any) => `${m.author}: ${m.text}`).slice(-10);
        }
      } catch (err) {
        console.error("Failed to fetch recent messages:", err);
      }

      // Fetch 7TV emotes
      try {
        const id = await fetch(`https://decapi.me/twitch/id/${targetChannel}`).then(res => res.text());
        if (id && !id.includes("User not found")) {
          const data = await fetch(`https://7tv.io/v3/users/twitch/${id.trim()}`).then(r => r.json());
          if (data?.emote_set?.emotes) {
            setChannelEmotes(data.emote_set.emotes.map((e: any) => e.name));
          }
        }
      } catch (err) {
        console.error("Failed to fetch emotes:", err);
      }

      // Connect Twitch
      clientRef.current = new tmi.Client({
        options: { debug: true },
        identity: {
          username: botUsername,
          password: `oauth:${accessToken}`
        },
        channels: [targetChannel]
      });

      clientRef.current.connect().catch(console.error);

      clientRef.current.on('message', (channel: string, tags: any, message: string, self: boolean) => {
        const authorName = tags['display-name'] || 'User';
        if (self || authorName.toLowerCase() === botUsername.toLowerCase()) return; // Ignore our own messages safely
        addMessage(authorName, message, false);
        
        if (!autoReplyRef.current) return;

        // Only reply if explicitly mentioned, or a very small random chance to prevent spam
        const isMentioned = message.toLowerCase().includes(botUsername.toLowerCase());
        if (isMentioned || Math.random() < 0.05) {
           const now = Date.now();
           if (now - lastReplyTimeRef.current >= 30000) { // 30 sec cooldown
             lastReplyTimeRef.current = now;
             triggerAiReply(targetChannel, authorName, message);
           }
        }
      });

      // Start listening
      if (recognitionRef.current) {
         try {
           recognitionRef.current.start();
         } catch(e) { console.error(e) }
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Bar with Usage Stats */}
      <header className="glass-panel rounded-b-none flex justify-between items-center px-6 py-4 relative z-50 border-b-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#c90003] flex items-center justify-center border border-[#c90003]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-widest glow-red hidden sm:block">Nexus</h1>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative group flex items-center gap-2 cursor-pointer bg-[#080808]/50 px-3 py-1.5 rounded-lg border border-white/5 hover:border-[#c90003]/50 transition-colors" onClick={() => setIsChartModalOpen(true)}>
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Token Usage</span>
              <span className="text-xs font-bold text-white">{tokenUsage.totalTokens.toLocaleString()}</span>
            </div>
            {/* Hover Tooltip */}
            <div className="absolute top-full right-0 mt-2 w-48 bg-[#080808]/95 backdrop-blur-md border border-white/10 rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10 pb-2 mb-2 font-bold">API Metrics (Session)</div>
              <div className="flex justify-between text-xs mb-1 text-white/80"><span>Prompt Tokens:</span> <span>{tokenUsage.promptTokens.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs mb-1 text-white/80"><span>Response Tokens:</span> <span>{tokenUsage.completionTokens.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs font-bold mt-2 pt-2 border-t border-white/10 text-[#c90003]"><span>Total Tokens:</span> <span>{tokenUsage.totalTokens.toLocaleString()}</span></div>
            </div>
          </div>
          
          <div className="w-px h-6 bg-white/10 hidden md:block"></div>
          
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-[10px] font-bold hidden md:block uppercase tracking-wider">Connected</span>
            {userImage && <img src={userImage} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10" />}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 overflow-hidden">
        
        {/* Chat List Panel */}
        <div className="lg:col-span-2 glass-panel rounded-t-none lg:rounded-br-none flex flex-col overflow-hidden h-[60vh] lg:h-auto relative">
          <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/40">
            <h2 className="font-semibold text-[11px] uppercase tracking-[0.2em] flex items-center gap-2 text-white/70">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#c90003]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Stream Chat & AI Context
            </h2>
            <div className="flex items-center gap-3">
              {selectedMessageIds.size > 0 && (
                <button onClick={handleManualReply} className="px-3 py-1.5 bg-[#c90003] text-white text-[10px] font-bold uppercase tracking-[0.1em] rounded-md hover:bg-[#a00002] transition-colors border border-transparent">
                  Reply ({selectedMessageIds.size})
                </button>
              )}
              <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] border ${isActive ? 'bg-[#c90003]/10 text-[#c90003] border-[#c90003]/30' : 'bg-white/5 text-white/50 border-white/10'}`}>
                {isActive ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={chatContainerRef} onScroll={handleChatScroll}>
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-white/30 italic text-sm">
                {isActive ? "Waiting for chat messages..." : "Connect bot to see messages"}
              </div>
            )}
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`p-4 rounded-xl border transition-all duration-200 flex gap-3 group ${msg.isError ? '' : 'cursor-pointer'} ${
                  msg.isError
                    ? 'bg-[#ef4444]/10 border-[#ef4444]/50'
                    : msg.isBot 
                      ? 'bg-[#c90003]/10 border-[#c90003]/30' 
                      : selectedMessageIds.has(msg.id) 
                        ? 'bg-[#080808] border-[#c90003]/50'
                        : 'bg-black border-white/5 hover:border-white/20 hover:bg-[#111111]'
                }`}
                onClick={() => !msg.isError && toggleSelection(msg.id)}
              >
                {!msg.isError && (
                  <div className="pt-1">
                    <input type="checkbox" checked={selectedMessageIds.has(msg.id)} readOnly className="accent-[#c90003] w-4 h-4 rounded border-gray-600 bg-gray-700 cursor-pointer outline-none" />
                  </div>
                )}
                <div className="flex-1">
                  <span className={`font-bold text-sm ${msg.isError ? 'text-[#ef4444]' : msg.isBot ? 'text-[#c90003]' : 'text-[#555] group-hover:text-white transition-colors'}`}>
                    {msg.author}
                  </span>
                  <p className={`mt-1 leading-relaxed text-[15px] ${msg.isError ? 'text-[#ef4444]/90' : 'text-white/90'}`}>{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          {!isAutoScrollEnabled && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
              <button 
                onClick={() => {
                  setIsAutoScrollEnabled(true);
                  if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                  }
                }}
                className="bg-[#080808]/90 backdrop-blur border border-[#c90003]/50 text-white px-4 py-2 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase hover:bg-black transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                Resume Auto-Scroll
              </button>
            </div>
          )}
        </div>

        {/* Controls Sidebar */}
        <div className="flex flex-col h-full space-y-0">
          
          <div className="glass-panel p-5 rounded-none lg:rounded-tr-none lg:border-l-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">AI Behavior</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={revealAi} onChange={(e) => setRevealAi(e.target.checked)} className="accent-[#c90003] w-4 h-4 rounded cursor-pointer outline-none" />
                <span className="text-sm text-[#555] group-hover:text-white transition-colors select-none">Prefix replies with 🤖 [AI Bot]</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} className="accent-[#c90003] w-4 h-4 rounded cursor-pointer outline-none" />
                <span className="text-sm text-[#555] group-hover:text-white transition-colors select-none">Autonomous Auto-Reply</span>
              </label>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-none border-t-0 lg:border-l-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Connection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-white/40 mb-1.5 uppercase tracking-wider font-bold">Bot Username</label>
                <input 
                  type="text" value={botUsername} onChange={(e) => setBotUsername(e.target.value)} disabled={isActive}
                  placeholder="Your Twitch account"
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1.5 uppercase tracking-wider font-bold">Target Streamer</label>
                {followedChannels.length > 0 ? (
                  <select 
                    value={targetChannel} onChange={(e) => setTargetChannel(e.target.value)} disabled={isActive}
                    className="glass-input appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[position:right_1rem_center] bg-[length:1em]"
                  >
                    {followedChannels.map(ch => (
                      <option key={ch} value={ch.replace('🟢 ', '')} className="bg-[#121212]">{ch}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={targetChannel} onChange={(e) => setTargetChannel(e.target.value)} disabled={isActive} placeholder="e.g. ninja" className="glass-input" />
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 flex-1 flex flex-col min-h-[250px] rounded-t-none lg:rounded-bl-none border-t-0 lg:border-l-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span></span>
              Live Audio
            </h2>
            <div className="flex-1 bg-[#0b0b0b] rounded-lg border border-[#2b2a2c] p-4 text-sm text-white/50 italic overflow-y-auto font-light">
              "{transcription}"
            </div>
            <div className="mt-4 pt-4 border-t border-[#2b2a2c]">
              <button 
                onClick={toggleBot} 
                className={`w-full py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all duration-300 ${
                  isActive 
                    ? 'bg-transparent text-[#c90003] border border-[#c90003]/30 hover:bg-[#c90003]/10' 
                    : 'bg-[#c90003] text-white hover:bg-[#a00002] border border-[#c90003]'
                }`}
              >
                {isActive ? "Stop Agent" : "Launch Agent"}
              </button>
            </div>
          </div>
          
        </div>
      </div>
      {isChartModalOpen && <UsageChartModal onClose={() => setIsChartModalOpen(false)} />}
    </div>
  );
}
