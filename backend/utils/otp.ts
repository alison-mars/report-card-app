import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export function generateOTP(): string {
	return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function sendEmailOtp(email: string, otp: string) {
    try {
      const fromAddress = process.env.RESEND_FROM || "onboarding@resend.dev";
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: "Your Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #111827; margin-bottom: 16px;">Email Verification</h2>
            <p style="color: #6b7280; font-size: 14px;">Use the following code to verify your email address:</p>
            <div style="background: #eff6ff; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">${otp}</span>
            </div>
            <p style="color: #9ca3af; font-size: 12px;">This code expires in 15 minutes. If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        throw new Error("Failed to send email");
      }

      console.log(`Email OTP sent successfully to ${email}`, data);
      return otp;
    } catch (error) {
      console.error("Error sending OTP email:", error);
      return null;
    }
}