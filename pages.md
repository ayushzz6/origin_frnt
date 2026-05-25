# ORIGIN Teacher Platform Screen Directory & Component Specification

This document maps all the pages to be generated for the ORIGIN Teacher Platform. It lists their Next.js routes, structural components, and responsive behaviors (Desktop, Tablet, Mobile) to ensure a smooth design process in Stitch.

---

## 1. Page List & Checklists

- [x] **Page 1: Home Dashboard** (`/teacher/workspaces/[workspaceId]`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen c6eb1e95e0f5472288f5daa3ef0da7fa)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/c6eb1e95e0f5472288f5daa3ef0da7fa)
    - [Tablet (Screen 7b2610f929664eeabf1af87cec4ad80a)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/7b2610f929664eeabf1af87cec4ad80a)
    - [Mobile (Screen 186ab11fa5c94d838a1f85bf0ad7fca6)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/186ab11fa5c94d838a1f85bf0ad7fca6)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 145dc19599404676b2ed2a42fc4000f1)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/145dc19599404676b2ed2a42fc4000f1)
    - [Tablet (Screen 47f0230a620246aa98ca9970a34e3a69)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/47f0230a620246aa98ca9970a34e3a69)
    - [Mobile (Screen a4ac34be6d954a6e8932d1c3ccfc7ad1)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a4ac34be6d954a6e8932d1c3ccfc7ad1)
- [x] **Page 2: Students Directory & Onboarding Queue** (`/teacher/workspaces/[workspaceId]/students`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen ba71e77215914c3099cf096c9d386321)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/ba71e77215914c3099cf096c9d386321)
    - [Tablet (Screen 4de9f18edcdd4dc6935c8c9e9283a082)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/4de9f18edcdd4dc6935c8c9e9283a082)
    - [Mobile (Screen 5d88ebf42a1d4a4b89d0fd50e55e6864)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/5d88ebf42a1d4a4b89d0fd50e55e6864)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 7e4b9de0a38e4af8bd80960278a49de7)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/7e4b9de0a38e4af8bd80960278a49de7)
    - [Tablet (Screen 76be26e2daef4619a65f8a6c08837eb4)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/76be26e2daef4619a65f8a6c08837eb4)
    - [Mobile (Screen e29d5d44211d4c07a7946261a3b195bf)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/e29d5d44211d4c07a7946261a3b195bf)
- [x] **Page 3: Batch Details & Syllabus Planner** (`/teacher/workspaces/[workspaceId]/batches/[batchId]`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen f3dc2ee4dfc94ea888250f140bc20d5e)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/f3dc2ee4dfc94ea888250f140bc20d5e)
    - [Tablet (Screen 8dbedd3cb68e44da9751c6e9a2196c37)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/8dbedd3cb68e44da9751c6e9a2196c37)
    - [Mobile (Screen a9e7581e502b4276b328b865232c13c4)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a9e7581e502b4276b328b865232c13c4)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 0362a72e36d14bf7901c3992f949d00a)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/0362a72e36d14bf7901c3992f949d00a)
    - [Tablet (Screen a0f58fc35dc041d285dbc6fe0fc9207a)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a0f58fc35dc041d285dbc6fe0fc9207a)
    - [Mobile (Screen 1f01aece38834c598dcd1b977f523361)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/1f01aece38834c598dcd1b977f523361)
- [x] **Page 4: Question Bag Library & Manual Editor** (`/teacher/workspaces/[workspaceId]/question-bag`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen 395c9e91f09040a290af58e6d1c30635)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/395c9e91f09040a290af58e6d1c30635)
    - [Tablet (Screen 79e58b17499f4602862f0eb2c447d902)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/79e58b17499f4602862f0eb2c447d902)
    - [Mobile (Screen 784fcf3184cd4a67baa9dccb6cf2930a)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/784fcf3184cd4a67baa9dccb6cf2930a)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen c3e62c228c6148a0bc8d88b459aa4508)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/c3e62c228c6148a0bc8d88b459aa4508)
    - [Tablet (Screen ffd1d745fcdb413da24a604d953df7ec)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/ffd1d745fcdb413da24a604d953df7ec)
    - [Mobile (Screen 8d70b4bbeae44e4c8a491f5a9846c33d)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/8d70b4bbeae44e4c8a491f5a9846c33d)
- [x] **Page 5: Document Import Pipeline & Review Panel** (`/teacher/workspaces/[workspaceId]/question-bag/import`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen a03b9f978ae34ddb9c1e53e42ce53a74)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a03b9f978ae34ddb9c1e53e42ce53a74)
    - [Tablet (Screen 8989be57f9a34731a3bc7766c903f2b3)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/8989be57f9a34731a3bc7766c903f2b3)
    - [Mobile (Screen 42a46229661245c2afb6e5b0c3ce1154)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/42a46229661245c2afb6e5b0c3ce1154)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 5f525a15b2434256897d8013f808b77a)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/5f525a15b2434256897d8013f808b77a)
    - [Tablet (Screen 13c710e448c34bd0bbe74f96be5727ab)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/13c710e448c34bd0bbe74f96be5727ab)
    - [Mobile (Screen 8d388700b1304e42a20098c5c5a4a857)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/8d388700b1304e42a20098c5c5a4a857)
- [x] **Page 6: Scheduled Test Creator & Builder** (`/teacher/workspaces/[workspaceId]/tests`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen fc78b70bbe6a4b3db5c56652065952f8)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/fc78b70bbe6a4b3db5c56652065952f8)
    - [Tablet (Screen e036ba1eda6a482a972feacfc7b1d9fc)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/e036ba1eda6a482a972feacfc7b1d9fc)
    - [Mobile (Screen f4a40d0df9b845c5a78c46096502c304)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/f4a40d0df9b845c5a78c46096502c304)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 1c0485ad766d4d7baf54d43d831feb22)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/1c0485ad766d4d7baf54d43d831feb22)
    - [Tablet (Screen 157130635c344d9f933aeddbb3ef47aa)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/157130635c344d9f933aeddbb3ef47aa)
    - [Mobile (Screen 6c6605a9b67c445585386e5423ebf7f2)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/6c6605a9b67c445585386e5423ebf7f2)
- [x] **Page 7: Live Study Room Real-Time Dashboard** (`/teacher/workspaces/[workspaceId]/rooms/[roomId]`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen 002002b7cfa74012b8d691e6d28c24ae)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/002002b7cfa74012b8d691e6d28c24ae)
    - [Tablet (Screen 9714c28ab98544bd8691e2c3253d81b1)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/9714c28ab98544bd8691e2c3253d81b1)
    - [Mobile (Screen a02c0c0490f04845bb9b562cd84c768d)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a02c0c0490f04845bb9b562cd84c768d)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 4741957c0e684d50971596ceb5d0b873)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/4741957c0e684d50971596ceb5d0b873)
    - [Tablet (Screen c84b647bf5184721ac9c0b1715d28a3d)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/c84b647bf5184721ac9c0b1715d28a3d)
    - [Mobile (Screen 5aed4133d7be4563915b90b98d192409)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/5aed4133d7be4563915b90b98d192409)
- [x] **Page 8: Analytics Center & Weakness Remediation** (`/teacher/workspaces/[workspaceId]/analytics`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen 39eb8d9837584d71bb57de3c5fe2b544)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/39eb8d9837584d71bb57de3c5fe2b544)
    - [Tablet (Screen 8f06849f303f4596811fbe6f9e03d42d)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/8f06849f303f4596811fbe6f9e03d42d)
    - [Mobile (Screen 6d37612e09084e4e8d71aac11b980827)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/6d37612e09084e4e8d71aac11b980827)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 9dbdc1ca40fa41e7871bb409491af7cd)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/9dbdc1ca40fa41e7871bb409491af7cd)
    - [Tablet (Screen 4582847ca8dd4e0886311334627ff7eb)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/4582847ca8dd4e0886311334627ff7eb)
    - [Mobile (Screen 748fd88260d74e0989686724266246c1)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/748fd88260d74e0989686724266246c1)
- [x] **Page 9: OGCode Contributor & Workspace Settings** (`/teacher/workspaces/[workspaceId]/settings`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen a64a1b5e9d254d0d939436accdecd023)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a64a1b5e9d254d0d939436accdecd023)
    - [Tablet (Screen a0c86352794f46d2a45583fbd2fc4a1f)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/a0c86352794f46d2a45583fbd2fc4a1f)
    - [Mobile (Screen 043567963b054110878a0153c05814ad)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/043567963b054110878a0153c05814ad)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 9d9f35b6eaad41d4acb2819e54b394dd)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/9d9f35b6eaad41d4acb2819e54b394dd)
    - [Tablet (Screen e4780219adbb40a89ffd8992e6aa2318)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/e4780219adbb40a89ffd8992e6aa2318)
    - [Mobile (Screen 5dd2af9a4f184eb4a5000547644929eb)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/5dd2af9a4f184eb4a5000547644929eb)
- [x] **Page 10: Teacher Onboarding & Signup Flow** (`/teacher/onboarding`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen 3ceeb8088e784f79bd5c102f9594d3c8)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/3ceeb8088e784f79bd5c102f9594d3c8)
    - [Tablet (Screen 55408c41fea7412f91e1eb86ddd1d0d7)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/55408c41fea7412f91e1eb86ddd1d0d7)
    - [Mobile (Screen c4257bca601f45e38ce031a7282e0273)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/c4257bca601f45e38ce031a7282e0273)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 544cf90eec3f43ad93cac671c944b88d)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/544cf90eec3f43ad93cac671c944b88d)
    - [Tablet (Screen 2cf121b8fc404f60972e7f4e17fd22d2)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/2cf121b8fc404f60972e7f4e17fd22d2)
    - [Mobile (Screen c86e38cb43434ec49a080600cf6728f8)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/c86e38cb43434ec49a080600cf6728f8)
- [x] **Page 11: Platform Admin Control Center & Moderation Console** (`/admin/moderation`)
  - **Dark Mode (Pure Black base, Cyan accent)**:
    - [Desktop (Screen af166e7164934c408917025017972920)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/af166e7164934c408917025017972920)
    - [Tablet (Screen e023bb80880a48859651188bba7e68a8)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/e023bb80880a48859651188bba7e68a8)
    - [Mobile (Screen 8e5109231763444a8dc4f59b5cb47a87)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/8e5109231763444a8dc4f59b5cb47a87)
  - **Light Mode (Pure White base, Cyan accent)**:
    - [Desktop (Screen 4f5b922c58e64775a5d9de0e9c124ece)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/4f5b922c58e64775a5d9de0e9c124ece)
    - [Tablet (Screen e75cca4d986d4f6092ae0ed8a886bfd0)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/e75cca4d986d4f6092ae0ed8a886bfd0)
    - [Mobile (Screen ed8082138c034bbca03ca82f93a545bd)](https://stitch.withgoogle.com/projects/2531893112967424418/screens/ed8082138c034bbca03ca82f93a545bd)

---

## 2. Structural Specs by Page

### Page 1: Home Dashboard
**Route:** `/teacher/workspaces/[workspaceId]`  
*Focus:* Active class telemetries and immediate task list.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header (56px) + Main content area in a 3-column card grid.
    *   **Tablet:** Sticky Top Navigation Header (56px) + Main content area in 2 columns (Alerts/Hero spans full-width, Timeline and Schedule stacked).
    *   **Mobile:** Bottom Glassmorphic Floating Nav Dock. Full-width vertical card list.
*   **Components:**
    *   `StickyTopHeaderBar`: Sticky header containing `WorkspaceSwitcher` dropdown, horizontal text links (Overview, Students, Batches, Question Bag, Tests, Rooms, Settings), user profile avatar, and theme toggler.
    *   `WelcomeHeroPanel`: Displays greeting text, summary sentence of active items, and a stylized card showing the active **Workspace Code** (e.g. `ORIGIN-JEE-A1`) with "Copy Link", "WhatsApp Share", and "Rotate Code" action buttons.
    *   `ActiveAlertsGrid`: Group of three status-border cards:
        1.  *Unassigned Student Queue Alert* (Amber indicator)
        2.  *Low Confidence Import Alert* (Blue indicator)
        3.  *Live Test Session Telemetry* (Emerald pulse indicator)
    *   `ScheduleTimeline`: A vertical node list displaying scheduled mock tests, live sessions, and homework releases for today.

---

### Page 2: Students Directory & Onboarding Queue
**Route:** `/teacher/workspaces/[workspaceId]/students`  
*Focus:* Approving newly enrolled students and managing batch mappings.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Main Area split 70:30 (Left pane: Directory/Queue list, Right pane: Batch Allocator slide drawer).
    *   **Tablet:** Sticky Top Navigation Header + Stacked vertically (Top: Queue carousel, Bottom: Active Directory grid; Batch Allocator opens in a full-screen overlay/modal).
    *   **Mobile:** Bottom Nav + Flat list. Unassigned student requests appear as swipeable cards at the top, followed by a flat search table.
*   **Components:**
    *   `DirectoryTabSwitcher`: Horizontal tabs: "Active Directory", "Onboarding Queue (X)", "Suspended/Left".
    *   `SearchFilterBar`: Text search input + "Filter by Batch" multi-select dropdown + "Manual Invite" action button.
    *   `UnassignedQueueCardList`: Student check-list cards displaying avatar, name, email, join time, source badge, and single/bulk select controls.
    *   `BatchAllocatorDrawer`: Sidebar pane that displays active batches with checkboxes and a primary action button labeled "Assign Batch (X Selected)".
    *   `StudentDirectoryTable`: Read-only table columns: Name, Batch Badges (multi-color pills), Overall Accuracy (mini circular radial tracker), Last Activity Time, Status Badge (Active/Suspended), and Action menu.

---

### Page 3: Batch Details & Syllabus Planner
**Route:** `/teacher/workspaces/[workspaceId]/batches/[batchId]`  
*Focus:* syllabus completion and assigned mock tests/materials.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Split-Pane 30:70 (Left pane: Batch stats & co-teachers; Right pane: Syllabus tree & planners).
    *   **Tablet:** Sticky Top Navigation Header + Stacked columns (Syllabus rings on top, calendar/tree layout below).
    *   **Mobile:** Bottom Nav. Batch header card at top, swipeable subject selectors (Physics, Chemistry, Math), and flat checklist of chapters.
*   **Components:**
    *   `BatchSummaryCard`: Displays targets, student count, weekly calendar, and assigned co-teachers.
    *   `SyllabusProgressRing`: Radial HSL-colored circle displaying completion percentage and batch-wide concept strengths.
    *   `PlannerTabSystem`: Horizontal tabs for "Syllabus Tree", "Mock Tests", "Study Materials".
    *   `SyllabusChapterTree`: Multi-level list of Chapters. Chapters expand to show Concept items. Each Concept item displays a status badge: "Mastered" (Emerald, >75% accuracy), "In Progress" (Amber, 50-75% accuracy), "Unstarted" (Gray).
    *   `StudyMaterialsUploader`: Dashed drag-and-drop file upload zone (links to R2 bucket) next to a list of active batch attachments with view-count logs.

---

### Page 4: Question Bag Library & Manual Editor
**Route:** `/teacher/workspaces/[workspaceId]/question-bag`  
*Focus:* Question bank searching, filtering, and manual creation/editing.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Split-pane 40:60 (Left pane: library directory; Right pane: authoring editor).
    *   **Tablet:** Sticky Top Navigation Header + Split-pane 50:50 (Vertical list on left, Editor form on right).
    *   **Mobile:** Bottom Nav. Library list fills screen; clicking a question slides in the authoring editor as a full-screen overlay.
*   **Components:**
    *   `QuestionFilters`: Left accordion panel filterable by Subject, Chapter, Topic, Difficulty (Easy, Medium, Hard, Insane), and Question Type (MCQ, MSQ, Numerical, Matrix, Subjective).
    *   `LibraryQuestionCardList`: Scrollable cards showing question stem snippets rendered with LaTeX math support, metadata pills, checkbox, and status badge ("Draft", "Ready", "OGCode Published").
    *   `QuestionTypeSelector`: Horizontal button group with question type icons.
    *   `LaTeXStemEditor`: Markdown text area with a live preview pane rendering mathematical equations.
    *   `DynamicOptionsGrid`: Adapts inputs based on selected Question Type (Radio buttons for MCQ, Checkboxes for MSQ, Matrix grid inputs, numerical fields with expected units).
    *   `MetadataPanel`: Fields for Hints, Explanations, Full Solved Solutions (required for public OGCode), and a drag-and-drop reference diagram/image uploader.

---

### Page 5: Document Import Pipeline & Review Panel
**Route:** `/teacher/workspaces/[workspaceId]/question-bag/import`  
*Focus:* Side-by-side parsing verification of uploaded PDFs and images.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Split screen 50:50 (Left pane: PDF view; Right pane: Editor panels).
    *   **Tablet:** Split screen 50:50 (Smaller viewing frames, side-by-side).
    *   **Mobile:** Wizard style. Step 1 displays PDF page crop canvas, Step 2 displays edit text box.
*   **Components:**
    *   `ImportProgressBar`: Steps indicating "Queued -> Classifying -> Extracting -> Reconciling -> Reviewing".
    *   `PDFViewerOverlay`: Scrollable page snapshot viewer. Displays a selection cropping box overlays over original text.
    *   `ParsedQuestionsList`: Cards representing parsed items. Cards flag validation warnings:
        *   *Amber Warning Outline:* "Missing Answer Key" or "Low Confidence Options".
        *   *Diagram Crop Button:* Action to link cropped regions from the left PDF to the question version.
    *   `ImportActionControls`: Sticky footer displaying "Bulk Approve Ready Questions" and "Complete Import".

---

### Page 6: Scheduled Test Creator & Builder
**Route:** `/teacher/workspaces/[workspaceId]/tests`  
*Focus:* Scheduling exams and building mock test configurations.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Horizontal progress bar + 3-step form wizard (Details -> Question Cart -> Target & Schedule).
    *   **Tablet/Mobile:** Single scroll form divided into three expandable cards.
*   **Components:**
    *   `WizardProgressHeader`: Nodes mapping "Details -> Select -> Schedule".
    *   `TestSettingsForm`: Fields for Test Title, Duration (in minutes), Description, and Scoring Policy (+4/-1 vs custom input).
    *   `QuestionSelectorCart`: Split pane showing question bank filter catalog on left, and selected "Test Question Cart" on right with drag-and-drop handles for position sorting.
    *   `TargetSchedulerCard`: Selection dropdowns for Batches, Date/Time window pickers (Start Date vs End Date), and toggle controls ("Auto-submit", "Shuffle", "Hide Live Leaderboard").

---

### Page 7: Live Study Room Real-Time Dashboard
**Route:** `/teacher/workspaces/[workspaceId]/rooms/[roomId]`  
*Focus:* Live telemetry and student scoring during ongoing exams.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + Main Area Split 70:30 (Left pane: telemetry charts & presence grids; Right pane: live leaderboard).
    *   **Tablet:** Sticky Top Navigation Header + stacked layout (Leaderboard spans top, telemetry grid below).
    *   **Mobile:** Bottom Nav. Header countdown timer at top, sliding tab panel displaying "Leaderboard" or "Live Status".
*   **Components:**
    *   `RoomHeaderWidget`: Displays Room Code in large bold font, ticking countdown timer, and control buttons ("Pause", "+5 Min", "End Test").
    *   `LiveAccuracyMatrix`: Grid of test question numbers. Clicking a question card opens a modal showing:
        *   Response distribution bar charts.
        *   Average attempt speed.
        *   "Struggling alert" flag.
    *   `LiveLeaderboard`: Real-time ranking list showing Student Name, Answer Progress Bar, current score, and speed.
    *   `PresenceGrid`: Grid of student tiles with colored pulsing status indicators ("Active", "Idle", "Submitted", "Disconnected").

---

### Page 8: Analytics Center & Weakness Remediation
**Route:** `/teacher/workspaces/[workspaceId]/analytics`  
*Focus:* Radar charts and assigning remedial worksheets based on topic weaknesses.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Sticky Top Navigation Header + 2-Column Grid (Left: Radar chart; Right: Weakness list & tables).
    *   **Tablet/Mobile:** Sticky Top Navigation Header + Vertical stacked column. Chart at top, followed by intervention cards, followed by tabular grids.
*   **Components:**
    *   `OverviewMetricsBanner`: Small stat boxes displaying Average Score, Syllabus Pacing, Attendance, and Active Weak Concepts.
    *   `MasteryRadarChart`: Multi-axis radar visualization tracking chapter accuracy across Mathematics, Physics, and Chemistry.
    *   `WeakConceptInterventionList`: Grid of concept cards with accuracy metrics below 55%. Card includes details of struggling students and buttons for "Assign Remedial DPP" or "Post Revision Sheet".
    *   `StrugglingStudentsDirectory`: Tabular roster displaying students with declining performance lines (sparklines), test completion consistency, and profiles.

---

### Page 9: OGCode Contributor & Workspace Settings
**Route:** `/teacher/workspaces/[workspaceId]/settings`  
*Focus:* Managing profile settings, inviting staff, and submitting to public bank.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Left Tab list + Right Settings Panels.
    *   **Tablet/Mobile:** Top Tab bar dropdown selector + stacked settings rows.
*   **Components:**
    *   `SettingsNavTabs`: Switcher for "Workspace Info", "Staff Management", "OGCode Roster", "Billing".
    *   `StaffManagementPanel`: Table listing members, role dropdowns (`Owner`, `Admin`, `Teacher`, `Content Manager`), status pills, and "Invite Staff" email modal.
    *   `OGCodeSubmissionList`: List of contributed questions showing verification history, reviewer comments, and moderation badges ("Approved", "Changes Requested", "Rejected").
    *   `AttributionBuilder`: Panel to set teacher display profile and upload academy logo (`/origin-new.jpg`) for public questions.

---

### Page 10: Teacher Onboarding & Signup Flow
**Route:** `/teacher/onboarding`  
*Focus:* Educator/institute registration, profile details, and organization code checks.

*   **Responsive Layout Layouts:**
    *   **Desktop:** Minimal TopNavBar + Centered onboarding form card (800px max-width).
    *   **Tablet:** Centered onboarding card (700px width), stacked selector layout.
    *   **Mobile:** Full-bleed vertical scroll layout, single column inputs.
*   **Components:**
    *   `WorkspaceTypeSelector`: Side-by-side select cards displaying "Personal Teacher Workspace" and "Coaching Institute Workspace" with highlight selections.
    *   `OnboardingProgressBar`: Step indicators for "Workspace Type -> Details -> Profile Attribution".
    *   `OnboardingForm`: Input fields for Name, Email (with inline success indicator), Subjects checkboxes, and capacity.
    *   `OrgCodeChecker`: Real-time availability indicator showing "Code available!" (emerald) or "Code taken" (coral) next to code inputs.
    *   `AttributionUploader`: Circular display uploader logo frame mapped to the uploader profile image uploader.

---

### Page 11: Platform Admin Control Center & Moderation Console
**Route:** `/admin/moderation`  
*Focus:* Multi-workspace management, public OGCode question approval, and incident handling.

*   **Responsive Layout Layouts:**
    *   **Desktop:** TopNavBar + Left-side vertical navigation menu + Right-side dashboard panel.
    *   **Tablet:** Landscape optimized split navigation grid.
    *   **Mobile:** Horizontal tab menu header + single-column scrollable metric & roster cards.
*   **Components:**
    *   `PlatformMetricsRow`: Dashboard card group for active users, suspended workspaces, pending moderation requests, and active incidents.
    *   `WorkspaceRosterDirectory`: Tabular roster mapping workspace details, status pills, and toggle keys for suspension/revocation and streaming JSON exports.
    *   `OGCodeModerationQueueCard`: Contributed question card showing stem, LaTeX equation render, teacher attribution uploader, and solid green Approve / Amber Reject action buttons.
    *   `IncidentKillSwitchConsole`: High-priority status log displaying system errors and red alert dropdown options for Rate Limits or Kill-Switches.

---

## 3. API Integration Contract Mapping

This section defines the mapping between each page and component on the ORIGIN Teacher Platform and their corresponding backend API contracts defined in [Teacher-admin-api.md](file:///Users/snaveen/Desktop/Origin/V1/Teacher-admin-api.md).

### Page 1: Home Dashboard (`/teacher/workspaces/[workspaceId]`)
*   **WorkspaceSwitcher**:
    *   `GET /api/teacher/workspaces` (to list available workspaces)
    *   `GET /api/teacher/workspaces/{workspaceId}` (to load current workspace configuration)
*   **WelcomeHeroPanel**:
    *   `POST /api/teacher/workspaces/{workspaceId}/codes` (to generate/refresh a new join code)
    *   `POST /api/teacher/workspaces/{workspaceId}/codes/{codeId}/revoke` (to revoke access keys)
*   **ActiveAlertsGrid**:
    *   `GET /api/teacher/workspaces/{workspaceId}/students` (to check the onboarding queue count)
    *   `GET /api/teacher/workspaces/{workspaceId}/import-jobs` (to check the status of document import parsing tasks)
    *   `GET /api/teacher/workspaces/{workspaceId}/rooms` (to retrieve currently active live classroom study rooms)

### Page 2: Students Directory & Onboarding Queue (`/teacher/workspaces/[workspaceId]/students`)
*   **DirectoryTabSwitcher / StudentDirectoryTable**:
    *   `GET /api/teacher/workspaces/{workspaceId}/students` (fetch active, onboarding, and suspended student enrollments)
    *   `PATCH /api/teacher/workspaces/{workspaceId}/students/{studentId}` (approve onboarding queue request, suspend student, or mark as left)
*   **BatchAllocatorDrawer**:
    *   `GET /api/teacher/workspaces/{workspaceId}/batches` (to fetch batch options)
    *   `POST /api/teacher/workspaces/{workspaceId}/students/{studentId}/assign-batches` (to bind students to selected batches)

### Page 3: Batch Details & Syllabus Planner (`/teacher/workspaces/[workspaceId]/batches/[batchId]`)
*   **BatchSummaryCard / SyllabusChapterTree**:
    *   `GET /api/teacher/workspaces/{workspaceId}/batches/{batchId}` (fetch syllabus completion tree, weekly calendar, and metadata)
    *   `PATCH /api/teacher/workspaces/{workspaceId}/batches/{batchId}` (to modify batch target course, level, schedule, or co-teachers)
    *   `GET /api/teacher/workspaces/{workspaceId}/batches/{batchId}/students` (fetch roster list assigned to this specific batch)
*   **StudyMaterialsUploader / Attachments**:
    *   `GET /api/teacher/workspaces/{workspaceId}/study-materials` (retrieve attached PDFs or homework sheets)
    *   `POST /api/teacher/workspaces/{workspaceId}/study-materials` (to upload new revision materials to Cloudflare R2)
    *   `DELETE /api/teacher/workspaces/{workspaceId}/study-materials/{materialId}` (to remove syllabus resources)

### Page 4: Question Bag Library & Manual Editor (`/teacher/workspaces/[workspaceId]/question-bag`)
*   **LibraryQuestionCardList**:
    *   `GET /api/teacher/workspaces/{workspaceId}/questions` (to query/filter question entries by subject, difficulty, or tag)
    *   `DELETE /api/teacher/workspaces/{workspaceId}/questions/{questionId}` (delete questions from local question bank)
*   **LaTeXStemEditor / DynamicOptionsGrid**:
    *   `POST /api/teacher/workspaces/{workspaceId}/questions` (create new MCQ, MSQ, Numerical, or Matrix Match questions)
    *   `PATCH /api/teacher/workspaces/{workspaceId}/questions/{questionId}` (to modify question stem, solutions, options, or hints)
    *   `GET /api/teacher/workspaces/{workspaceId}/questions/{questionId}/versions` (to retrieve edit history of questions)
*   **OGCode publisher buttons**:
    *   `POST /api/teacher/workspaces/{workspaceId}/questions/{questionId}/submit-ogcode` (to submit question to the public community pool)
    *   `POST /api/teacher/workspaces/{workspaceId}/questions/{questionId}/publish-private` (toggle private publishing)

### Page 5: Document Import Pipeline & Review Panel (`/teacher/workspaces/[workspaceId]/question-bag/import`)
*   **ImportProgressBar**:
    *   `GET /api/teacher/workspaces/{workspaceId}/import-jobs` (track list of active, parsing, or completed PDF upload jobs)
*   **PDFViewerOverlay / ParsedQuestionsList**:
    *   `POST /api/teacher/workspaces/{workspaceId}/import-jobs` (trigger new multi-page PDF ingestion task)
    *   `GET /api/teacher/workspaces/{workspaceId}/import-jobs/{jobId}` (retrieve OCR extractions, bounding boxes, and low confidence warnings)
    *   `POST /api/teacher/workspaces/{workspaceId}/import-jobs/{jobId}` (reconcile OCR changes, link cropped diagram assets from PDF, and approve items in bulk)

### Page 6: Scheduled Test Creator & Builder (`/teacher/workspaces/[workspaceId]/tests`)
*   **TestSettingsForm**:
    *   `POST /api/teacher/workspaces/{workspaceId}/tests` (create test details, scoring rules, and instructions)
    *   `PATCH /api/teacher/workspaces/{workspaceId}/tests/{testId}` (edit drafts)
*   **QuestionSelectorCart**:
    *   `GET /api/teacher/workspaces/{workspaceId}/questions` (query private bank question objects)
*   **TargetSchedulerCard**:
    *   `POST /api/teacher/workspaces/{workspaceId}/tests/{testId}/assign` (bind mock test to student batches)
    *   `POST /api/teacher/workspaces/{workspaceId}/tests/{testId}/schedule` (define test window, start date, end date, and shuffling configurations)

### Page 7: Live Study Room Real-Time Dashboard (`/teacher/workspaces/[workspaceId]/rooms/[roomId]`)
*   **RoomHeaderWidget / PresenceGrid**:
    *   `GET /api/teacher/workspaces/{workspaceId}/rooms/{roomId}` (retrieve real-time web socket state, ticking test timer, and presence indicators)
    *   `DELETE /api/teacher/workspaces/{workspaceId}/rooms/{roomId}` (close/destroy active classroom room)
*   **LiveAccuracyMatrix / LiveLeaderboard**:
    *   `POST /api/teacher/workspaces/{workspaceId}/rooms/{roomId}/configure-test` (link test to active room)
    *   `GET /api/teacher/workspaces/{workspaceId}/tests/{testId}/leaderboard` (poll student scores, completion rates, and speed profiles)

### Page 8: Analytics Center & Weakness Remediation (`/teacher/workspaces/[workspaceId]/analytics`)
*   **OverviewMetricsBanner / MasteryRadarChart**:
    *   `GET /api/teacher/workspaces/{workspaceId}/analytics/batches/{batchId}` (retrieve radar metrics, concepts under 55% accuracy, and completion pacing)
*   **WeakConceptInterventionList / StrugglingStudentsDirectory**:
    *   `GET /api/teacher/workspaces/{workspaceId}/analytics/students/{studentId}` (query individual performance sparklines and answer analytics)
    *   `POST /api/teacher/workspaces/{workspaceId}/batches/{batchId}` (to trigger custom remedial worksheets dynamically)

### Page 9: OGCode Contributor & Workspace Settings (`/teacher/workspaces/[workspaceId]/settings`)
*   **AttributionBuilder / StaffManagementPanel**:
    *   `PATCH /api/teacher/workspaces/{workspaceId}` (to update Display profile information or uploader logo)
    *   `GET /api/teacher/workspaces/{workspaceId}/students` (to retrieve workspace co-teachers/staff directory list)
*   **OGCodeSubmissionList**:
    *   `GET /api/teacher/workspaces/{workspaceId}/ogcode-publications` (retrieve Moderation history and review comments for contributed questions)
    *   `GET /api/teacher/ogcode-moderation` (check system-wide moderation status queues)

### Page 10: Teacher Onboarding & Signup Flow (`/teacher/onboarding`)
*   **WorkspaceTypeSelector / OnboardingForm**:
    *   `POST /api/teacher/onboarding` (create personal or institute teacher user and initial workspace)
*   **OrgCodeChecker**:
    *   `POST /api/teacher/codes/check` (queryAvailability for custom unique coaching identifiers before signup transaction)

### Page 11: Platform Admin Control Center & Moderation Console (`/admin/moderation`)
*   **WorkspaceRosterDirectory**:
    *   `GET /api/admin/workspaces` (fetch system workspaces roster)
    *   `POST /api/admin/workspaces/{workspaceId}` (suspend, unsuspend, or close workspaces)
    *   `POST /api/admin/workspaces/{workspaceId}/codes/{codeId}/revoke` (revoke access keys)
    *   `GET /api/admin/workspaces/{workspaceId}/export` (extract database schemas via JSON streaming)
*   **OGCodeModerationQueueCard**:
    *   `GET /api/admin/ogcode/moderation` (list contributed questions awaiting public pool approval)
    *   `POST /api/admin/ogcode/moderation/{publicationId}/approve` (approve publication and sync)
    *   `POST /api/admin/ogcode/moderation/{publicationId}/reject` (flag changes requested or reject contribution)
*   **IncidentKillSwitchConsole**:
    *   `GET /api/admin/incidents` (view system incidents and logs)
    *   `POST /api/admin/incidents/{action}` (execute emergency `kill_switch`, `force_logout`, or rate limits)
    *   `GET /api/admin/audit-events` (audit control log details)
    *   `GET /api/admin/import-jobs` & `GET /api/admin/import-jobs/{jobId}` (audit failed ingestion parsing logs)
