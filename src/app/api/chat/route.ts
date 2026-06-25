import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { author, text, context, emotes, revealAi, sessionId } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: "I don't have my AI brain connected yet! (Add GEMINI_API_KEY)" });
    }

    // Send up to 150 random emotes to avoid overloading the context while giving good variety
    const shuffledEmotes = (emotes || []).sort(() => 0.5 - Math.random());
    const emotesContext = emotes && emotes.length > 0 
      ? `\n\nYou have access to the channel's 7TV emotes. Feel free to use one or two of these where appropriate: ${shuffledEmotes.slice(0, 150).join(', ')}\nIMPORTANT RULE: Twitch emotes ONLY work if there is a space before and after them! NEVER wrap emotes in quotes, apostrophes, or asterisks. Write them exactly as bare text. (e.g. write "that is funny KEK !" instead of "'KEK'" or "*KEK*")` 
      : '';

    const ai = new GoogleGenAI({ apiKey });

    // Format prompt
    const identityInstruction = revealAi !== false
      ? "Lean into the fact that you are an AI in a fun way (e.g. referencing your circuits, calculating things, or acknowledging your AI nature)."
      : "Act completely like a normal human viewer. NEVER reveal that you are an AI, a bot, or an language model. Do not use robotic terminology.";

    const prompt = `You are an entertaining Twitch stream viewer participating in chat.${emotesContext}
${context.length > 0 ? `Recent context:\n${context.join('\n')}\n\n` : ''}New input from ${author}: "${text}"

Write a short, casual reply to the chat (max 1 or 2 sentences). Don't use hashtags if possible. ${identityInstruction}`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
    });

    let reply = response.text || "Hmm, interesting!";
    
    // Clean up any quotes, asterisks, or attached punctuation the AI accidentally put around emotes
    if (emotes && emotes.length > 0) {
      shuffledEmotes.slice(0, 150).forEach((emote: string) => {
        const e = emote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Un-wrap quotes/asterisks
        reply = reply.replace(new RegExp(`['"*~\`]+(${e})['"*~\`]+`, 'g'), ' $1 ');
        // Un-stick from trailing punctuation
        reply = reply.replace(new RegExp(`\\b(${e})([.,!?])`, 'g'), ' $1 $2');
        // Un-stick from leading punctuation
        reply = reply.replace(new RegExp(`([.,!?])(${e})\\b`, 'g'), '$1 $2 ');
      });
    }

    reply = reply.trim();
    reply = reply.replace(/\[AI\]/g, '').trim();
    
    if (revealAi !== false && !reply.startsWith("🤖 [AI]")) {
      reply = `🤖 [AI Bot]: ${reply}`;
    }

    const usage = response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0
    } : null;

    if (usage && sessionId) {
      try {
        db.insert({
          sessionId,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens
        });
      } catch (dbError) {
        console.error("Failed to log usage to DB:", dbError);
      }
    }

    return NextResponse.json({ reply, usage });
  } catch (error: any) {
    console.error('AI Error:', error);
    const isRateLimit = error?.status === 429 || (error?.message && error.message.includes('429'));
    return NextResponse.json({ error: isRateLimit ? 'Rate Limit Exceeded (15 requests/min)' : 'Failed to generate reply' }, { status: isRateLimit ? 429 : 500 });
  }
}
