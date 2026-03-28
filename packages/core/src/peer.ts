import type {
  CapabilityAd,
  ComputeCapabilityKind,
  EvidenceDigestRef,
  PeerRecord,
  PeerRegistryState,
} from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export function createPeerRegistryState(peers: PeerRecord[] = []): PeerRegistryState {
  return {
    id: "tianezha-peer-registry",
    peers,
    updatedAt: nowIso(),
  };
}

export function upsertPeerRecord(
  state: PeerRegistryState,
  peer: PeerRecord,
): PeerRegistryState {
  const peers = state.peers.filter((entry) => entry.id !== peer.id);
  return {
    ...state,
    peers: [...peers, { ...peer, updatedAt: nowIso() }].sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
    updatedAt: nowIso(),
  };
}

export function advertiseCapability(
  state: PeerRegistryState,
  peerId: string,
  capabilityAd: CapabilityAd,
): PeerRegistryState {
  const peer = state.peers.find((entry) => entry.id === peerId);
  if (!peer) {
    throw new Error(`Unknown peer ${peerId}.`);
  }

  const nextPeer: PeerRecord = {
    ...peer,
    capabilityAds: [
      ...peer.capabilityAds.filter((entry) => entry.id !== capabilityAd.id),
      { ...capabilityAd, updatedAt: nowIso() },
    ].sort((left, right) => left.capability.localeCompare(right.capability)),
    updatedAt: nowIso(),
  };

  return upsertPeerRecord(state, nextPeer);
}

export function addEvidenceDigest(
  state: PeerRegistryState,
  peerId: string,
  evidenceDigest: EvidenceDigestRef,
): PeerRegistryState {
  const peer = state.peers.find((entry) => entry.id === peerId);
  if (!peer) {
    throw new Error(`Unknown peer ${peerId}.`);
  }

  const nextPeer: PeerRecord = {
    ...peer,
    evidenceDigests: [
      ...peer.evidenceDigests.filter((entry) => entry.id !== evidenceDigest.id),
      evidenceDigest,
    ],
    updatedAt: nowIso(),
  };

  return upsertPeerRecord(state, nextPeer);
}

export function findPeersByCapability(
  state: PeerRegistryState,
  capability: ComputeCapabilityKind,
) {
  return state.peers
    .filter((peer) => peer.capabilityAds.some((ad) => ad.capability === capability))
    .sort((left, right) => right.reputationScore - left.reputationScore);
}
