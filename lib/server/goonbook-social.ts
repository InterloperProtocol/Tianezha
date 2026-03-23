import { randomUUID } from "crypto";

import {
  GoonBookComment,
  GoonBookCommentRecord,
  GoonBookFollowRecord,
  GoonBookPost,
  GoonBookPostRecord,
  GoonBookProfile,
} from "@/lib/types";
import {
  deleteGoonBookFollowRecord,
  deleteGoonBookLikeRecord,
  getGoonBookFollowRecord,
  getGoonBookLikeRecord,
  listGoonBookCommentsForPostIds,
  listGoonBookFollowRecords,
  listGoonBookLikeRecordsForPostIds,
  upsertGoonBookComment,
  upsertGoonBookFollowRecord,
  upsertGoonBookLikeRecord,
  upsertGoonBookPost,
  upsertGoonBookProfile,
} from "@/lib/server/repository";
import { nowIso } from "@/lib/utils";

const GOONBOOK_INLINE_COMMENT_LIMIT = 20;

function normalizeProfileIds(ids?: string[] | null) {
  return [...new Set((ids || []).map((id) => id?.trim()).filter(Boolean) as string[])];
}

function getPostProfileId(record: {
  profileId?: string | null;
  agentId?: string | null;
}) {
  return record.profileId?.trim() || record.agentId?.trim() || "goonclaw";
}

function likeRecordId(postId: string, profileId: string) {
  return `like:${postId}:${profileId}`;
}

function followRecordId(actorProfileId: string, targetProfileId: string) {
  return `follow:${actorProfileId}:${targetProfileId}`;
}

export async function ensureLegacyPostSocialStateMigrated(
  post: GoonBookPostRecord,
) {
  let nextPost = post;
  const timestamp = nowIso();
  let changed = false;

  for (const profileId of normalizeProfileIds(post.likeProfileIds)) {
    const recordId = likeRecordId(post.id, profileId);
    const existing = await getGoonBookLikeRecord(recordId);
    if (!existing) {
      await upsertGoonBookLikeRecord({
        id: recordId,
        postId: post.id,
        profileId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    changed = true;
  }

  for (const comment of post.comments || []) {
    await upsertGoonBookComment(comment);
    changed = true;
  }

  if (!changed) {
    return post;
  }

  nextPost = {
    ...post,
    comments: [],
    likeProfileIds: [],
    updatedAt: timestamp,
  };
  await upsertGoonBookPost(nextPost);
  return nextPost;
}

export async function ensureLegacyProfileFollowStateMigrated(profile: GoonBookProfile) {
  const followingProfileIds = normalizeProfileIds(profile.followingProfileIds);
  if (!followingProfileIds.length) {
    return profile;
  }

  const timestamp = nowIso();
  for (const targetProfileId of followingProfileIds) {
    const recordId = followRecordId(profile.id, targetProfileId);
    const existing = await getGoonBookFollowRecord(recordId);
    if (!existing) {
      await upsertGoonBookFollowRecord({
        id: recordId,
        actorProfileId: profile.id,
        targetProfileId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  const nextProfile = {
    ...profile,
    followingProfileIds: [],
    updatedAt: timestamp,
  };
  await upsertGoonBookProfile(nextProfile);
  return nextProfile;
}

export async function toggleGoonBookLikeRecord(args: {
  actorProfileId: string;
  post: GoonBookPostRecord;
}) {
  const post = await ensureLegacyPostSocialStateMigrated(args.post);
  const recordId = likeRecordId(post.id, args.actorProfileId);
  const existing = await getGoonBookLikeRecord(recordId);

  if (existing) {
    await deleteGoonBookLikeRecord(recordId);
    return { liked: false };
  }

  const timestamp = nowIso();
  await upsertGoonBookLikeRecord({
    id: recordId,
    postId: post.id,
    profileId: args.actorProfileId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { liked: true };
}

export async function toggleGoonBookFollowRecord(args: {
  actorProfile: GoonBookProfile;
  targetProfileId: string;
}) {
  const actorProfile = await ensureLegacyProfileFollowStateMigrated(args.actorProfile);
  const recordId = followRecordId(actorProfile.id, args.targetProfileId);
  const existing = await getGoonBookFollowRecord(recordId);

  if (existing) {
    await deleteGoonBookFollowRecord(recordId);
    return { following: false };
  }

  const timestamp = nowIso();
  await upsertGoonBookFollowRecord({
    id: recordId,
    actorProfileId: actorProfile.id,
    targetProfileId: args.targetProfileId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { following: true };
}

export async function createGoonBookCommentRecord(args: {
  actorProfile: GoonBookProfile;
  post: GoonBookPostRecord;
  body: string;
}) {
  await ensureLegacyPostSocialStateMigrated(args.post);
  const timestamp = nowIso();
  const comment: GoonBookCommentRecord = {
    id: randomUUID(),
    postId: args.post.id,
    profileId: args.actorProfile.id,
    agentId: args.actorProfile.isAutonomous ? args.actorProfile.id : undefined,
    authorType: args.actorProfile.authorType,
    body: args.body,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await upsertGoonBookComment(comment);
  return comment;
}

export async function getDecoratedProfileContext(
  profileMap: Map<string, GoonBookProfile>,
  viewerProfileId?: string | null,
) {
  const storedFollowRecords = await listGoonBookFollowRecords();
  const mergedFollowRecords = new Map<string, GoonBookFollowRecord>();

  for (const record of storedFollowRecords) {
    mergedFollowRecords.set(record.id, record);
  }

  for (const profile of profileMap.values()) {
    for (const targetProfileId of normalizeProfileIds(profile.followingProfileIds)) {
      const recordId = followRecordId(profile.id, targetProfileId);
      if (!mergedFollowRecords.has(recordId)) {
        mergedFollowRecords.set(recordId, {
          id: recordId,
          actorProfileId: profile.id,
          targetProfileId,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        });
      }
    }
  }

  const followerCounts = new Map<string, number>();
  const followingIdsByActor = new Map<string, Set<string>>();
  for (const record of mergedFollowRecords.values()) {
    followerCounts.set(
      record.targetProfileId,
      (followerCounts.get(record.targetProfileId) || 0) + 1,
    );

    const followingIds = followingIdsByActor.get(record.actorProfileId) || new Set<string>();
    followingIds.add(record.targetProfileId);
    followingIdsByActor.set(record.actorProfileId, followingIds);
  }

  const viewerFollowingIds = new Set(
    [...(followingIdsByActor.get(viewerProfileId || "") || new Set<string>())].sort(),
  );

  function decorateProfile(profile: GoonBookProfile): GoonBookProfile {
    const followingProfileIds = [...(followingIdsByActor.get(profile.id) || new Set<string>())].sort();

    return {
      ...profile,
      followerCount: followerCounts.get(profile.id) || 0,
      followingCount: followingProfileIds.length,
      followingProfileIds,
      isFollowedByViewer: viewerFollowingIds.has(profile.id),
    };
  }

  return {
    decorateProfile,
    decoratedProfiles: new Map(
      [...profileMap.values()].map((profile) => [profile.id, decorateProfile(profile)]),
    ),
  };
}

function decorateComment(
  record: GoonBookCommentRecord,
  decoratedProfiles: Map<string, GoonBookProfile>,
): GoonBookComment {
  const profile =
    decoratedProfiles.get(getPostProfileId(record)) || decoratedProfiles.get("goonclaw");
  if (!profile) {
    throw new Error("Unknown BitClaw profile");
  }

  return {
    ...record,
    profileId: profile.id,
    authorType: record.authorType || profile.authorType,
    agentId: record.agentId || (profile.isAutonomous ? profile.id : undefined),
    accentLabel: profile.accentLabel,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    displayName: profile.displayName,
    handle: profile.handle,
    isAutonomous: profile.isAutonomous,
    subscriptionLabel: profile.subscriptionLabel,
  };
}

export async function getPostSocialContext(posts: GoonBookPostRecord[]) {
  const postIds = posts.map((post) => post.id);
  const [storedComments, storedLikes] = await Promise.all([
    listGoonBookCommentsForPostIds(postIds),
    listGoonBookLikeRecordsForPostIds(postIds),
  ]);

  const commentsByPostId = new Map<string, GoonBookCommentRecord[]>();
  const likeProfileIdsByPostId = new Map<string, Set<string>>();

  for (const post of posts) {
    for (const comment of post.comments || []) {
      const comments = commentsByPostId.get(post.id) || [];
      if (!comments.some((entry) => entry.id === comment.id)) {
        comments.push(comment);
      }
      commentsByPostId.set(post.id, comments);
    }

    for (const profileId of normalizeProfileIds(post.likeProfileIds)) {
      const likeProfileIds = likeProfileIdsByPostId.get(post.id) || new Set<string>();
      likeProfileIds.add(profileId);
      likeProfileIdsByPostId.set(post.id, likeProfileIds);
    }
  }

  for (const comment of storedComments) {
    const comments = commentsByPostId.get(comment.postId) || [];
    if (!comments.some((entry) => entry.id === comment.id)) {
      comments.push(comment);
    }
    commentsByPostId.set(comment.postId, comments);
  }

  for (const like of storedLikes) {
    const likeProfileIds = likeProfileIdsByPostId.get(like.postId) || new Set<string>();
    likeProfileIds.add(like.profileId);
    likeProfileIdsByPostId.set(like.postId, likeProfileIds);
  }

  return {
    commentsByPostId: new Map(
      [...commentsByPostId.entries()].map(([postId, comments]) => [
        postId,
        comments.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      ]),
    ),
    likeProfileIdsByPostId: new Map(
      [...likeProfileIdsByPostId.entries()].map(([postId, profileIds]) => [
        postId,
        [...profileIds].sort(),
      ]),
    ),
  };
}

export function decoratePost(args: {
  post: GoonBookPostRecord;
  decoratedProfiles: Map<string, GoonBookProfile>;
  commentsByPostId: Map<string, GoonBookCommentRecord[]>;
  likeProfileIdsByPostId: Map<string, string[]>;
  viewerProfileId?: string | null;
}) {
  const profile =
    args.decoratedProfiles.get(getPostProfileId(args.post)) ||
    args.decoratedProfiles.get("goonclaw");
  if (!profile) {
    throw new Error("Unknown BitClaw profile");
  }

  const comments = (args.commentsByPostId.get(args.post.id) || []).map((comment) =>
    decorateComment(comment, args.decoratedProfiles),
  );
  const likeProfileIds = args.likeProfileIdsByPostId.get(args.post.id) || [];

  return {
    ...args.post,
    profileId: profile.id,
    authorType: args.post.authorType || profile.authorType,
    agentId: args.post.agentId || (profile.isAutonomous ? profile.id : undefined),
    accentLabel: profile.accentLabel,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    commentCount: comments.length,
    comments: comments.slice(-GOONBOOK_INLINE_COMMENT_LIMIT),
    displayName: profile.displayName,
    handle: profile.handle,
    isAutonomous: profile.isAutonomous,
    likeCount: likeProfileIds.length,
    likedByViewer:
      !!args.viewerProfileId && likeProfileIds.includes(args.viewerProfileId),
    subscriptionLabel: profile.subscriptionLabel,
    mediaCategory: args.post.mediaCategory || null,
    mediaRating: args.post.mediaRating || null,
    stance: args.post.stance || null,
    tradeCard: args.post.tradeCard || null,
    tokenSymbol: args.post.tokenSymbol || null,
  } satisfies GoonBookPost;
}
