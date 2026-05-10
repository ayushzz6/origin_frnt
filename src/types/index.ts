export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  class?: '9' | '10' | '11' | '12' | 'dropper';
  fieldOfInterest?: string;
  referralSource?: string;
  avatar?: string;
  streak: number;
  totalStudyTime: number;
  joinedAt: Date;
  isPremium: boolean;
  premiumExpiry?: Date;
  isOnboarded: boolean;
  selectedCourse?: string;
  isDropper: boolean;
  // Teacher specific fields
  yearsOfExperience?: string;
  subjects?: string[];
  studentCapacity?: string;
  streakData?: StreakData;
  dailyQuestionsPracticed?: number;
  points?: number;
  timeAnalytics?: Array<{
    date: string;
    dayName: string;
    webpageTime: number;
    practiceTime: number;
    pomodoroTime: number;
  }>;
  contributionData?: Array<{
    date: string;
    count: number;
  }>;
  location?: string;
  voiceMinutesUsedToday?: number;
  tokensUsedToday?: number;
  usageResetAt?: string;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  schedule: string;
  studentCount: number;
  avgAttendance: number;
  students: User[];
}

export interface Test {
  id: string;
  title: string;
  description: string;
  subject: 'physics' | 'chemistry' | 'mathematics' | 'biology' | 'mixed';
  chapter?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: number; // in minutes
  totalQuestions: number;
  questions: Question[];
  isPremium: boolean;
  isCustom?: boolean;
  attempted?: boolean;
  score?: number;
  attemptCount?: number;
  allScores?: number[];
}

export interface TestPreview {
  id: string;
  title: string;
  description: string;
  subject: string;
  chapter?: string;
  difficulty: string;
  duration: number;
  totalQuestions: number;
  isPremium: boolean;
  isCustom?: boolean;
  attempted?: boolean;
  score?: number;
  attemptCount?: number;
  allScores?: number[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption?: number;
  explanation?: string;
  hint?: string;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'insane';
  image?: string;
  questionType?: 'mcq' | 'subjective' | 'numerical' | 'msq' | 'matrix_match';
  answerText?: string;
  tags?: string[] | string;
  matrixData?: { column_a: string[]; column_b: string[]; correct_pairs: number[][] };
  presentationId?: string;
  presentation_id?: string;
}

export interface PracticeQuestion {
  id: string;
  text: string;
  title?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'insane';
  subject: string;
  concept: string;
  chapter: string;
  isSolved: boolean;
  status?: 'unattempted' | 'solved' | 'attempted';
  attempted?: boolean;
  attemptCount?: number;
  questionType: 'mcq' | 'msq' | 'numerical' | 'matrix_match' | 'subjective';
  options?: string[];
  presentationId?: string;
  presentation_id?: string;
  correctOption?: number;
  correct_option?: number;
  correctOptions?: number[];
  correct_options?: number[];
  matrixData?: { column_a: string[]; column_b: string[]; correct_pairs: number[][] };
  tags?: string[] | string;
  image?: string;
  tolerance?: number;
  acceptance_rate?: number; // Backend uses snake_case in manual list construction
  frequency?: number;
  hint?: string;
  explanation?: string;
  answerText?: string;
}

export interface PracticeQuestionPage {
  items: PracticeQuestion[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SubjectRank {
  subject: string;
  questionsSolved: number;
  totalQuestions?: number;
  rankScore: number;
  rankPosition: number;
  rank?: number;
}
export interface TopicAccuracy {
  topic: string;
  accuracy: number;
}

export interface UserAnswer {
  questionId: string;
  selectedOption: number | null;
  selectedOptions?: number[];
  matrixPairs?: number[][];
  answerText?: string; // Add phase 7 support for non-mcq
  timeSpent: number;
  isMarkedForReview: boolean;
  presentationId?: string | null;
}

export interface TestResult {
  id?: string;
  testId: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTaken: number;
  answers: UserAnswer[];
  weakAreas: TopicAccuracy[];
  strongAreas: TopicAccuracy[];
  subjectStats?: Record<string, {
    score: number;
    total_marks: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    total_qs: number;
    accuracy: number;
    time_spent_correct: number;
    time_spent_incorrect: number;
    time_spent_unattempted: number;
    total_time_spent: number;
  }>;
  aiAnalysis: AIAnalysis;
  isMalpractice?: boolean;
  degraded?: boolean;
  degradedReason?: string | null;
  degraded_reason?: string | null;
  analysisStatus?: 'pending' | 'complete' | 'failed';
  analysis_status?: 'pending' | 'complete' | 'failed';
  analysisError?: string | null;
  analysis_error?: string | null;
  percentage?: number;
  createdAt?: string;
}

export interface AIAnalysis {
  summary: string;
  mistakes: MistakeAnalysis[];
  reviewEntries?: ReviewEntry[];
  recommendations: string[];
  dppGenerated: boolean;
}

export interface MistakeAnalysis {
  questionId: string;
  concept: string;
  error: string;
  explanation: string;
  howToApproach: string;
}

export interface ReviewEntry {
  questionId: string;
  concept: string;
  status: 'correct' | 'incorrect';
  error: string;
  explanation: string;
  howToApproach: string;
}

export interface DPP {
  id: string;
  title: string;
  questions: Question[];
  generatedFrom: string[];
  createdAt: Date;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string;
  attachments?: ChatAttachment[];
  metadata?: Record<string, unknown>;
}

export interface ChatAttachment {
  id?: string;
  type: 'image' | string;
  storage?: string;
  bucket?: string;
  objectKey?: string;
  url?: string | null;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  uploadedAt?: string;
}

export interface DoubtSession {
  id: string;
  title: string;
  subject?: string;
  activeConcept?: string | null;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PomodoroSession {
  duration: number;
  breakDuration: number;
  isRunning: boolean;
  isBreak: boolean;
  timeRemaining: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date | null;
  weeklyData: boolean[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  score: number;
  studyTime: number;
  location?: string;
  isLive: boolean;
}

export interface StudyActivity {
  date: Date;
  studyTime: number;
  testsCompleted: number;
  doubtsSolved: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: Date;
}
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  due: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}
export interface BookChapter {
  id: string;
  title: string;
  pages: number;
  pdfFile?: string;
}

export interface Book {
  id: string;
  title: string;
  bookClass: string;
  subject: string;
  coverImage: string;
  chapters: BookChapter[];
  isLiked?: boolean;
  basePath?: string;
}

export interface Note {
  id: string;
  bookId: string;
  chapterId?: string;
  pageNumber?: number;
  content: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface Bookmark {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  createdAt: Date;
}

export interface Highlight {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  color: string;
  rects?: { x: number; y: number; width: number; height: number }[]; // Coordinates if we were doing real PDF rendering
  createdAt: Date;
}

export type ViewState =
  | 'landing'
  | 'role-selection'
  | 'auth'
  | 'onboarding'
  | 'dashboard'
  | 'test-list'
  | 'test-interface'
  | 'test-result'
  | 'study-rooms'
  | 'dpp'
  | 'doubt-solver'
  | 'leaderboard'
  | 'profile'
  | 'teacher-profile'
  | 'premium'
  | 'ogcode'
  | 'ogcode-workspace'
  | 'pomodoro'
  | 'study-corner'
  | 'explore'
  | 'tasks-goals'
  | 'prestige-milestones';

export type OriginAiPageKind =
  | 'dashboard'
  | 'dpp'
  | 'test_active'
  | 'test_result'
  | 'tests_index'
  | 'ogcode_question'
  | 'ogcode_index'
  | 'study_corner'
  | 'pomodoro'
  | 'profile'
  | 'tasks'
  | 'doubt_solver'
  | 'unknown';

export type OriginAiPolicyMode = 'normal' | 'hint_only' | 'answer_blocked';

export interface OriginAiVisibleQuestion {
  id: string;
  number: number;
  title: string;
  chapter?: string | null;
  concept?: string | null;
  difficulty?: string | null;
  subject?: string | null;
  tags?: string[];
  isSolved?: boolean;
}

export interface OriginAiPageContext {
  pathname: string;
  pageKind: OriginAiPageKind;
  testId: string | null;
  questionId: string | null;
  title: string | null;
  subject: string | null;
  chapter: string | null;
  concept: string | null;
  hint: string | null;
  questionAttempted: boolean | null;
  questionSolved: boolean | null;
  searchQuery: string | null;
  activeSubject: string | null;
  activeDifficulty: string | null;
  activeStatus: string | null;
  selectedChapters: string[];
  totalVisibleQuestions: number | null;
  visibleQuestions: OriginAiVisibleQuestion[];
}

export interface OriginAiPagePolicy {
  mode: OriginAiPolicyMode;
  title: string;
  reason: string;
}

export interface OriginAiReminder {
  id: string;
  userId: string;
  kind: 'dpp' | 'revision' | 'assignment' | 'habit';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  sourceId: string | null;
  createdAt: Date;
}

export interface OriginAiMemory {
  preferredName: string;
  identitySummary: string;
  pinnedFacts: string[];
  lastWeakTopics: string[];
  pendingDppCount: number;
  pendingAssignmentCount: number;
  currentStreak: number;
  lastTestSummary: string | null;
}

export interface OriginAiSession {
  id: string;
  title: string;
  summary: string | null;
  lastPathname: string | null;
  lastPageKind: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  threadId: string | null;
  subject: string | null;
  activeConcept: string | null;
}

export interface OriginAiThread {
  id: string;
  threadId: string;
  title: string;
  subject: string | null;
  activeConcept: string | null;
  lastPathname: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessageSnippet: string | null;
}

export interface OriginAiSnapshot {
  session: OriginAiSession;
  memory: OriginAiMemory;
  reminders: OriginAiReminder[];
  pageContext: OriginAiPageContext;
  pagePolicy: OriginAiPagePolicy;
  provider: string;
}

export interface OriginAiReply extends OriginAiSnapshot {
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
}

export interface OriginAiVoiceConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface OriginAiVoiceConfig {
  transport: 'server_voice';
  provider: 'gemini';
  speechToTextModel: string;
  textToSpeechModel: string;
  voiceName: string;
}

export interface OriginAiVoiceBootstrap extends OriginAiSnapshot {
  browserSessionId: string;
  liveSystemInstruction?: string | null;
  contextSeed: string;
  conversationSeed: OriginAiVoiceConversationTurn[];
  voice: OriginAiVoiceConfig;
}

export interface OriginAiVoiceAudio {
  data: string;
  mimeType: string;
  provider: 'gemini';
  model: string;
  voiceName: string;
  transport: 'server_tts';
}

export interface OriginAiVoiceReply extends OriginAiReply {
  userTranscript: string;
  assistantTranscript: string;
  voiceAudio: OriginAiVoiceAudio | null;
}

export interface OriginAiVoiceSpeakResponse {
  voiceAudio: OriginAiVoiceAudio | null;
  voiceAudioSegments: OriginAiVoiceAudio[];
  fallbackText?: string | null;
  synthesisError?: string | null;
}

export type OriginAiVoiceStatus =
  | 'idle'
  | 'bootstrapping'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';
