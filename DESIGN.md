# ORIGIN Teacher Platform Design Specification (Stitch)

This document defines the visual system, UI tokens, components, and responsive web & mobile screen flows for the **ORIGIN Teacher & Administrator Platform**. It connects our relational databases (`app`, `content`, `assessment`, `rooms`, `analytics`, `import`) to high-fidelity, premium interfaces.

---

## 1. Design System & Branding Tokens

We establish a premium, high-contrast, humanized aesthetic that balances clinical data readability with smooth, motivating interfaces.

### Core Assets
*   **Logo Asset:** `/origin-new.jpg` (Circular display, high contrast, clean backdrop).
*   **Typography:**
    *   **Headline Font:** `PLUS_JAKARTA_SANS` (For headings, numbers, statistics, and emphasis).
    *   **Body Font:** `INTER` (For readable descriptions, logs, options, and tables).
    *   **Label Font:** `GEIST` or default monospace (For system codes, JSON structures, and tag badges).
*   **Roundness:** `ROUND_TWELVE` (12px rounded corners for cards, input fields, modal overlays, and hover states). Buttons use either rounded-full or rounded-xl.

### Theme Guidelines (Dual-Mode Harmony)

We do not use generic plain colors. We use curated HSL-tailored schemes with subtle gradients and backdrop-filters (glassmorphism).

#### Dark Theme (Default)
Designed for low light, reducing eye strain for teachers grading at night.
*   **Primary Accent:** Vibrant Logo Cyan (`#38bdf8` / mixed with HSL `221.2, 83.2%, 53.3%` codebase components).
*   **Background Base:** Full Black (`#000000`).
*   **Card Surfaces:** Dark Slate panels (`#0a0a0a` or glassmorphic `rgba(15, 23, 42, 0.65)`) with a subtle white border (`rgba(255, 255, 255, 0.08)`), backed by a `backdrop-blur-md` filter.
*   **Text Hierarchy:**
    *   Primary: Crisp Cream (`#f8fafc`)
    *   Secondary: Muted Blue-Gray (`#94a3b8`)
    *   Muted/Disabled: Slate (`#64748b`)
*   **Status Color Scales:**
    *   Success: Emerald Mint (`#34d399`)
    *   Warning: Warm Amber (`#fbbf24`)
    *   Critical/Error: Coral Red (`#f87171`)
    *   Info/Neutral: Sky Blue (`#38bdf8`)

#### Light Theme
Designed for daytime classroom environments and projections.
*   **Primary Accent:** Vibrant Logo Cyan (`#38bdf8` / mixed with HSL `346.8, 77.2%, 49.8%` codebase components).
*   **Background Base:** Pure White (`#ffffff`).
*   **Card Surfaces:** Pure White Panels (`#ffffff`) with soft, diffuse gray/pink borders (`rgba(225, 29, 72, 0.08)`) and light ambient dropshadows (`shadow-sm`).
*   **Text Hierarchy:**
    *   Primary: Dark Slate (`#0f172a`)
    *   Secondary: Charcoal Gray (`#475569`)
    *   Muted/Disabled: Cool Gray (`#94a3b8`)
*   **Status Color Scales:**
    *   Success: Forest Green (`#10b981`)
    *   Warning: Dark Amber (`#d97706`)
    *   Critical/Error: Crimson Red (`#dc2626`)
    *   Info/Neutral: Ocean Blue (`#0284c7`)

---

## 2. Visual Philosophy & UI/UX Directives

### Humanizing the UI (Avoiding "AI-Template" Traps)
*   **Contextual Greeting Panels:** The dashboard headers should greet the teacher dynamically (e.g., *"Good evening, Prof. Sharma. 3 question papers need review, and Batch A has an active test right now."*)
*   **Dynamic Data Visuals:** Do not present raw numbers in grids. Group data into high-contrast visual blocks. Use radial charts for concept mastery, vertical timeline nodes for lesson pacing, and card queues for student approval processes.
*   **Micro-interactions:** Interactive cards must elevate slightly (`transform: translateY(-2px)`) and increase border illumination upon hover. Toggle switches and theme switchers must slide with spring-based CSS ease-in-out properties.
*   **Syllabus Trackers:** Inspired by *Marks App*, chapters are mapped to interactive, color-coded rings showing completion percentage, hot weaknesses, and average student accuracy.

---

## 3. Web & Mobile Navigation Architectures

The web platform is desktop-first, with collapsing left sidebar navigation, optimized for wide data tables and side-by-side editing. The mobile view wraps key telemetry and live classroom actions into a responsive bottom bar for teachers on-the-go.

### Web Layout (Desktop)
*   **Sticky Top Navigation Header:** Height `56px`, fixed at the top of the viewport. Displays the Workspace Selector dropdown on the left, followed by horizontal text navigation links.
*   **Workspace Selector (`WorkspaceSwitcher`):** Toggle dropdown displaying the current active workspace name (e.g., "Class 12 - Physics A" or "Class 11 - JEE Advanced") and list of other accessible workspaces.
*   **Horizontal Navigation Links (`NAV_ITEMS`):**
    1.  `Overview` (Route: `/teacher/workspaces/[workspaceId]`)
    2.  `Students` (Route: `/teacher/workspaces/[workspaceId]/students`)
    3.  `Batches` (Route: `/teacher/workspaces/[workspaceId]/batches`)
    4.  `Question Bag` (Route: `/teacher/workspaces/[workspaceId]/question-bag`)
    5.  `Tests` (Route: `/teacher/workspaces/[workspaceId]/tests`)
    6.  `Rooms` (Route: `/teacher/workspaces/[workspaceId]/rooms`)
    7.  `Settings` (Route: `/teacher/workspaces/[workspaceId]/settings`)
*   **Header Right Actions:** Displays a role override pill if platform admin, theme toggler, notification bell, and user avatar.
*   **Main Container:** Margin-less width, full width padding (`px-6 py-8`) centered below the top navigation bar. Uses standard shadcn/ui Card layouts.

### Mobile Layout (Phone)
*   **Bottom Navigation Bar:** Floating glassmorphic dock with 5 main options:
    *   `Home` (Daily schedule & alerts)
    *   `Batches` (Active batch directories)
    *   `Rooms` (Live room control & timer controls)
    *   `Question Bag` (Quick photo import)
    *   `Analytics` (Top-level metrics)
*   **Header:** Dynamic greeting, Workspace toggle, and profile settings icon.

---

## 4. Screen Specifications & Layout Blueprints

### Screen 1: Home Dashboard (Web & Mobile)
An interactive feed focusing on "What needs the teacher's attention today".
*   **Web Layout:**
    *   **Hero Panel (Left):** Welcome banner featuring the dynamic greeting, plus a visual card showing the active **Workspace Code** (e.g. `ORIGIN-JEE-A1`) with a one-click copy button and quick-revoke dropdown.
    *   **Daily Plan Timeline (Right):** A vertical stack of today's tests, live sessions, and upcoming study material postings.
    *   **Actionable Alerts Grid (Bottom):** Grid of cards requiring immediate interaction:
        *   *Unassigned Queue Card:* `"4 new students joined. Review enrollment approvals."` (Links to Students screen).
        *   *Review Required Card:* `"Import Job #492 finished with 3 low-confidence questions."` (Links to Import Verification screen).
        *   *Active Room telemetry:* `"Live Room #902 (JEE mock chemistry) started 10m ago. 42 students active."` (Links to Live Room screen).
*   **Mobile Layout:** Compact vertical scroll. The top is the Workspace Join Code card with an interactive "Share via WhatsApp" button. Followed by a list of scrollable "Task Pills" (e.g. `Approve Students`, `Check Leaderboard`, `Review Imports`).

### Screen 2: Students & Onboarding Queue (Web)
Manages the enrollment list (`app.workspace_student_enrollments`).
*   **Top Section:**
    *   Horizontal tab switcher: `Active Enrolled`, `Unassigned Queue`, `Suspended/Left`.
    *   Search field with active filters for Batch, Date joined, and Join source (e.g. Org Code vs. Manual invitation).
*   **Unassigned Queue Panel:**
    *   Displays newly enrolled students waiting for batch assignments.
    *   **Student Card Design:** Circular avatar, student name, email, join timestamp, and a select check-box.
    *   **Batch Allocator Panel:** Sidebar drawer containing a list of active batches with checkboxes. Selecting students and clicking "Assign Batch" triggers the batch member insert.
*   **Active Directory Table:**
    *   Highly readable tabular grid. Columns: Student Profile, Joined Batches (rendered as multi-colored pills), Average Accuracy, Test Completion Rate, Status Badge (`Active`/`Suspended`), Action Menu (`Edit Batches`, `Suspend Student`).

### Screen 3: Batches Detail & Syllabus Planner (Web)
Displays details for `app.batches` and tracks syllabus completion (inspired by *Marks App*).
*   **Left Column (Batch Meta & Telemetry):**
    *   Syllabus tracker ring (Circular progress indicator). Show total chapters, chapters fully covered, and average batch accuracy per subject.
    *   Batch parameters card: Course/Exam target, Class level, Weekly schedule, Assigned staff list (co-teachers).
*   **Right Column (Tabs):**
    *   `Syllabus Pacing`: Vertical list of subjects & chapters. Expandable chapter cards show concepts under them. Each concept has a progress bar: `Unstarted` (Gray), `In Progress` (Amber), `Mastered` (Emerald).
    *   `Tests & Assignments`: History of custom tests assigned to this batch. Shows scheduled time, duration, submissions status (e.g., `35/40 submitted`), and a button to view test analytics.
    *   `Study Materials`: Grid of attached files (PDFs, homework sheets). Clicking "+" opens a file uploader that pushes documents to R2 (`content.assets`).

### Screen 4: Question Bag & Manual Authoring (Web)
Manages the private question repository (`content.questions`).
*   **Layout:** Two-column split-pane.
*   **Left Pane (Question Search & Library):**
    *   Filter bar: Subject, Chapter, Topic, Difficulty (`Easy`, `Medium`, `Hard`, `Insane`), and Type (`MCQ`, `MSQ`, `Numerical`, `Matrix Match`, `Subjective`).
    *   Vertical scrollable cards for each question. Cards show a snippet of the question stem (formatted with LaTeX support for equations), difficulty pill, and status badges (`Ready`, `Draft`, `Needs Review`).
*   **Right Pane (Authoring Form):**
    *   **Question Type Select:** Horizontal icon buttons.
    *   **Question Stem Field:** Rich-text input with markdown and LaTeX toggle.
    *   **Options Editor:** Dynamically adapts based on question type:
        *   *MCQ/MSQ:* List of option fields with a radio button / checkbox to flag the correct answer.
        *   *Numerical:* Input field for correct value, plus advanced inputs for `expected_units` and symbolic constraints.
        *   *Matrix Match:* A grid configurer matching Rows (A, B, C, D) with Columns (P, Q, R, S).
    *   **Metadata Panel:** Inputs for Hint, Full Solution text (required for OGCode publication), Subject, Chapter, and Topic Tags.
    *   **Asset Uploader:** A drag-and-drop zone to upload reference diagrams or tables. Uploaded images show as previews with a "Delete" button.

### Screen 5: Document Import Pipeline & Side-by-Side Review (Web)
Interactive review panel for `import.document_import_jobs`.
*   **Top Bar:** Progress timeline showing `Queued` -> `Extracting` -> `Review Required`. Displays overall job diagnostics (e.g., *"18 questions extracted. 3 low-confidence flags. 0 duplicate stems."*).
*   **Main Section (Side-by-Side Split Screen):**
    *   **Left Pane (Original Document Viewer):** Displays a scrollable PDF page viewer using page image snapshots. Highlights parsed sections with colored overlays.
    *   **Right Pane (Parsed Questions List):**
        *   Each parsed question is a card with an expandable editing form.
        *   **Confidence Warnings:** If the AI parser has low confidence on a question, option, or diagram, the card is outlined in warning Amber/Red with a list of review reasons (e.g., *No answer key found for Q14*, *Diagram found but extraction bounds are approximate*).
        *   **Interactive Crop Tool:** An option to click "Crop Diagram" on a question card, which activates a selection box on the PDF page to isolate and link a diagram asset.
        *   **Action Row:** "Approve Question" button per card, plus a floating "Bulk Approve Ready Questions" button in the footer.

### Screen 6: Scheduled Test Creator (Web)
Constructs mock tests (`assessment.tests`) and creates assignments (`assessment.test_assignments`).
*   **Step 1: Test Details:** Enter title, instructions, subject, duration, and scoring policy (+4/-1 vs. custom).
*   **Step 2: Question Selector:**
    *   *Option A (Manual Selection):* Multi-select questions from Question Bag or public OGCode. Left-side filters, right-side selected cart list.
    *   *Option B (AI Generator):* Input criteria (e.g., *Generate 30 Physics questions: 10 Mechanics, 10 Electromagnetism, 10 Thermodynamics; 60% MCQ, 40% Numerical; Medium-Hard difficulty*).
*   **Step 3: Scheduler & Assignment:**
    *   Select target Batch(es).
    *   Configure test window: Start Date/Time picker and End Date/Time picker.
    *   Toggle options: `Auto-submit on timer end`, `Show leaderboard to students instantly`, `Shuffle questions`.

### Screen 7: Live Study Room & Dashboard (Web & Mobile)
Tracks real-time student activity inside classroom tests (`rooms.rooms`).
*   **Web Layout (Desktop Dashboard):**
    *   **Header Panel:** Room Code (giant bold text, e.g. `902-881`), active timer count-down, and session status controller (Pause timer, Add +5m, End Test).
    *   **Real-time Leaderboard (Right Sidebar):** Live ranking table showing student names, submitted answers count, current score, and speed metrics.
    *   **Live Question Telemetry Map (Left Section):** Grid of cards representing each test question. Clicking a question reveals:
        *   Live response distribution (e.g. *Option A: 70%, Option B: 15%*).
        *   Average time spent per student on this question.
        *   Flag indicator if many students are struggling/stuck on this problem.
    *   **Student Activity Feed (Bottom):** Grid of compact student cards showing live status indicators: `In Test` (Green pulse), `Idle/No activity` (Amber), `Submitted` (Blue), `Disconnected` (Red).
*   **Mobile Layout:** Optimizes the Live Room Control. Large countdown timer at the top, sliding "Action Drawer" to pause/add time, and scrollable vertical leaderboard.

### Screen 8: Analytics & Weak Topic Remediation (Web)
Analyzes batch-level outcomes and triggers interventions.
*   **Top Row Stats:** Average score, Syllabus completion rate, Attendance/Participation rate, Weakest topic performance.
*   **Performance Radar Chart:** Interactive multi-axis radar showing batch accuracy across different chapters/topics (Physics, Chemistry, Maths).
*   **Weak Concepts Interventions Grid:**
    *   Lists concepts where average batch accuracy is under 50% (sorted by severity).
    *   **Concept Card Design:** Concept title, average accuracy, number of struggling students, and a primary action button: `"Assign Remedial DPP"` or `"Generate Revision Materials"`. Clicking this automatically creates a targeted practice batch using the analytics-service.
*   **Struggling Students Table:** Displays students needing attention based on performance drift and test inconsistencies.

---

## 5. Stitch-Specific Layout Design Patterns

To ensure Stitch generates screens that maintain spacing, alignment, and aesthetic rigor, we enforce the following rules:

1.  **Translucent Overlay Backdrops:** Use glassmorphic card borders `border-white/10` and `bg-slate-900/60` with `backdrop-blur-md` for dark mode.
2.  **Harmonious Accents:** Use `indigo` or `violet` HSL colors for accents. Never use pure raw red/blue/green except for state badges (success/warning/error).
3.  **Humanized Forms:** Input text boxes must feature clear placeholder examples (e.g., *Enter target course (e.g., IIT-JEE 2026)*) and display real-time validation labels (e.g. *Code available!*).
4.  ** LaTeX Math Rendering Blocks:** Anywhere question stems are displayed, reserve styling blocks that resemble formatted mathematics to simulate professional exam systems.
