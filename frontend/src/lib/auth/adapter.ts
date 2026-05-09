import type {APIContext} from "astro";
import {clerkClient, verifyToken} from "@clerk/astro/server";

export type AuthProvider = "custom" | "clerk";

export interface AuthenticatedViewer {
  userId: string;
  displayName: string;
  email: string;
  isTrusted: boolean;
  provider: AuthProvider;
}

export interface AuthAdapter {
  getViewer(context: AuthContext): Promise<AuthenticatedViewer | null>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_USER_ID_LENGTH = 200;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;

const TRUSTED_EMAILS = new Set(
  (import.meta.env.TRUSTED_COMMENTER_EMAILS ?? "")
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean)
);

function readHeader(request: Request, headerName: string): string {
  return request.headers.get(headerName)?.trim() ?? "";
}

type AuthFunctionResult = {
  userId?: unknown;
  isAuthenticated?: unknown;
};

type CurrentUserResult = {
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  primaryEmailAddressId?: unknown;
  emailAddresses?: unknown;
};

function clerkEmailFromUser(user: CurrentUserResult): string {
  const addresses = Array.isArray(user.emailAddresses) ? user.emailAddresses : [];
  const primaryId =
    typeof user.primaryEmailAddressId === "string" ? user.primaryEmailAddressId.trim() : "";

  const readEmail = (entry: unknown): string => {
    if (!entry || typeof entry !== "object" || !("emailAddress" in entry)) return "";
    const value = (entry as {emailAddress?: unknown}).emailAddress;
    return typeof value === "string" ? value.trim() : "";
  };

  if (primaryId) {
    const primary = addresses.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        "id" in entry &&
        typeof (entry as {id?: unknown}).id === "string" &&
        (entry as {id: string}).id === primaryId
    );
    const fromPrimary = readEmail(primary);
    if (fromPrimary) return fromPrimary;
  }

  for (const entry of addresses) {
    const candidate = readEmail(entry);
    if (candidate) return candidate;
  }

  return "";
}

function viewerFromClerkUserRecord(userId: string, user: CurrentUserResult): AuthenticatedViewer | null {
  const firstName = typeof user.firstName === "string" ? user.firstName.trim() : "";
  const lastName = typeof user.lastName === "string" ? user.lastName.trim() : "";
  const username = typeof user.username === "string" ? user.username.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  let email = clerkEmailFromUser(user);
  if (!email) {
    const safeLocal = userId.replace(/[^\w+-]/g, "").slice(0, 64) || "user";
    email = `${safeLocal}@clerk.account`;
  }

  const normalized = sanitizeViewerFields(userId, fullName || username || userId, email);
  if (!normalized) {
    return null;
  }

  return {...normalized, provider: "clerk"};
}

async function tryGetViewerFromBearerToken(apiContext: APIContext): Promise<AuthenticatedViewer | null> {
  const authHeader = apiContext.request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const secretKey = import.meta.env.CLERK_SECRET_KEY;
  if (typeof secretKey !== "string" || !secretKey) {
    return null;
  }

  let payload: {sub?: string};
  try {
    payload = await verifyToken(token, {secretKey});
  } catch {
    return null;
  }

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) {
    return null;
  }

  try {
    const user = await clerkClient(apiContext).users.getUser(userId);
    return viewerFromClerkUserRecord(userId, user as unknown as CurrentUserResult);
  } catch {
    return null;
  }
}

type AuthLocals = {
  auth?: () => AuthFunctionResult;
  currentUser?: () => Promise<CurrentUserResult | null>;
};

export type AuthContext = {
  request: Request;
  locals?: AuthLocals;
};

function sanitizeViewerFields(userId: string, displayName: string, email: string): AuthenticatedViewer | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !userId ||
    !displayName ||
    !normalizedEmail ||
    userId.length > MAX_USER_ID_LENGTH ||
    displayName.length > MAX_DISPLAY_NAME_LENGTH ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_REGEX.test(normalizedEmail)
  ) {
    return null;
  }

  return {
    userId,
    displayName,
    email: normalizedEmail,
    isTrusted: TRUSTED_EMAILS.has(normalizedEmail),
    provider: "custom",
  };
}

/**
 * Default adapter that reads identity from trusted upstream headers.
 * This keeps route logic provider-agnostic and is easy to swap with Clerk.
 */
const headerAuthAdapter: AuthAdapter = {
  async getViewer({request}) {
    const userId = readHeader(request, "x-auth-user-id");
    const displayName = readHeader(request, "x-auth-user-name");
    const email = readHeader(request, "x-auth-user-email");
    return sanitizeViewerFields(userId, displayName, email);
  },
};

const clerkAuthAdapter: AuthAdapter = {
  async getViewer({locals}) {
    if (!locals?.auth || typeof locals.currentUser !== "function") {
      return null;
    }

    const auth = locals.auth();
    if (!auth?.isAuthenticated || typeof auth.userId !== "string") {
      return null;
    }

    const user = await locals.currentUser();
    if (!user) {
      return null;
    }

    return viewerFromClerkUserRecord(auth.userId, user);
  },
};

let authAdapter: AuthAdapter = headerAuthAdapter;

export function setAuthAdapter(adapter: AuthAdapter): void {
  authAdapter = adapter;
}

export async function getAuthenticatedViewer(
  context: AuthContext,
  apiContext?: APIContext
): Promise<AuthenticatedViewer | null> {
  const clerkViewer = await clerkAuthAdapter.getViewer(context);
  if (clerkViewer) {
    return clerkViewer;
  }

  if (apiContext) {
    const bearerViewer = await tryGetViewerFromBearerToken(apiContext);
    if (bearerViewer) {
      return bearerViewer;
    }
  }

  return authAdapter.getViewer(context);
}
