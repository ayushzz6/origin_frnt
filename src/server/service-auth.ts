export type ServiceTokenName =
  | "INTERNAL_CRON_TOKEN"
  | "ORIGIN_AI_SERVICE_TOKEN"
  | "GRADER_SERVICE_TOKEN"
  | "ANALYTICS_SERVICE_TOKEN";

export class ServiceAuthConfigurationError extends Error {
  constructor(tokenName: ServiceTokenName) {
    super(`${tokenName} must be configured before this service route can be used.`);
    this.name = "ServiceAuthConfigurationError";
  }
}

export function readRequiredServiceToken(tokenName: ServiceTokenName): string {
  const token = process.env[tokenName]?.trim();
  if (!token) {
    throw new ServiceAuthConfigurationError(tokenName);
  }
  return token;
}

export function isBearerTokenAuthorized(request: Request, tokenName: ServiceTokenName): boolean {
  let expected: string;
  try {
    expected = readRequiredServiceToken(tokenName);
  } catch {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
