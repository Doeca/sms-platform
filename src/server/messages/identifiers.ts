type DedupeInput = {
  receivedPhoneNumber: string;
  sender: string;
  body: string;
  receivedAt: Date;
};

type SourceIdentityInput = {
  receivedPhoneNumber: string;
  deviceName?: string | null;
  simSlot?: number | null;
};

export function buildDedupeKey(input: DedupeInput) {
  return JSON.stringify([
    input.receivedPhoneNumber.trim(),
    input.sender.trim(),
    input.body,
    input.receivedAt.toISOString()
  ]);
}

export function buildSourceIdentityKey(input: SourceIdentityInput) {
  return JSON.stringify([
    input.receivedPhoneNumber.trim(),
    input.deviceName?.trim() ?? null,
    input.simSlot ?? null
  ]);
}
