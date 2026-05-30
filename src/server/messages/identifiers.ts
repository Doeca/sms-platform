type DedupeInput = {
  receivedPhoneNumber: string;
  sender: string;
  body: string;
  receivedAt: Date;
};

export function buildDedupeKey(input: DedupeInput) {
  return JSON.stringify([
    input.receivedPhoneNumber.trim(),
    input.sender.trim(),
    input.body,
    input.receivedAt.toISOString()
  ]);
}
