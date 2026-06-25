# Next.js AI Twitch Chat Bot

An AI-powered Twitch Chat integration built with Next.js, Google Gemini API (`@google/genai`), and Twitch messaging (`tmi.js`). This application connects directly to any Twitch channel and uses generative AI to analyze or respond to chat messages in real-time.

## Features
- **Real-time Twitch Chat**: Connects to Twitch IRC via `tmi.js`.
- **Generative AI Integration**: Powered by Google's Gemini API for smart responses.
- **Next.js Fullstack**: Built on Next.js 13+ with App/Pages router.
- **Secure Authentication**: Includes `next-auth` for secure user sessions.
- **Tailwind CSS**: Fully responsive and modern UI.

## System Requirements
- **Node.js**: v18.x or higher is recommended.
- **Package Manager**: npm, yarn, or pnpm.

## Installation Instructions

1. **Clone and Install Dependencies**
   Navigate to the project directory and run:
   ```bash
   npm install
   ```

2. **Environment Variables**
   The application requires specific API keys and secrets to run securely. 
   Create a new file in the root directory named `.env.local` (this file is ignored by Git).
   
   Add the necessary environment variables:
   ```env
   GOOGLE_API_KEY="your-gemini-api-key"
   TWITCH_CLIENT_ID="your-twitch-client-id"
   TWITCH_CLIENT_SECRET="your-twitch-secret"
   NEXTAUTH_SECRET="your-nextauth-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

## Building for Production
To create an optimized production build, run:
```bash
npm run build
npm run start
```
