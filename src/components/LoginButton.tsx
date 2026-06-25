"use client";
import { signIn } from "next-auth/react";

export default function LoginButton() {
  return <button onClick={() => signIn("twitch")} className="btn-primary">Connect with Twitch</button>;
}
