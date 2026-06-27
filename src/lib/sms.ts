// SMS via Twilio (server only). No-ops with a log line if Twilio env isn't set,
// so the rest of the system works without SMS credentials. (PRD §8 notifications.)
import "server-only";
import twilio from "twilio";

export async function sendSms(to: string | undefined, body: string): Promise<boolean> {
  if (!to) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log(`[sms:noop] to=${to} :: ${body}`);
    return false;
  }
  try {
    await twilio(sid, token).messages.create({ to, from, body });
    return true;
  } catch (e) {
    console.error("sms send failed", e);
    return false;
  }
}
