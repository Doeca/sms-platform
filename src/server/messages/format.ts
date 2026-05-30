type SourceLike = {
  receivedPhoneNumber: string;
  deviceName?: string | null;
  simSlot?: number | null;
};

export function formatSourceLabel(source: SourceLike) {
  if (source.deviceName && source.simSlot !== null && source.simSlot !== undefined) {
    return `${source.deviceName} · SIM ${source.simSlot}`;
  }

  if (source.deviceName) {
    return source.deviceName;
  }

  return source.receivedPhoneNumber;
}
