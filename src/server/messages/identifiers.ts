type DedupeInput = {
  receivedPhoneNumber: string;
  sender: string;
  body: string;
  receivedAt: Date;
};

export function buildDedupeKey(input: DedupeInput) {
  return [
    input.receivedPhoneNumber.trim(),
    input.sender.trim(),
    input.body.trim(),
    input.receivedAt.toISOString()
  ].join("|");
}
