import type {APIRoute} from "astro";
import groq from "groq";
import {sanityClient} from "sanity:client";
import {getAuthenticatedViewer} from "@/lib/auth/adapter";

export const prerender = false;

const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_LENGTH = 1;
const COMMENT_COOLDOWN_SECONDS = 30;

type SubmitCommentBody = {
  postId?: unknown;
  postSlug?: unknown;
  body?: unknown;
  website?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type": "application/json"},
  });
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function resolvePostId(postIdRaw: unknown, postSlugRaw: unknown): Promise<string | null> {
  const postId = normalizeText(postIdRaw);
  if (postId) {
    const matchingPost = await sanityClient.fetch<{_id: string} | null>(
      groq`*[_type == "post" && _id == $postId][0]{_id}`,
      {postId}
    );
    return matchingPost?._id ?? null;
  }

  const postSlug = normalizeText(postSlugRaw);
  if (!postSlug) return null;

  const postFromSlug = await sanityClient.fetch<{_id: string} | null>(
    groq`*[_type == "post" && slug.current == $slug][0]{_id}`,
    {slug: postSlug}
  );
  return postFromSlug?._id ?? null;
}

async function hasRecentComment(authorId: string, postId: string): Promise<boolean> {
  const cutoffIso = new Date(Date.now() - COMMENT_COOLDOWN_SECONDS * 1000).toISOString();
  const recentComment = await sanityClient.fetch<{_id: string} | null>(
    groq`*[
      _type == "comment" &&
      authorId == $authorId &&
      post._ref == $postId &&
      createdAt >= $cutoffIso
    ] | order(createdAt desc)[0]{_id}`,
    {authorId, postId, cutoffIso}
  );
  return Boolean(recentComment?._id);
}

export const POST: APIRoute = async (apiContext) => {
  const {request, locals} = apiContext;
  const viewer = await getAuthenticatedViewer({request, locals}, apiContext);
  if (!viewer) {
    return jsonResponse({ok: false, message: "Authentication required."}, 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ok: false, message: "Invalid JSON."}, 400);
  }

  if (!raw || typeof raw !== "object") {
    return jsonResponse({ok: false, message: "Invalid request body."}, 400);
  }

  const payload = raw as SubmitCommentBody;
  const honeypot = normalizeText(payload.website);
  if (honeypot.length > 0) {
    return jsonResponse({ok: true}, 200);
  }

  const body = normalizeText(payload.body);
  if (body.length < MIN_COMMENT_LENGTH || body.length > MAX_COMMENT_LENGTH) {
    return jsonResponse(
      {
        ok: false,
        message: `Comment must be between ${MIN_COMMENT_LENGTH} and ${MAX_COMMENT_LENGTH} characters.`,
      },
      400
    );
  }

  const resolvedPostId = await resolvePostId(payload.postId, payload.postSlug);
  if (!resolvedPostId) {
    return jsonResponse({ok: false, message: "Post not found."}, 404);
  }

  if (await hasRecentComment(viewer.userId, resolvedPostId)) {
    return jsonResponse(
      {
        ok: false,
        message: `Please wait ${COMMENT_COOLDOWN_SECONDS} seconds before posting another comment.`,
      },
      429
    );
  }

  const writeToken = import.meta.env.SANITY_API_WRITE_TOKEN;
  if (!writeToken) {
    console.error("[comments] SANITY_API_WRITE_TOKEN is not configured.");
    return jsonResponse({ok: false, message: "Server is not configured for comments."}, 500);
  }

  const moderationStatus = viewer.isTrusted ? "approved" : "pending";
  const nowIso = new Date().toISOString();
  const writeClient = sanityClient.withConfig({token: writeToken, useCdn: false});

  try {
    const createdComment = (await writeClient.create({
      _type: "comment",
      post: {_type: "reference", _ref: resolvedPostId},
      authorId: viewer.userId,
      authorName: viewer.displayName,
      authorEmail: viewer.email,
      body,
      status: moderationStatus,
      isTrustedAuthorSnapshot: viewer.isTrusted,
      createdAt: nowIso,
      ...(moderationStatus === "approved" ? {moderatedAt: nowIso} : {}),
    })) as {
      _id: string;
      authorName: string;
      body: string;
      createdAt: string;
    };

    return jsonResponse(
      {
        ok: true,
        status: moderationStatus,
        message:
          moderationStatus === "approved"
            ? "Comment published."
            : "Comment submitted for moderation.",
        ...(moderationStatus === "approved"
          ? {
              comment: {
                id: createdComment._id,
                authorName: createdComment.authorName,
                body: createdComment.body,
                createdAt: createdComment.createdAt,
              },
            }
          : {}),
      },
      200
    );
  } catch (error) {
    console.error("[comments] Failed to create comment", error);
    return jsonResponse({ok: false, message: "Could not submit comment."}, 502);
  }
};
