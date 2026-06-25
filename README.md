This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

# Next.js AI Twitch Chat Bot

An AI-powered Twitch Chat integration built with Next.js, Google Gemini API (`@google/genai`), and Twitch messaging (`tmi.js`). This application connects directly to any Twitch channel and uses generative AI to analyze or respond to chat messages in real-time.

## Features
- **Real-time Twitch Chat**: Connects to Twitch IRC via `tmi.js`.
- **Generative AI Integration**: Powered by Google's Gemini API for smart responses.
- **Next.js Fullstack**: Built on Next.js 13+ with App/Pages router.
- **Secure Authentication**: Includes `next-auth` for secure user sessions.
- **Tailwind CSS**: Fully responsive and modern UI.

---

## 🚀 Release Notes (Latest Enhancements)
- **Crimson Command Aesthetic**: Overhauled the UI design to a dark, brutalist "Mission Control" theme featuring pure black backgrounds, glowing red accents, and high-density industrial styling.
- **Fully Responsive Layout**: Removed width constraints; the dashboard now expands edge-to-edge dynamically (`w-full h-full`) across any monitor size.
- **Inline Error Handling**: Replaced intrusive browser alerts with smooth, inline chat UI error messages when the Gemini API hits a quota limit (429) or disconnects.
- **Token Analytics Chart**: Integrated `recharts` to render a visual graph in the Token Usage popup, tracking prompt and response LLM consumption per session.
- **Optimized UI Density**: Removed unnecessary padding, gaps, and margins between dashboard modules to create a monolithic, flush control panel.

---

## 🛠️ Setup & Installation Guide

### System Requirements
- **Node.js**: v18.x or higher is recommended.
- **Package Manager**: npm, yarn, or pnpm.

### 1. Clone and Install Dependencies
Navigate to the project directory and run:
```bash
npm install
```

### 2. Environment Variables (Important!)
The application requires specific API keys and secrets to run securely. 
Create a new file in the root directory named `.env.local`. **(Note: This file is securely ignored by Git so your keys will never be pushed).**

Add the necessary environment variables to your `.env.local` file:
```env
GOOGLE_API_KEY="your-gemini-api-key"
TWITCH_CLIENT_ID="your-twitch-client-id"
TWITCH_CLIENT_SECRET="your-twitch-secret"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Start the Development Server
First, run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Building for Production
To create an optimized production build, run:
```bash
npm run build
npm run start
```

## Learn More
To learn more about Next.js, take a look at the following resources:
- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!
