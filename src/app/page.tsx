import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import Dashboard from "@/components/Dashboard";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);

  let followedChannels: string[] = [];

  if (session) {
    const accessToken = (session as any).accessToken;
    
    try {
      const userRes = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID || ""
        }
      });
      const userData = await userRes.json();
      const userId = userData.data?.[0]?.id;

      if (userId) {
        // Fetch all followed channels
        let cursor = "";
        let hasMore = true;
        const allFollows = new Set<string>();
        
        while (hasMore && allFollows.size < 500) {
          const followRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${userId}&first=100${cursor ? `&after=${cursor}` : ''}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Client-Id": process.env.TWITCH_CLIENT_ID || ""
            }
          });
          const followData = await followRes.json();
          
          if (followData.data && followData.data.length > 0) {
            followData.data.forEach((ch: any) => allFollows.add(ch.broadcaster_login));
            if (followData.pagination && followData.pagination.cursor) {
              cursor = followData.pagination.cursor;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        // Fetch currently live streams
        cursor = "";
        hasMore = true;
        const liveStreams = new Set<string>();

        while (hasMore && liveStreams.size < 500) {
          const streamRes = await fetch(`https://api.twitch.tv/helix/streams/followed?user_id=${userId}&first=100${cursor ? `&after=${cursor}` : ''}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Client-Id": process.env.TWITCH_CLIENT_ID || ""
            }
          });
          const streamData = await streamRes.json();
          
          if (streamData.data && streamData.data.length > 0) {
            streamData.data.forEach((stream: any) => liveStreams.add(stream.user_login));
            if (streamData.pagination && streamData.pagination.cursor) {
              cursor = streamData.pagination.cursor;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        // Combine them, putting live ones first
        const liveArray = Array.from(liveStreams);
        const offlineArray = Array.from(allFollows).filter(ch => !liveStreams.has(ch));
        
        followedChannels = [
          ...liveArray.map(ch => `🟢 ${ch}`),
          ...offlineArray
        ];
        console.log(`Fetched ${liveArray.length} live streams and ${offlineArray.length} offline channels`);
      }
    } catch (e) {
      console.error("Error fetching Twitch data:", e);
    }

    return (
      <main className="relative min-h-screen z-10 p-0 m-0 overflow-hidden">
        <div className="bg-orb-1"></div>
        <div className="bg-orb-2"></div>
        
        <div className="w-full h-screen animate-fade-up relative z-10 flex flex-col">
          <Dashboard accessToken={(session as any).accessToken} followedChannels={followedChannels} userImage={session.user?.image} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex justify-center items-center min-h-screen overflow-x-hidden">
      <div className="bg-orb-1"></div>
      <div className="bg-orb-2"></div>
      
      <div className="relative z-10 text-center glass-panel p-10 md:p-14 max-w-3xl mx-4 animate-fade-up border-t border-[#c90003]/30">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/5 bg-[#050505] px-4 py-1.5">
          <div className="w-[5px] h-[5px] bg-[#c90003] rounded-full animate-ping"></div>
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#c90003]">Autonomous AI Agent</span>
        </div>
        <h1 className="text-4xl md:text-[60px] font-semibold mb-6 tracking-[-0.05em] text-white leading-[1.1]">
          Supercharge your <br/><span className="glow-red text-[50px] md:text-[70px]">Twitch Chat</span>
        </h1>
        <p className="text-base md:text-lg text-[#888] mb-10 leading-relaxed max-w-xl mx-auto font-medium">
          The mission control for your Twitch channel. Deploy intelligent agents that handle chat interaction, so you can focus on the gameplay.
        </p>
        <LoginButton />
      </div>
    </main>
  );
}
