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
