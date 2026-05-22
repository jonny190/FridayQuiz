# FridayQuiz Web-Based Modernization Plan

## 1. System Overview

### Current System (Email-Based)
- **Quiz Distribution**: DOCX files sent via email attachments
- **Team Management**: Email-based, no digital tracking
- **Answer Collection**: Teams reply via email with answers
- **Results Tracking**: Excel spreadsheets sent via email
- **Team Size**: 30+ teams, 1 contact per team

### Target System (Web-Based)
A full-stack web application that digitizes the entire quiz lifecycle from creation to results distribution.

---

## 2. Tech Stack Recommendation

### Frontend
- **Framework**: Next.js 14+ (App Router) with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui component library
- **State Management**: React Query (TanStack Query) for server state
- **Forms**: React Hook Form + Zod validation

### Backend
- **Framework**: Next.js API Routes (or standalone Fastify/Express if needed)
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: Magic link-based (email magic links via NextAuth.js or custom)
- **File Processing**: 
  - `mammoth.js` for DOCX parsing
  - `xlsx` or `exceljs` for Excel export

### Infrastructure
- **Hosting**: Vercel (frontend/API) + Supabase/Neon (PostgreSQL)
- **Storage**: AWS S3 or Vercel Blob Storage for DOCX attachments
- **Email**: Resend or SendGrid for magic links and result notifications
- **Deployment**: CI/CD via GitHub Actions

---

## 3. Database Schema (Prisma)

```prisma
// Schema Overview

// Users & Authentication
User {
  id              String   @id @default(uuid())
  email           String   @unique
  magicToken      String?  @unique
  magicTokenExpiry DateTime?
  firstName       String?
  lastName        String?
  role            Role     @default(MEMBER)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  team            Team?    @relation(fields: [teamId], references: [id])
  teamId          String?
  teamMembers     TeamMember[]
  quizAnswers     QuizAnswer[]
}

// Team Management
Team {
  id              String   @id @default(uuid())
  name            String
  contactEmail    String
  contactUser     User?    @relation(fields: [contactUserId], references: [id])
  contactUserId   String?  @unique
  quizmasterId    String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  members         TeamMember[]
  quizResults     QuizResult[]
}

// Team Members (no login, invited via magic link)
TeamMember {
  id              String   @id @default(uuid())
  user            User     @relation(fields: [userId], references: [id])
  userId          String
  team            Team     @relation(fields: [teamId], references: [id])
  teamId          String
  role            MemberRole @default(MEMBER)
  invitedAt       DateTime @default(now())

  @@unique([userId, teamId])
}

// Quizzes
Quiz {
  id              String   @id @default(uuid())
  number          Int      @unique
  title           String?
  date            DateTime
  status          QuizStatus @default(DRAFT)
  docxFileUrl     String?
  uploadedBy      String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  questions       Question[]
  results         QuizResult[]
}

// Questions
Question {
  id              String   @id @default(uuid())
  quiz            Quiz     @relation(fields: [quizId], references: [id])
  quizId          String
  order           Int
  type            QuestionType
  text            String
  imageUrl        String?
  answer          String   // The correct answer
  explanation     String?
  points          Float    @default(1)
  isImageBased    Boolean  @default(false)  // Questions with images that need visual recognition
  createdAt       DateTime @default(now())
}

// Quiz Answers (Team submissions)
QuizAnswer {
  id              String   @id @default(uuid())
  quiz            Quiz     @relation(fields: [quizId], references: [id])
  quizId          String
  question        Question @relation(fields: [questionId], references: [id])
  questionId      String
  team            Team     @relation(fields: [teamId], references: [id])
  teamId          String
  answer          String
  points          Float?
  submittedBy     String
  submittedAt     DateTime @default(now())
  isDraft         Boolean  @default(false)  // Suggested/unsubmitted answers

  @@unique([quizId, questionId, teamId])
}

// Suggestions (Team internal voting on answers)
Suggestion {
  id              String   @id @default(uuid())
  team            Team     @relation(fields: [teamId], references: [id])
  teamId          String
  quiz            Quiz     @relation(fields: [quizId], references: [id])
  quizId          String
  question        Question @relation(fields: [questionId], references: [id])
  questionId      String
  suggestedAnswer String
  suggestedBy     String
  upvotes         Int      @default(0)
  createdAt       DateTime @default(now())

  @@unique([quizId, questionId, suggestedAnswer])
}

// Quiz Results (Final scores after quizmaster grading)
QuizResult {
  id              String   @id @default(uuid())
  quiz            Quiz     @relation(fields: [quizId], references: [id])
  quizId          String
  team            Team     @relation(fields: [teamId], references: [id])
  teamId          String
  totalScore      Float
  rank            Int?
  excelFileUrl    String?
  publishedAt     DateTime?
  published       Boolean  @default(false)

  answers         QuizAnswer[]
}

// Enums
enum Role {
  QUIZMASTER
  TEAM_CONTACT
  MEMBER
}

enum MemberRole {
  OWNER
  MEMBER
}

enum QuizStatus {
  DRAFT
  ACTIVE
  GRADED
  PUBLISHED
  ARCHIVED
}

enum QuestionType {
  TEXT
  IMAGE
  MULTIPLE_CHOICE
  NUMERIC
  WORD_SCRAMBLE
}
```

---

## 4. API Endpoints

### Authentication
```
POST   /api/auth/send-magic-link       # Send magic link to email
POST   /api/auth/verify-magic-link     # Verify magic link and create session
POST   /api/auth/logout                # End session
GET    /api/auth/me                    # Get current user
```

### Quiz Management (Quizmaster only)
```
POST   /api/quizzes                    # Create new quiz
GET    /api/quizzes                    # List all quizzes
GET    /api/quizzes/[id]               # Get quiz details
PATCH  /api/quizzes/[id]               # Update quiz
DELETE /api/quizzes/[id]               # Delete quiz
POST   /api/quizzes/[id]/upload        # Upload DOCX file
POST   /api/quizzes/[id]/parse         # Parse DOCX and extract questions
POST   /api/quizzes/[id]/publish       # Publish quiz to teams
POST   /api/quizzes/[id]/grade         # Grade team answers
POST   /api/quizzes/[id]/export-excel  # Export results to Excel
```

### Questions
```
GET    /api/quizzes/[id]/questions     # List questions
POST   /api/quizzes/[id]/questions     # Add question
PATCH  /api/quizzes/[id]/questions/[qid] # Update question
DELETE /api/quizzes/[id]/questions/[qid] # Delete question
```

### Team Management (Quizmaster & Team Contacts)
```
GET    /api/teams                      # List teams
GET    /api/teams/[id]                 # Get team details
POST   /api/teams                      # Create team (quizmaster only)
PATCH  /api/teams/[id]                 # Update team
DELETE /api/teams/[id]                 # Deactivate team
POST   /api/teams/[id]/members         # Add member
GET    /api/teams/[id]/members         # List members
DELETE /api/teams/[id]/members/[uid]   # Remove member
POST   /api/teams/contact/invite       # Send contact invitation
```

### Team Member Features
```
GET    /api/my-quiz/[quizId]           # Get current quiz for answering
POST   /api/my-quiz/[quizId]/answer    # Submit answer (or save as draft)
POST   /api/my-quiz/[quizId]/draft     # Save suggested answer
POST   /api/my-quiz/[quizId]/suggestion/upvote  # Upvote a suggestion
GET    /api/my-quiz/[quizId]/suggestions  # View team's suggestions
```

### Results
```
GET    /api/results/[quizId]           # Get quiz results (quizmaster only)
GET    /api/results/[quizId]/team      # Get team's results (team member)
POST   /api/results/[quizId]/export    # Export results
GET    /api/leaderboard/[quizId]       # Get leaderboard for a quiz
GET    /api/leaderboard                # Get overall leaderboard
```

---

## 5. Frontend Pages & Components

### Public Pages
| Page | Description |
|------|-------------|
| `/auth/login` | Magic link login page |
| `/auth/verify` | Magic link verification page |

### Quizmaster Dashboard
| Page | Description |
|------|-------------|
| `/quizmaster/dashboard` | Overview of quizzes, teams, recent results |
| `/quizmaster/quizzes` | Quiz list management |
| `/quizmaster/quizzes/new` | Create new quiz |
| `/quizmaster/quizzes/[id]/edit` | Edit quiz questions |
| `/quizmaster/quizzes/[id]/upload` | Upload DOCX file |
| `/quizmaster/quizzes/[id]/grading` | Grade team submissions |
| `/quizmaster/quizzes/[id]/results` | View/publish results |
| `/quizmaster/teams` | Manage teams and contacts |
| `/quizmaster/teams/new` | Create new team |
| `/quizmaster/teams/[id]` | Team details |

### Team Dashboard (Contacts & Members)
| Page | Description |
|------|-------------|
| `/team/dashboard` | Overview of active quizzes, scores |
| `/team/quiz/[id]` | Take the quiz, submit answers |
| `/team/quiz/[id]/suggestions` | View/submit answer suggestions |
| `/team/results/[quizId]` | View quiz results |
| `/team/leaderboard` | View team rankings |
| `/team/settings` | Team settings (contact manages) |
| `/team/members` | Manage team members |

### Shared Components
```
components/
├── auth/
│   ├── MagicLinkForm.tsx
│   └── VerifyPage.tsx
├── quizzes/
│   ├── QuizCard.tsx
│   ├── QuizEditor.tsx
│   ├── QuestionInput.tsx
│   ├── QuestionPreview.tsx
│   └── DOCXParser.tsx
├── grading/
│   ├── GradingPanel.tsx
│   ├── AnswerComparison.tsx
│   └── BulkGrader.tsx
├── teams/
│   ├── TeamCard.tsx
│   ├── MemberList.tsx
│   ├── MemberInvite.tsx
│   └── ContactSettings.tsx
├── results/
│   ├── ResultsTable.tsx
│   ├── Leaderboard.tsx
│   ├── ScoreCard.tsx
│   └── ExcelExporter.tsx
├── suggestions/
│   ├── SuggestionBoard.tsx
│   ├── AnswerSuggestion.tsx
│   └── UpvoteButton.tsx
├── layout/
│   ├── DashboardLayout.tsx
│   ├── Sidebar.tsx
│   └── Header.tsx
└── ui/
    ├── Button.tsx
    ├── Input.tsx
    ├── Modal.tsx
    ├── Table.tsx
    ├── Badge.tsx
    └── Toast.tsx
```

---

## 6. DOCX Parsing Logic

### Input Format (from examples)
```
Friday Quiz 17th April 2026

What music festival has just taken place in the Colorado desert?  

Where did a Roman Emperor triumph in the north-west last weekend?

Which island in the Atlantic is known for the sweet, fortified wine produced there?
```

### Answers DOCX Format
```
Friday Quiz 17th April 2026

What music festival has just taken place in the Colorado desert?  Coachella

Where did a Roman Emperor triumph in the north-west last weekend?  Aintree. I Am Maximus won the Grand National
```

### Parsing Steps
1. Extract text from DOCX using `mammoth.js`
2. Split into question-answer pairs (questions alternate with answers)
3. Detect paired answers by matching question/answer document line numbers
4. Handle edge cases:
   - Questions with images (flag for manual review)
   - Multi-line answers
   - Partial answers with explanations
5. Present parsed data for quizmaster review before publishing

---

## 7. Magic Link Authentication Flow

```
1. User enters email on login page
2. System generates UUID token + expiry (24 hours)
3. System stores hashed token in database
4. System sends email with magic link: /auth/verify?token=xxx
5. User clicks link → system verifies token
6. System creates/finds user account
7. If new user → prompts for team assignment
8. If existing user → creates session, redirects to dashboard
9. Token is invalidated after single use
```

---

## 8. Results Format (from Excel examples)

Current format per quiz:
| Team | Total | Q1 | Q2 | Q3 | ... | Q20 |
|------|-------|----|----|----|-----|-----|
| Twenty Two Over Seven | 20 | 1 | 1 | 1 | ... | 1 |
| Thelma & Louise & Their Toy Boys | 19 | 1 | 1 | 1 | ... | 1 |

Features:
- Teams earn 1 point per correct answer (or 0.5 for partial)
- 20 questions per quiz (varies)
- Overall ranking by total score
- Individual question breakdown

---

## 9. Implementation Milestones

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project scaffolding (Next.js + TypeScript + Tailwind)
- [ ] Database setup (PostgreSQL + Prisma schema)
- [ ] Authentication system (magic link flow)
- [ ] Basic UI components (shadcn/ui setup)
- [ ] Dashboard layout with sidebar navigation

### Phase 2: Quiz Management (Weeks 3-4)
- [ ] Quiz CRUD operations
- [ ] Question CRUD operations
- [ ] DOCX file upload & parsing
- [ ] Question editing interface
- [ ] Quiz publishing workflow

### Phase 3: Team Management (Weeks 5-6)
- [ ] Team CRUD operations
- [ ] Contact management
- [ ] Member invitation system
- [ ] Team settings page
- [ ] Role-based access control

### Phase 4: Quiz Taking (Weeks 7-8)
- [ ] Quiz taking interface for teams
- [ ] Answer submission (save as draft)
- [ ] Suggestion system with upvoting
- [ ] Team answer board
- [ ] Progress tracking

### Phase 5: Grading & Results (Weeks 9-10)
- [ ] Quizmaster grading interface
- [ ] Bulk grading tools
- [ ] Results calculation
- [ ] Excel export
- [ ] Results publishing & notifications

### Phase 6: Polish & Launch (Weeks 11-12)
- [ ] Leaderboard pages
- [ ] Overall statistics
- [ ] Mobile responsive improvements
- [ ] Performance optimization
- [ ] User testing & bug fixes
- [ ] Documentation
- [ ] Production deployment

---

## 10. Project Structure

```
FridayQuiz/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── auth/
│   │   ├── (dashboard)/
│   │   │   ├── quizmaster/
│   │   │   ├── team/
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── quizzes/
│   │   │   ├── teams/
│   │   │   ├── results/
│   │   │   └── suggestions/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/
│   │   ├── quizzes/
│   │   ├── grading/
│   │   ├── teams/
│   │   ├── results/
│   │   ├── suggestions/
│   │   ├── layout/
│   │   └── ui/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── email.ts
│   │   ├── docx-parser.ts
│   │   ├── excel-export.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts
│   └── hooks/
│       ├── useAuth.ts
│       ├── useQuizzes.ts
│       └── useTeams.ts
├── public/
│   └── images/
├── docs/
│   ├── PLAN.md
│   └── API.md
├── .env.example
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 11. Key Features Summary

| Feature | Description | Priority |
|---------|-------------|----------|
| DOCX Ingestion | Upload and parse quiz DOCX files to extract questions | P0 |
| Magic Link Auth | Passwordless login via email magic links | P0 |
| Team Management | Quizmaster manages teams and contacts | P0 |
| Quiz Taking | Teams answer questions online | P0 |
| Answer Suggestions | Team members suggest answers, vote (up/down) | P1 |
| Grading Panel | Quizmaster grades submissions efficiently | P0 |
| Results Publishing | Auto-generate and distribute results | P0 |
| Excel Export | Export results in existing format | P1 |
| Leaderboards | Team rankings across quizzes | P2 |
| History | Past quiz results and performance tracking | P2 |

---

## 12. Security Considerations

1. **Magic Links**: Single-use tokens, 24-hour expiry, hashed storage
2. **Role-Based Access**: Quizmaster > Team Contact > Team Member
3. **Data Isolation**: Teams can only see their own data (except quizmaster)
4. **File Upload**: Validate DOCX files, size limits, virus scanning
5. **API Security**: JWT sessions, rate limiting on auth endpoints
6. **Email Verification**: Token validation prevents account takeover