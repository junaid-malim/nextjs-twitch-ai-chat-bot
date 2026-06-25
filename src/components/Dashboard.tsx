"use client";

import { useEffect, useState, useRef } from "react";
import tmi from "tmi.js";

export default function Dashboard({ accessToken, followedChannels = [] }: { accessToken: string, followedChannels?: string[] }) {
  const [messages, setMessages] = useState<{ id: string, author: string, text: string, isBot: boolean }[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string>("Listening will appear here...");
  const [botUsername, setBotUsername] = useState<string>("sparky_bot");
  const [targetChannel, setTargetChannel] = useState<string>(followedChannels.length > 0 ? followedChannels[0] : "edonia");
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [channelEmotes, setChannelEmotes] = useState<string[]>([]);
  const [revealAi, setRevealAi] = useState<boolean>(true);
  const [autoReply, setAutoReply] = useState<boolean>(false);
  
  const revealAiRef = useRef<boolean>(true);
  const autoReplyRef = useRef<boolean>(false);
  
  useEffect(() => { revealAiRef.current = revealAi; }, [revealAi]);
  useEffect(() => { autoReplyRef.current = autoReply; }, [autoReply]);
  
  const clientRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const chatContextRef = useRef<string[]>([]); // Keep last few messages for AI context
  const lastReplyTimeRef = useRef<number>(0); // Cooldown to prevent spam

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
          revealAi: revealAiRef.current
        })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          alert("⚠️ Gemini API Quota Exceeded! You may have hit a daily limit. If the issue persists, the backend has been updated to use a model with a higher quota.");
        } else {
          console.error("API Error:", errData.error);
        }
        return;
      }

      const data = await response.json();
      if (data.reply && clientRef.current) {
        clientRef.current.say(channelName, data.reply);
        addMessage(botUsername, data.reply, true);
      }
    } catch (err) {
      console.error("Failed to fetch AI reply:", err);
    }
  };

  const addMessage = (author: string, text: string, isBot = false) => {
    const newMsg = { id: Math.random().toString(), author, text, isBot };
    setMessages(prev => [...prev.slice(-49), newMsg]); // keep last 50
    chatContextRef.current = [...chatContextRef.current.slice(-4), `${author}: ${text}`];
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
      
      // Clear previous messages and fetch Recent Chat History
      setMessages([]);
      fetch(`https://recent-messages.robotty.de/api/v2/recent-messages/${targetChannel}?limit=25`)
        .then(res => res.json())
        .then(data => {
          if (data && data.messages) {
            const history = data.messages.map((line: string) => {
              const authorMatch = line.match(/display-name=([^;\s]+)/);
              const msgMatch = line.match(/PRIVMSG #[^\s]+ :(.+)$/);
              return { author: authorMatch ? authorMatch[1] : 'User', text: msgMatch ? msgMatch[1] : '' };
            }).filter((m: any) => m.text);
            
            setMessages(history.map((m: any) => ({ id: Math.random().toString(), author: m.author, text: m.text, isBot: false })));
            chatContextRef.current = history.map((m: any) => `${m.author}: ${m.text}`).slice(-10);
          }
        })
        .catch(console.error);

      // Fetch 7TV emotes
      fetch(`https://decapi.me/twitch/id/${targetChannel}`).then(res => res.text()).then(id => {
        if (id && !id.includes("User not found")) {
          fetch(`https://7tv.io/v3/users/twitch/${id.trim()}`).then(r => r.json()).then(data => {
            if (data?.emote_set?.emotes) {
              setChannelEmotes(data.emote_set.emotes.map((e: any) => e.name));
            }
          }).catch(console.error);
        }
      }).catch(console.error);

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
    <div>
      <div className="app-grid">
      <div className="panel">
        <div className="panel-header">
          <h2>Stream Transcription & Chat History</h2>
          {selectedMessageIds.size > 0 && (
             <button onClick={handleManualReply} style={{ padding: '0.4rem 0.8rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
               Reply to Selected ({selectedMessageIds.size})
             </button>
          )}
          <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? 'Listening & Chatting' : 'Offline'}
          </span>
        </div>
        <div className="panel-content chat-list">
          {messages.length === 0 && <p style={{color: 'var(--text-muted)'}}>No messages yet...</p>}
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`chat-message ${msg.isBot ? 'bot' : ''} ${selectedMessageIds.has(msg.id) ? 'selected' : ''}`}
              onClick={() => toggleSelection(msg.id)}
              style={{ cursor: 'pointer', border: selectedMessageIds.has(msg.id) ? '1px solid var(--primary)' : '1px solid transparent', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
            >
              <input type="checkbox" checked={selectedMessageIds.has(msg.id)} readOnly style={{ marginTop: '5px' }} />
              <div>
                <span className="chat-author">{msg.author}</span>
                <p style={{ margin: 0 }}>{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="controls">
        <div className="panel" style={{ flex: 'none', marginBottom: '1rem' }}>
          <div className="panel-header">
            <h2>AI Behavior</h2>
          </div>
          <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="revealAiToggle" 
                checked={revealAi} 
                onChange={(e) => setRevealAi(e.target.checked)} 
              />
              <label htmlFor="revealAiToggle">Prefix replies with 🤖 [AI Bot]</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="autoReplyToggle" 
                checked={autoReply} 
                onChange={(e) => setAutoReply(e.target.checked)} 
              />
              <label htmlFor="autoReplyToggle">Autonomous Auto-Reply (Uncheck for purely manual selected replies)</label>
            </div>
          </div>
        </div>

        <div className="panel" style={{ flex: 'none', marginBottom: '1rem' }}>
          <div className="panel-header">
            <h2>Bot Username</h2>
          </div>
          <div className="panel-content">
            <input 
              type="text" 
              value={botUsername} 
              onChange={(e) => setBotUsername(e.target.value)} 
              disabled={isActive}
              placeholder="Your Twitch account name"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--secondary)', fontSize: '1rem' }}
            />
          </div>
        </div>

        <div className="panel" style={{ flex: 'none', marginBottom: '1rem' }}>
          <div className="panel-header">
            <h2>Target Streamer</h2>
          </div>
          <div className="panel-content">
            {followedChannels.length > 0 ? (
              <select 
                value={targetChannel} 
                onChange={(e) => setTargetChannel(e.target.value)} 
                disabled={isActive}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--secondary)', fontSize: '1rem' }}
              >
                {followedChannels.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                value={targetChannel} 
                onChange={(e) => setTargetChannel(e.target.value)} 
                disabled={isActive}
                placeholder="e.g. ninja"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--secondary)', fontSize: '1rem' }}
              />
            )}
          </div>
        </div>

        <div className="panel" style={{ flex: 'none' }}>
          <div className="panel-header">
            <h2>Current Audio</h2>
          </div>
          <div className="panel-content" style={{ minHeight: '100px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            "{transcription}"
          </div>
        </div>

        <button onClick={toggleBot} className={isActive ? "btn-stop" : "btn-start"}>
          {isActive ? "Stop Bot" : "Start Bot"}
        </button>
        
        <div style={{marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5'}}>
          <p><strong>Setup Note:</strong> To capture stream audio, set your default Windows Microphone to "Stereo Mix" or use a Virtual Audio Cable to route browser audio to your microphone.</p>
        </div>
      </div>
    </div>
    </div>
  );
}
