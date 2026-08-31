export function pickupReadyMessage(input: { contactName: string; teamName: string; reference: string }) {
  const firstName = input.contactName.trim().split(/\s+/)[0] || "there";
  return `Hi ${firstName}, your ${input.teamName} order (${input.reference}) is ready for pickup at Slugger Athletics in Ocala. Reply here if you have any questions. Reply STOP to opt out.`;
}
