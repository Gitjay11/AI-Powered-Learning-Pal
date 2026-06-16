# 🧠 Lumen — AI-Powered Learning Pal

> Personalized adaptive learning with an AI tutor and a human teacher in the loop.

Lumen is a full-stack web app that delivers adaptive coding and language lessons. It pairs an AI tutor (powered by Google Gemini) with real teacher oversight — students learn at their own pace while teachers are automatically alerted when someone is struggling.

---

## ✨ Features

### For Students
- **Adaptive Lessons** — Structured tracks with ordered lessons in coding and languages
- **AI Tutor Chat** — Conversational, Socratic guidance per lesson using Google Gemini Flash. Never gives away answers — guides with hints
- **AI-Generated Practice Quizzes** — Dynamic multiple-choice questions generated from lesson content by the AI
- **Personalized Dashboard** — Tracks completion %, day streak, quiz trend sparkline, weak concepts, and risk status
- **Smart Next-Action Engine** — Recommends what to do next: continue, revise a weak topic, retry a quiz, open the tutor, or wait for teacher review
- **Progress Tracking** — Per-lesson attempt and score history with concept-level mastery scores
- **Teacher Notes** — Students see any feedback or notes left by their teacher directly in their dashboard

### For Teachers
- **Teacher Dashboard** — Full class overview with risk levels, open flags, and completion rates
- **Risk Scoring Engine** — Transparent, multi-signal risk score (0–100) per student computed automatically on every quiz attempt and dashboard load
- **Auto-Flagging** — Students are automatically flagged when they fail a concept 3+ times or repeatedly ask the tutor for help on the same topic
- **Intervention Tools** — Teachers can leave notes, assign revisions, recommend tutor sessions, clear flags, and log reviews
- **Student Deep-Dive** — Per-student view with full lesson history, chat logs, mastery breakdown, flags, interventions, and recommendation history
- **Cohort Filters** — Filter students by track, risk level, or unresolved flags; search by name or email
- **Cohort Metrics** — Aggregate stats: open flags, avg completion, risk breakdown, top weak concepts across all students

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React SSR) + [TanStack Router](https://tanstack.com/router) |
| Build Tool | [Vite](https://vitejs.dev/) v7 |
| Language | TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives) |
| Database & Auth | [Supabase](https://supabase.com/) (PostgreSQL + Row Level Security) |
| AI | Google Gemini Flash (via Lovable AI Gateway) |
| Deployment | [Cloudflare Workers](https://workers.cloudflare.com/) (via `@cloudflare/vite-plugin`) |
| Data Fetching | [TanStack Query](https://tanstack.com/query) |
| Forms | React Hook Form + Zod |

---

## 🗄️ Database Schema

The app uses Supabase with Row Level Security enforced on every table.

| Table | Purpose |
|---|---|
| `profiles` | User profile, selected track, last active timestamp |
| `user_roles` | `student` or `teacher` role per user |
| `tracks` | Learning tracks (e.g., "Python Basics", "Spanish A1") |
| `lessons` | Ordered lessons within a track, with content and concept tags |
| `student_progress` | Per-student, per-lesson attempt/score/status |
| `chat_messages` | Full AI tutor conversation history per student per lesson |
| `topic_mastery` | Per-concept mastery score (correct / attempts) per student |
| `risk_scores` | Computed risk level (`healthy` / `attention` / `at_risk`) with reasons |
| `flags` | Auto-generated or teacher-created alerts on struggling students |
| `intervention_logs` | Teacher actions: notes, assigned revisions, cleared flags, etc. |
| `recommendation_history` | Personalized next-action recommendations served to each student |
| `analytics_events` | Event logging for product analytics |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project
- A Lovable AI Gateway API key (for AI tutor features)

### 1. Clone the repo

```bash
git clone https://github.com/Gitjay11/AI-Powered-Learning-Pal.git
cd AI-Powered-Learning-Pal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

> For AI tutor features, you also need `LOVABLE_API_KEY` set as a server-side environment variable (not exposed to the client).

### 4. Run the database migrations

In your Supabase project dashboard, run the SQL migration files found in `/supabase/migrations/` in chronological order.

### 5. Start the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:8080**

---

## 📁 Project Structure

```
src/
├── routes/
│   ├── index.tsx               # Landing page
│   ├── login.tsx               # Login page
│   ├── signup.tsx              # Sign-up page
│   └── _app/
│       ├── dashboard.tsx       # Student dashboard
│       ├── learn.tsx           # Lesson browser
│       ├── lesson.$lessonId.tsx # Lesson view with AI tutor chat
│       ├── onboarding.tsx      # Track selection + teacher access code
│       ├── progress.tsx        # Student progress overview
│       ├── teacher.index.tsx   # Teacher class dashboard
│       └── teacher.$studentId.tsx # Teacher deep-dive per student
├── lib/
│   ├── learning.functions.ts   # Tracks, lessons, quiz attempts, progress
│   ├── tutor.functions.ts      # AI chat, AI-generated practice questions
│   ├── dashboard.functions.ts  # Student dashboard data + recommendation engine
│   ├── risk.functions.ts       # Risk scoring engine + mastery updates
│   ├── intervention.functions.ts # Teacher dashboard + intervention logging
│   ├── analytics.functions.ts  # Event logging
│   └── auth-context.tsx        # Auth state (user, role)
├── integrations/supabase/      # Supabase client + auth middleware
└── components/ui/              # shadcn/ui component library
supabase/
└── migrations/                 # PostgreSQL schema migrations
```

---

## 🧮 Risk Scoring Engine

The risk engine (`src/lib/risk.functions.ts`) computes a transparent 0–100 risk score per student using weighted signals:

| Signal | Weight | Trigger |
|---|---|---|
| Low quiz average | 25 | Avg score < 50% |
| High failure rate | 20 | >50% of attempts failed (min 3) |
| Slow progress | 15 | <20% track complete after 7 days |
| Inactivity | 20 | No activity for 7+ days |
| Concept blockers | 15 | 2+ concepts with mastery < 40% after 3 attempts |
| High tutor reliance | 5 | >15 tutor messages per lesson |
| Open high-severity flag | 10 | Unresolved high flag exists |

- Score ≥ 50 → **At risk** 🔴
- Score ≥ 25 → **Needs attention** 🟡
- Score < 25 → **Healthy** 🟢

---

## 🧑‍🏫 User Roles

| Role | How to get it | What they can do |
|---|---|---|
| **Student** | Default on sign-up | Learn, chat with AI tutor, view own dashboard |
| **Teacher** | Enter access code during onboarding | View all students, risk scores, chat logs, write notes, log interventions |

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server on port 8080 |
| `npm run build` | Production build (Cloudflare Workers) |
| `npm run build:dev` | Development build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT — feel free to use, modify, and distribute.
