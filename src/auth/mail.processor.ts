import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

@Processor('mail-queue')
export class MailProcessor {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT, 10),
      secure: true, // MUST be true for port 465
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  @Process('send-activation-email')
  async handleSendMail(job: Job<{ email: string; token: string }>) {
    const { email, token } = job.data;

    // 1. ĐỌC URL GỐC TỪ FILE .ENV VÀ SỬ DỤNG
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:8001';
    const activationUrl = `${baseUrl}/auth/activate?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: '"Moment U Payment" <onboarding@resend.dev>',
        to: email,
        subject: 'Activate Your Moment U Payment Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #008080; text-align: center;">Welcome to Moment U Payment!</h2>
            <p>Thank you for registering an account with us. To get started and secure your financial data, please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationUrl}" style="background-color: #008080; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>
            <p style="color: #666; font-size: 12px;">If the button above doesn't work, you can copy and paste the following link into your browser: <br> <a href="${activationUrl}">${activationUrl}</a></p>
            <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
            <p style="font-size: 11px; color: #999; text-align: center;">This is an automated system email, please do not reply to this message.</p>
          </div>
        `,
      });

      console.log(
        `✉️ Resend SMTP: Activation email successfully dispatched to [${email}] via [${baseUrl}]`,
      );
    } catch (error) {
      console.error('❌ Resend SMTP connection or delivery failed:', error);
      throw error;
    }
  }
}
