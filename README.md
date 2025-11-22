# Profile Quest 🎮

## 🚀 Check it out - https://profile-quest-nottanjune-tanmays-projects-01b4bb4f.vercel.app 

## Overview

Profile Quest turns personal upskilling into a game. Users create an AI persona 🤖, get a tailored avatar ✨, and receive level‑appropriate quests that persist across sessions. Progression (XP/level) updates quests’ difficulty over time.

## 🏗️ Architecture (High‑level) 
### 🎨 Client (React + Tailwind) 
 - Pages: Dashboard 📊, Persona Builder 👤, Quest Board 🎯, Profile 🧑‍💻, Login 🔑
 - State: Auth session (AuthContext via MongoDB), lightweight local cache for quick UX
 - Calls the API for persona generation, avatar generation, quest generation/saving, progress, and persona lookup

### ⚙️ API Server (Node + Express) 
 - REST endpoints under `/api/*`
 - Business logic: persona generation, avatar generation, quest generation, dedupe, save/fetch, progress calc, quest completion, deletion
 - Uses MongoDB (Postgres) via service key for reads/writes
 - Calls Groq for text (quests) and Gemini for images (avatar), with DiceBear fallback

### 💾 Database (MongoDB) 
 - `profiles`(`id` uuid PK, `email` text, `name` text, `level` int, `xp` int, `next_level_xp` int, `updated_at` timestamptz)
 - `personas`(`user_id` text PK, `persona_type` text, `attributes` jsonb, `avatar` text, `updated_at` timestamptz)
 - `quests`(`id` bigserial PK, `user_id` text, `title` text, `description` text, `category` text, `xp_reward` int, `status` text, `created_at` timestamptz)
 - Unique composite index on `quests`(`user_id`, `title`) for upserts/deduping

### 🛠️ Services & Tech Used
#### Frontend
 - React, React Router, TailwindCSS, Webpack

#### Auth & Data
 - MongoDB Auth (client) and Mongoose Postgres (server: service role key)

#### 🧠 AI 
 - Groq (quest generation; dedup-aware prompts)
 - Google Gemini via `@google/genai` (avatar image generation; 1024×1024, down/upsized in UI as needed)


## ⭐ Key Features 
### 🛠️ Persona Builder 
 - Inputs: Current Role, Proficiency (1–5), Interests, Strengths, Goals
 - Single action: “Generate Persona & Avatar” triggers persona + avatar + starter quests
 - Loader UX for long‑running calls; up to 2 regenerations allowed

### ✨ Avatar Generation 
 - Uses persona context + optional reference image
 - Persisted in DB (`personas.avatar`) and shown on Dashboard (“Your Journey”)

### 🎯 Quest System 
 - Tailored quests from Groq, difficulty scales with level
 - Duplicate/near‑duplicate prevention in prompt + server‑side exact title dedup
 - Complete quest → XP/level update; auto‑refill Dashboard list; “Generate More” on demand
 - Delete quest (Dashboard/Quest Board) with consistent UI and DB removal

### 📈 Progress & Persistence 
 - Server returns canonical progress (`/api/progress`), including name
 - Dashboard greets with DB name; persona/avatar are loaded from DB

### 🤝 Auth & UX 
 - MongoDB session handling, robust logout route, name resolution from `profiles.name`

