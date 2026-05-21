export type TeacherWorkspaceType = "personal" | "institute";

export type WorkspaceStatus = "active" | "trial" | "suspended" | "closed";

export type WorkspaceVerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type WorkspaceMemberRole =
  | "owner"
  | "admin"
  | "teacher"
  | "content_manager"
  | "analyst"
  | "support";

export type WorkspaceMemberStatus = "invited" | "active" | "disabled" | "removed";

export type WorkspaceCodeType = "student_join" | "staff_invite" | "batch_join";

export type WorkspaceCodeStatus = "reserved" | "active" | "revoked" | "expired";

export type TeacherWorkspace = {
  id: string;
  workspaceType: TeacherWorkspaceType;
  ownerUserId: string;
  displayName: string;
  legalName: string | null;
  slug: string | null;
  logoAssetId: string | null;
  city: string | null;
  state: string | null;
  country: string;
  subjects: string[];
  courses: string[];
  status: WorkspaceStatus;
  verificationStatus: WorkspaceVerificationStatus;
  publicProfile: Record<string, unknown>;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  invitedBy: string | null;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceCode = {
  id: string;
  workspaceId: string;
  batchId: string | null;
  normalizedCode: string;
  displayCode: string;
  codeType: WorkspaceCodeType;
  status: WorkspaceCodeStatus;
  createdBy: string;
  expiresAt: string | null;
  revokedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceMembershipSummary = TeacherWorkspace & {
  role: WorkspaceMemberRole;
  memberStatus: WorkspaceMemberStatus;
};

export type EnrollmentSource = "code" | "manual" | "admin_import" | "paid_app" | "migration";
export type EnrollmentStatus = "unassigned" | "active" | "suspended" | "left";
export type BatchStatus = "draft" | "active" | "completed" | "archived";
export type BatchMemberStatus = "active" | "removed" | "completed";

export type WorkspaceStudentEnrollment = {
  id: string;
  workspaceId: string;
  studentId: string;
  source: EnrollmentSource;
  joinCodeId: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  assignedAt: string | null;
  suspendedAt: string | null;
  leftAt: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type EnrollmentWithStudent = WorkspaceStudentEnrollment & {
  studentName: string | null;
  studentEmail: string | null;
};

export type Batch = {
  id: string;
  workspaceId: string;
  name: string;
  course: string | null;
  subject: string | null;
  classLevel: string | null;
  scheduleText: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  status: BatchStatus;
  settings: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BatchMember = {
  batchId: string;
  workspaceId: string;
  studentId: string;
  status: BatchMemberStatus;
  assignedBy: string | null;
  assignedAt: string;
  removedAt: string | null;
  metadata: Record<string, unknown>;
};

export type BatchWithCounts = Batch & {
  studentCount: number;
};

export type AuditEventInput = {
  actorUserId: string | null;
  workspaceId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
  ipHash?: string | null;
};

export type StudyMaterialType = "pdf" | "docx" | "image" | "video" | "link" | "other";
export type StudyMaterialStatus = "draft" | "published" | "archived";
export type StudyMaterialAssignmentTarget = "batch" | "student" | "workspace";

export type StudyMaterial = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  materialType: StudyMaterialType;
  subject: string | null;
  topic: string | null;
  classLevel: string | null;
  status: StudyMaterialStatus;
  createdBy: string;
  publishedAt: string | null;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type StudyMaterialAsset = {
  id: string;
  materialId: string;
  r2ObjectKey: string;
  r2Bucket: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  displayName: string | null;
  sortOrder: number;
  createdAt: string;
};

export type StudyMaterialAssignment = {
  id: string;
  materialId: string;
  workspaceId: string;
  targetType: StudyMaterialAssignmentTarget;
  targetId: string;
  assignedBy: string | null;
  assignedAt: string;
  revokedAt: string | null;
};

export type StudyMaterialWithAssets = StudyMaterial & {
  assets: StudyMaterialAsset[];
  assetCount: number;
};

export type StudyMaterialWithAssignments = StudyMaterial & {
  assignments: StudyMaterialAssignment[];
};

export type BatchTopicSnapshot = {
  id: string;
  workspaceId: string;
  batchId: string;
  testId: string | null;
  roomId: string | null;
  snapshotType: "test_result" | "room_result" | "manual";
  topic: string;
  subject: string;
  chapter: string | null;
  concept: string | null;
  accuracy: number;
  attempts: number;
  averageTimeSeconds: number;
  severity: "high" | "medium" | "low";
  snapshotAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type StudentTopicProfile = {
  id: string;
  workspaceId: string;
  studentId: string;
  batchId: string | null;
  topic: string;
  subject: string;
  chapter: string | null;
  concept: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  averageTimeSeconds: number;
  lastAttemptAt: string | null;
  masteryScore: number;
  updatedAt: string;
  createdAt: string;
};

export type LeaderboardSnapshot = {
  id: string;
  workspaceId: string;
  batchId: string | null;
  testId: string | null;
  roomId: string | null;
  snapshotType: "test" | "room";
  snapshotAt: string;
  entries: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OgcodePublicationStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "published"
  | "changes_requested"
  | "rejected"
  | "archived";

export type OgcodePublication = {
  id: string;
  questionId: string;
  questionVersionId: string;
  contributorWorkspaceId: string | null;
  contributorUserId: string | null;
  attributionName: string;
  attributionLogoAssetId: string | null;
  status: OgcodePublicationStatus;
  version: number;
  moderationNotes: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  supersededBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type OgcodePublicationWithQuestion = OgcodePublication & {
  questionStem?: string | null;
  questionSubject?: string | null;
  questionChapter?: string | null;
};

// ─── Question Bag (Phase 4) ─────────────────────────────────────────────────────

export type AssetOwnerType = "workspace" | "platform" | "user";
export type AssetKind = "image" | "pdf" | "doc" | "docx" | "video" | "audio" | "other";

export type QuestionOwnerScope = "platform" | "workspace";
export type QuestionVisibility = "private" | "workspace" | "public_ogcode";
export type QuestionStatus =
  | "draft"
  | "needs_review"
  | "ready"
  | "published_private"
  | "submitted_to_ogcode"
  | "published_ogcode"
  | "rejected"
  | "archived";
export type QuestionType =
  | "mcq"
  | "msq"
  | "numerical"
  | "numerical_with_units"
  | "symbolic_expression"
  | "equation"
  | "matrix_match"
  | "subjective";
export type QuestionAssetPurpose =
  | "reference_image"
  | "reference_diagram"
  | "reference_table"
  | "solution_image"
  | "source_page_snapshot";

export type Asset = {
  id: string;
  ownerType: AssetOwnerType;
  ownerWorkspaceId: string | null;
  ownerUserId: string | null;
  kind: AssetKind;
  mimeType: string;
  fileName: string;
  byteSize: number;
  sha256: string;
  r2Bucket: string;
  r2ObjectKey: string;
  publicUrl: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
};

export type Question = {
  id: string;
  ownerScope: QuestionOwnerScope;
  workspaceId: string | null;
  createdBy: string;
  currentVersionId: string | null;
  visibility: QuestionVisibility;
  status: QuestionStatus;
  sourceKind: string;
  importedJobId: string | null;
  externalSourceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuestionVersion = {
  id: string;
  questionId: string;
  versionNumber: number;
  questionType: QuestionType;
  stem: string;
  options: QuestionOption[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  answerSpec: Record<string, unknown> | null;
  matrixData: Record<string, unknown> | null;
  hint: string | null;
  explanation: string | null;
  fullSolution: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard" | "insane";
  tags: string[];
  importEvidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type QuestionOption = {
  id: string;
  text: string;
};

export type QuestionAssetLink = {
  questionVersionId: string;
  assetId: string;
  purpose: QuestionAssetPurpose;
  displayOrder: number;
  metadata: Record<string, unknown>;
};

export type QuestionWithVersion = Question & {
  currentVersion: QuestionVersion | null;
  assetLinks: (QuestionAssetLink & { asset: Asset })[];
};

export type QuestionFilter = {
  status?: QuestionStatus | "all";
  subject?: string;
  chapter?: string;
  difficulty?: "easy" | "medium" | "hard" | "insane";
  questionType?: QuestionType;
  search?: string;
};

// ─── Assessment (Phase 5) ─────────────────────────────────────────────────────

export type TestOwnerScope = "student" | "workspace" | "platform";
export type TestStatus = "draft" | "scheduled" | "published" | "live" | "closed" | "archived";
export type TestSource = "manual" | "random" | "imported" | "room" | "analytics_generated";
export type QuestionSourceBank = "ogcode" | "workspace_bag" | "platform_content";
export type AssignmentStatus = "assigned" | "open" | "closed" | "cancelled";
export type AttemptStatus = "in_progress" | "submitted" | "timed_out" | "force_submitted" | "needs_review";
export type GradingStatus = "pending" | "grading" | "completed" | "failed";
export type AnalyticsStatus = "pending" | "processing" | "completed" | "failed";

export type AssessmentTest = {
  id: string;
  ownerScope: TestOwnerScope;
  workspaceId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  subject: string;
  chapter: string | null;
  difficulty: string;
  durationMinutes: number;
  totalQuestions: number;
  status: TestStatus;
  source: TestSource;
  selectionPolicy: Record<string, unknown>;
  scoringPolicy: Record<string, unknown>;
  settings: Record<string, unknown>;
  sourceImportJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestQuestion = {
  testId: string;
  position: number;
  sourceBank: QuestionSourceBank;
  ogcodeQuestionId: string | null;
  contentQuestionId: string | null;
  contentQuestionVersionId: string | null;
  marks: number;
  negativeMarks: number;
  metadata: Record<string, unknown>;
};

export type TestAssignment = {
  id: string;
  testId: string;
  workspaceId: string | null;
  batchId: string | null;
  studentId: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  status: AssignmentStatus;
  assignedBy: string | null;
  assignedAt: string;
  settings: Record<string, unknown>;
};

export type TestAttempt = {
  id: string;
  testId: string;
  assignmentId: string | null;
  workspaceId: string | null;
  batchId: string | null;
  roomId: string | null;
  studentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  serverDeadline: string | null;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number;
  percentage: number | null;
  timeTakenSeconds: number | null;
  gradingStatus: GradingStatus;
  analyticsStatus: AnalyticsStatus;
  metadata: Record<string, unknown>;
};

export type TestAnswer = {
  attemptId: string;
  position: number;
  questionSnapshot: Record<string, unknown>;
  submittedAnswer: Record<string, unknown>;
  gradingResult: Record<string, unknown>;
  timeSpentSeconds: number;
  isMarkedForReview: boolean;
};

export type TestWithQuestions = AssessmentTest & {
  questions: TestQuestion[];
};

export type TestAssignmentWithCounts = TestAssignment & {
  batchName?: string | null;
  studentCount?: number;
};

// ─── Teacher Rooms (Phase 6) ─────────────────────────────────────────────────

export type RoomKind = "student_room" | "teacher_room";

export type TeacherRoomSummary = {
  id: string;
  name: string;
  adminUserId: string;
  createdBy: string;
  status: "lobby" | "in_test" | "finished" | "closed";
  teacherTestId: string | null;
  durationSeconds: number | null;
  startedAt: string | null;
  endedAt: string | null;
  maxParticipants: number;
  createdAt: string;
  updatedAt: string;
  workspaceId: string | null;
  batchId: string | null;
  roomKind: RoomKind;
};

// ─── Document Import (Phase 10) ──────────────────────────────────────────────

export type ImportSourceType = "pdf" | "docx" | "txt" | "image" | "url";
export type ImportJobStatus = "queued" | "processing" | "needs_review" | "succeeded" | "failed" | "cancelled";
export type ImportPageStatus = "pending" | "parsed" | "review_required" | "accepted" | "rejected";
export type ImportQuestionStatus = "draft" | "review_required" | "accepted" | "rejected" | "published";

export type DocumentImportJob = {
  id: string; workspaceId: string; sourceType: ImportSourceType; sourceFileName: string;
  sourceR2ObjectKey: string; sourceR2Bucket: string; sourceMimeType: string;
  sourceSizeBytes: number; sourceSha256: string; subject: string | null; chapter: string | null;
  status: ImportJobStatus; totalPages: number | null; processedPages: number;
  totalQuestions: number | null; acceptedQuestions: number; reviewRequiredQuestions: number;
  errorMessage: string | null; startedAt: string | null; completedAt: string | null;
  createdBy: string; metadata: Record<string, unknown>; createdAt: string; updatedAt: string;
};

export type ImportJobPage = {
  id: string; jobId: string; pageNumber: number; status: ImportPageStatus;
  extractedText: string | null; extractedImages: Record<string, unknown>[];
  reviewNotes: string | null; metadata: Record<string, unknown>; createdAt: string; updatedAt: string;
};

export type ImportJobQuestion = {
  id: string; jobId: string; pageId: string | null; questionNumber: number | null;
  questionType: string | null; subject: string | null; chapter: string | null;
  concept: string | null; questionText: string | null; options: Record<string, unknown> | null;
  correctOption: number | null; correctOptions: Record<string, unknown> | null;
  answerText: string | null; explanation: string | null; hint: string | null;
  hasDiagram: boolean; diagramDescription: string | null; status: ImportQuestionStatus;
  confidenceScore: number | null; reviewNotes: string | null; rejectionReason: string | null;
  questionBagQuestionId: string | null; metadata: Record<string, unknown>;
  createdAt: string; updatedAt: string;
};

export type ImportJobWithProgress = DocumentImportJob & { progressPercent: number; questionsPreview: ImportJobQuestion[] };

// ─── Admin Control Center (Phase 11) ─────────────────────────────────────────

export type WorkspaceSuspensionReason = "policy_violation" | "fraud" | "inactivity" | "admin_request" | "other";

export type WorkspaceAdminSummary = {
  id: string; workspaceType: "personal" | "institute"; displayName: string;
  ownerUserId: string; ownerName: string | null; ownerEmail: string | null;
  status: "active" | "trial" | "suspended" | "closed";
  studentCount: number; batchCount: number; questionCount: number;
  createdAt: string; suspendedAt: string | null; suspensionReason: WorkspaceSuspensionReason | null;
};

export type AdminUserSearchResult = {
  id: string; name: string; email: string; role: "student" | "teacher" | "admin";
  workspaceMemberships: { workspaceId: string; workspaceName: string; role: string }[];
  createdAt: string;
};

export type AdminAuditEvent = {
  id: string; actorUserId: string | null; actorName: string | null;
  workspaceId: string | null; workspaceName: string | null;
  entityType: string; entityId: string; action: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  requestId: string | null; ipHash: string | null; createdAt: string;
};

// ─── Paid Enrollment & Marketplace (Phase 12) ────────────────────────────────
// Aligned with V1/teacher-admin-launch-plan/02-database-schema-design.md
// (Future Commerce section). Schema lives in commerce.* not app.*.

export type OfferingStatus = "draft" | "active" | "paused" | "archived";

/** commerce.order_status — the order lifecycle from the plan. */
export type EnrollmentOrderStatus =
  | "created"
  | "payment_pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export type WorkspaceOffering = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  /** Price in the smallest currency unit (paise / cents). */
  priceMinor: number;
  currency: string;
  /** Single target batch the buyer is enrolled into on payment success. */
  targetBatchId: string | null;
  status: OfferingStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type EnrollmentOrder = {
  id: string;
  offeringId: string;
  workspaceId: string;
  studentId: string;
  status: EnrollmentOrderStatus;
  /** Payment provider name — free-form so we can adopt Razorpay, Stripe,
   * Cashfree, etc. without enum migrations. */
  provider: string | null;
  /** External payment ID returned by the provider (idempotency key). */
  providerPaymentId: string | null;
  amountMinor: number;
  currency: string;
  /** Filled in after status='paid' transitions the student into
   * app.workspace_student_enrollments. */
  enrollmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InstitutePublicProfile = {
  workspaceId: string;
  displayName: string;
  legalName: string | null;
  city: string | null;
  state: string | null;
  country: string;
  subjects: string[];
  courses: string[];
  logoUrl: string | null;
  description: string | null;
  activeOfferings: WorkspaceOffering[];
  studentCount: number;
  batchCount: number;
  verified: boolean;
};
