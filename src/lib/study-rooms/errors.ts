export function isStudyRoomUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("study room was not found") ||
    message.includes("not an active participant") ||
    message.includes("room code is invalid or expired") ||
    message.includes("room is no longer")
  );
}
