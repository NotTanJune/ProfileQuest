# ProfileQuest: Career Persona Builder
## 24-Hour Hackathon Specification

**Version:** Hackathon MVP  
**Date:** October 18, 2025  
**Timeline:** 24 Hours  
**Author:** Manus AI

---

## Executive Summary

ProfileQuest is a gamified career development web app where users build their "career persona" like an RPG character. This specification is optimized for a **24-hour hackathon** while maintaining all core features: persona builder, quest system, gear/avatars, endorsements, peer duels, LinkedIn sharing, and AI-generated story chapters.

The key to success is **smart simplification**: use Groq AI to generate content dynamically, leverage pre-built UI libraries, use simple data structures, and focus on functional prototypes over polish.

---

## Core Features (All Included)

### 1. Career Persona Builder ✅
- Quick 5-question assessment
- AI generates persona with Groq
- Simple attribute display (no complex allocation)
- Visual avatar representation

### 2. Quest System ✅
- AI-generated personalized quests
- Quest categories: Skill Dev, Portfolio, Networking, Thought Leadership
- Accept, track, and complete quests
- Simple URL submission for evidence

### 3. Gamification ✅
- XP and leveling system
- Visual gear unlocks (badges/icons)
- Progress visualization

### 4. Endorsements ✅
- Peer endorsement requests
- Simple approval flow
- Display on profile

### 5. Peer Duels ✅
- Challenge friends to quest competitions
- Track who completes more quests in timeframe
- Simple leaderboard

### 6. Story Chapters ✅
- AI-generated career narrative at milestones
- Unlocks every 3-5 levels
- Uses Groq Compound for current market insights

### 7. LinkedIn Sharing ✅
- Generate shareable career avatar card (image)
- Copy-paste text for LinkedIn post
- Public profile link

---

## Tech Stack (Speed-Optimized)

| Component | Technology | Why |
|-----------|-----------|-----|
| **Framework** | Next.js 14 (App Router) | Fast setup, API routes built-in, easy deployment |
| **Styling** | Tailwind CSS + shadcn/ui | Pre-built components, rapid styling |
| **Database** | Supabase (PostgreSQL) | Free tier, instant setup, auth included |
| **Auth** | Supabase Auth | Built-in, 5-minute setup |
| **AI** | Groq API | Ultra-fast inference, OpenAI-compatible |
| **State** | React Context (built-in) | No extra dependencies |
| **Deployment** | Heroku | One-click deploy from GitHub |

---

## Simplified Architecture

```
┌─────────────────────────────────────┐
│   Next.js Frontend + API Routes     │
│   - All pages and API in one app    │
│   - No separate backend needed      │
└─────────────────────────────────────┘
           │              │
           ▼              ▼
    ┌──────────┐    ┌──────────┐
    │ Supabase │    │ Groq API │
    │ Database │    │ AI Gen   │
    └──────────┘    └──────────┘
```

---

## Database Schema (Minimal)

### Tables (5 total)

**users** (handled by Supabase Auth)
```sql
-- Supabase creates this automatically
```

**personas**
```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  persona_type TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  attributes JSONB, -- {logic: 5, creativity: 3, ...}
  gear JSONB, -- ["helmet_1", "badge_2"]
  created_at TIMESTAMP DEFAULT NOW()
);
```

**quests**
```sql
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  xp_reward INTEGER,
  status TEXT DEFAULT 'available', -- available, in_progress, completed
  evidence_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**endorsements**
```sql
CREATE TABLE endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  quest_id UUID REFERENCES quests(id),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**duels**
```sql
CREATE TABLE duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES auth.users(id),
  opponent_id UUID REFERENCES auth.users(id),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 24-Hour Development Timeline

### Hour 0-2: Setup & Foundation
**Goal:** Get the project running

- [ ] Create Next.js project: `npx create-next-app@latest profilequest`
- [ ] Install dependencies: `shadcn/ui`, `@supabase/supabase-js`, `groq-sdk`
- [ ] Set up Supabase project (free tier)
- [ ] Create database tables (run SQL above)
- [ ] Configure environment variables
- [ ] Set up Supabase Auth (email/password)
- [ ] Create basic layout with navigation

**Deliverable:** App runs locally, database connected, auth working

---

### Hour 3-6: Persona Builder + AI Integration
**Goal:** Users can create their career persona

- [ ] Build 5-question assessment form
- [ ] Integrate Groq API for persona generation
- [ ] Create persona display component
- [ ] Save persona to database
- [ ] Simple avatar visualization (use emoji or icons)

**AI Prompt Example:**
```javascript
const prompt = `Based on this assessment, create a career persona:
Interests: ${interests}
Strengths: ${strengths}
Goals: ${goals}

Return JSON:
{
  "persona_type": "Software Developer",
  "attributes": {"logic": 8, "creativity": 6, "communication": 5},
  "starting_quests": ["Build a portfolio website", "Contribute to open source"]
}`;
```

**Deliverable:** Users can create and view their persona

---

### Hour 7-10: Quest System
**Goal:** Generate, display, and track quests

- [ ] Create quest board UI (card grid)
- [ ] AI quest generation endpoint
- [ ] Accept quest functionality
- [ ] Quest tracking (in_progress status)
- [ ] Complete quest with URL submission
- [ ] XP award and level-up logic

**Quest Generation Prompt:**
```javascript
const prompt = `Generate 5 career quests for a ${personaType} at level ${level}.
Categories: Skill Development, Portfolio Building, Networking, Thought Leadership

Return JSON array:
[{
  "title": "...",
  "description": "...",
  "category": "...",
  "xp_reward": 100
}]`;
```

**Deliverable:** Users can see, accept, and complete quests

---

### Hour 11-13: Gamification (XP, Levels, Gear)
**Goal:** Visual progression system

- [ ] XP bar component
- [ ] Level-up detection and notification
- [ ] Gear unlock system (simple badge icons)
- [ ] Profile page showing stats
- [ ] Progress visualization

**Gear System (Simplified):**
```javascript
const GEAR_UNLOCKS = {
  3: ["bronze_badge"],
  5: ["silver_badge", "code_helmet"],
  10: ["gold_badge", "data_sword"],
  15: ["platinum_badge", "manager_shield"]
};
```

**Deliverable:** Users see XP, levels, and unlock gear

---

### Hour 14-16: Social Features (Endorsements + Duels)
**Goal:** Peer interaction

**Endorsements:**
- [ ] Request endorsement button on completed quests
- [ ] Endorsement form (simple message)
- [ ] Display endorsements on profile
- [ ] Notification system (simple badge count)

**Duels:**
- [ ] Challenge friend form (enter email/username)
- [ ] Duel dashboard showing active duels
- [ ] Quest count comparison
- [ ] Winner determination at end date

**Deliverable:** Users can endorse each other and compete in duels

---

### Hour 17-19: Story Chapters
**Goal:** AI-generated career narrative

- [ ] Trigger story chapter at levels 5, 10, 15
- [ ] Use Groq Compound for web-search enhanced stories
- [ ] Story chapter display (modal or dedicated page)
- [ ] Save chapters to database

**Story Prompt:**
```javascript
const prompt = `Create an engaging story chapter for a ${personaType} who reached level ${level}.

Completed quests: ${questTitles.join(", ")}

Include:
1. Reflection on their journey
2. Current market trends for ${personaType} (use web search)
3. Next steps and opportunities
4. Inspirational message

Write 200-300 words in narrative style.`;
```

**Deliverable:** Users unlock story chapters at milestones

---

### Hour 20-22: LinkedIn Sharing
**Goal:** Shareable career avatar

- [ ] Generate avatar card image (use HTML canvas or library)
- [ ] Include: persona type, level, top stats, gear icons
- [ ] Download image functionality
- [ ] Copy LinkedIn post text
- [ ] Public profile page (shareable URL)

**Card Contents:**
```
┌─────────────────────────────┐
│  ProfileQuest Career Avatar │
│                             │
│  [Avatar Icon]              │
│  Level 8 Software Developer │
│                             │
│  🎯 15 Quests Completed     │
│  ⭐ 5 Endorsements          │
│  🏆 Gold Badge Unlocked     │
│                             │
│  profilequest.app/user/123  │
└─────────────────────────────┘
```

**Deliverable:** Users can share their progress on LinkedIn

---

### Hour 23-24: Polish & Deploy
**Goal:** Make it demo-ready

- [ ] Fix critical bugs
- [ ] Add loading states
- [ ] Improve error handling
- [ ] Write README
- [ ] Deploy to Heroku
- [ ] Test full user flow
- [ ] Prepare demo script

**Deliverable:** Live, working demo

---

## Implementation Shortcuts (Time-Savers)

### 1. Use shadcn/ui Components
Pre-built, copy-paste components:
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input dialog
```

### 2. Supabase Quick Setup
```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

### 3. Groq Integration (Simple)
```javascript
// lib/groq.js
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generatePersona(assessment) {
  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: createPrompt(assessment) }],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
  });
  
  return JSON.parse(completion.choices[0].message.content);
}
```

### 4. Simple Avatar System
Use emoji combinations instead of complex graphics:
```javascript
const AVATARS = {
  "Software Developer": "👨‍💻",
  "Data Scientist": "📊",
  "Product Manager": "📋",
  "UX Designer": "🎨",
  "Researcher": "🔬",
  "Marketing Specialist": "📢"
};
```

### 5. Hardcode Initial Data
Don't build admin panels, just seed data:
```javascript
const PERSONA_TYPES = [
  "Software Developer",
  "Data Scientist", 
  "Product Manager",
  "UX Designer",
  "Researcher",
  "Marketing Specialist"
];
```

---

## API Endpoints (Minimal Set)

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/user

POST   /api/persona/create
GET    /api/persona/[userId]
PUT    /api/persona/[userId]

GET    /api/quests/generate
POST   /api/quests/accept
POST   /api/quests/complete
GET    /api/quests/user

POST   /api/endorsements/create
GET    /api/endorsements/[userId]

POST   /api/duels/create
GET    /api/duels/[userId]

POST   /api/story/generate
GET    /api/story/[userId]

GET    /api/share/[userId]
```

---

## File Structure

```
profilequest/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── dashboard/page.tsx       # Main dashboard
│   ├── persona/create/page.tsx  # Persona builder
│   ├── quests/page.tsx          # Quest board
│   ├── profile/[id]/page.tsx    # User profile
│   ├── duels/page.tsx           # Duels dashboard
│   └── api/
│       ├── persona/route.ts
│       ├── quests/route.ts
│       ├── endorsements/route.ts
│       ├── duels/route.ts
│       └── story/route.ts
├── components/
│   ├── PersonaCard.tsx
│   ├── QuestCard.tsx
│   ├── XPBar.tsx
│   ├── GearDisplay.tsx
│   ├── EndorsementList.tsx
│   └── DuelCard.tsx
├── lib/
│   ├── supabase.ts
│   ├── groq.ts
│   └── utils.ts
└── .env.local
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

---

## Critical Path (Must-Haves)

If you're running out of time, prioritize in this order:

1. **Persona Builder** (Hour 3-6) - Core feature
2. **Quest System** (Hour 7-10) - Core feature
3. **XP/Levels** (Hour 11-13) - Makes it gamified
4. **Story Chapters** (Hour 17-19) - Unique differentiator
5. **LinkedIn Sharing** (Hour 20-22) - Demo wow factor
6. **Endorsements** (Hour 14-15) - Nice to have
7. **Duels** (Hour 15-16) - Nice to have

---

## Demo Script (5 Minutes)

**Minute 1: Problem**
"Career development is boring and overwhelming for young professionals. We made it fun."

**Minute 2: Persona Creation**
[Live demo] "Answer 5 questions, AI creates your career persona in seconds."

**Minute 3: Quest System**
[Live demo] "Get personalized quests. Complete them. Level up. Unlock gear."

**Minute 4: Social Features**
[Live demo] "Get endorsed by peers. Challenge friends to duels. Read your AI-generated story."

**Minute 5: LinkedIn Integration**
[Live demo] "Share your career avatar on LinkedIn. Stand out from the crowd."

---

## Testing Checklist

Before demo:
- [ ] User can sign up and log in
- [ ] Persona creation works end-to-end
- [ ] At least 3 quests generate successfully
- [ ] Completing a quest awards XP
- [ ] Level-up triggers correctly
- [ ] Gear unlocks at right levels
- [ ] Story chapter generates at level 5
- [ ] Endorsement can be given
- [ ] Duel can be created
- [ ] Share card generates
- [ ] Mobile responsive (basic)

---

## Common Pitfalls to Avoid

1. **Over-engineering**: Don't build a perfect system, build a working demo
2. **Authentication complexity**: Use Supabase Auth, don't build custom
3. **UI polish**: Use shadcn/ui, don't design from scratch
4. **Complex state management**: React Context is enough
5. **Testing everything**: Test happy path only
6. **Deployment issues**: Deploy early (hour 12) to catch issues

---

## Success Metrics for Hackathon

**Technical:**
- All 7 core features working
- No critical bugs in demo flow
- Deployed and accessible via URL

**Presentation:**
- Clear problem statement
- Engaging live demo
- Unique AI integration showcased
- LinkedIn sharing as wow moment

**Innovation:**
- Novel approach to career development
- Smart use of Groq AI
- Gamification that actually motivates

---

## Post-Hackathon Roadmap (If You Win)

### Week 1-2: Polish
- Improve UI/UX
- Add animations
- Better error handling
- Mobile optimization

### Week 3-4: Scale
- Add more persona types
- Expand quest library
- Improve AI prompts
- Add analytics

### Month 2-3: Monetize
- Premium features
- Company partnerships
- Certification programs

---

## Quick Start Commands

```bash
# Create project
npx create-next-app@latest profilequest --typescript --tailwind --app

# Install dependencies
cd profilequest
npm install @supabase/supabase-js groq-sdk
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input dialog badge progress

# Set up environment
cp .env.example .env.local
# Add your API keys

# Run development server
npm run dev

# Deploy to Heroku
heroku deploy
```

---

## Resources

**Groq:**
- Quickstart: https://console.groq.com/docs/quickstart
- Models: https://console.groq.com/docs/models

**Supabase:**
- Quickstart: https://supabase.com/docs/guides/getting-started
- Auth: https://supabase.com/docs/guides/auth

**shadcn/ui:**
- Components: https://ui.shadcn.com/docs/components

**Next.js:**
- App Router: https://nextjs.org/docs/app

---

## Final Tips

1. **Start with data flow**: Get data flowing from DB → API → UI before making it pretty
2. **AI first**: Test Groq prompts in playground before coding
3. **Deploy early**: Push to Heroku at hour 12 to avoid last-minute issues
4. **Commit often**: Git commit every hour in case you need to rollback
5. **Sleep is optional**: But coffee is mandatory ☕
6. **Have fun**: This is a cool idea, enjoy building it!

---

**Good luck with your hackathon! 🚀**

**Questions during build?** Refer back to this spec for implementation details.

**Remember:** Working > Perfect. Ship it! 🎯

