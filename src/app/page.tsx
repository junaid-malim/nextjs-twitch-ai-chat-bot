import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import Dashboard from "@/components/Dashboard";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";

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
        let cursor = "";
        let hasMore = true;
        
        while (hasMore && followedChannels.length < 500) {
          const streamRes = await fetch(`https://api.twitch.tv/helix/streams/followed?user_id=${userId}&first=100${cursor ? `&after=${cursor}` : ''}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Client-Id": process.env.TWITCH_CLIENT_ID || ""
            }
          });
          const streamData = await streamRes.json();
          
          if (streamData.data && streamData.data.length > 0) {
            followedChannels.push(...streamData.data.map((stream: any) => stream.user_login));
            if (streamData.pagination && streamData.pagination.cursor) {
              cursor = streamData.pagination.cursor;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    return (
      <main className="dashboard">
        <header className="header">
          <h1>Chatter AI</h1>
          <div className="user-info">
            {session.user?.image && <img src={session.user.image} alt="Avatar" />}
            <span>Stream Assistant</span>
            <LogoutButton />
          </div>
        </header>
        <Dashboard accessToken={(session as any).accessToken} followedChannels={followedChannels} />
      </main>
    );
  }

  return (
    <main className="landing">
      <div className="landing-content">
        <h1>Chatter AI</h1>
        <p>Your intelligent Twitch co-host. Listens to the stream, analyzes chat, and responds autonomously using advanced LLMs.</p>
        <LoginButton />
      </div>
    </main>
  );
}
