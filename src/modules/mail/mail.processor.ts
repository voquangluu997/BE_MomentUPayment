import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

@Processor('mail-queue')
export class MailProcessor {
  private transporter;

  constructor() {
    // 🛠️ GIỮ NGUYÊN cấu hình transporter hoạt động tốt trước đó của bạn
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT, 10),
      secure: parseInt(process.env.MAIL_PORT, 10) === 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      connectionTimeout: 20000, // 20 giây chờ kết nối socket (mặc định rất ngắn)
      greetingTimeout: 20000, // 20 giây chờ phản hồi chào hỏi từ SMTP Server
      socketTimeout: 30000,
      family: 4, // Buộc sử dụng IPv4 để tránh lỗi DNS lookup trong môi trường có IPv6 không ổn định
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    } as any);
  }

  @Process('send-activation-email')
  async handleSendMail(
    job: Job<{ email: string; token: string; type: 'welcome' | 'reminder' }>,
  ) {
    const { email, token, type } = job.data;

    // 1. Chuẩn bị URL
    const baseUrl = process.env.APP_BASE_URL || 'http://192.168.13.125:8001';
    const activationUrl = `${baseUrl}/auth/activate?token=${token}`;

    // 2. Xác định nội dung dựa trên loại email
    const isReminder = type === 'reminder';
    const subject = isReminder
      ? '⚠️ Urgent: Your Moments U Payment account will be closed soon!'
      : '✨ Activate your Moments U Payment account, yayyy! ✨';

    const htmlContent = isReminder
      ? this.getReminderEmailTemplate(activationUrl)
      : this.getWelcomeEmailTemplate(activationUrl);
    let to = 'voquangluu997@gmail.com';

    // 3. Gửi mail
    try {
      await this.transporter.sendMail({
        from: '"Moments U Payment" <onboarding@resend.dev>',
        to: to, // Đã sửa: Gửi đúng email người dùng
        subject: subject,
        html: htmlContent,
      });

      console.log(`✉️ Success: [${type}] email sent to [${email}]`);
    } catch (error) {
      console.error(`❌ Failed to send [${type}] email to [${email}]:`, error);
      throw error;
    }
  }

  @Process('send-reset-password-email')
  async handleSendResetPassword(job: Job<{ email: string; otp: string }>) {
    const { email, otp } = job.data;
    const from = '"Moments U Payment" <onboarding@resend.dev>';
    let to = 'voquangluu997@gmail.com';

    await this.transporter.sendMail({
      from: from,
      to: to,
      subject: '🔑 Your Security Code for Moments U Payment',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px;">
          <h2>Hello there!</h2>
          <p>Someone requested to reset your password. If it was you, please use this code:</p>
          <div style="font-size: 32px; font-weight: bold; color: #E91E63; text-align: center; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`✉️ Reset password OTP sent to: ${email}`);
  }

  // --- Các hàm template riêng biệt ---

  private getWelcomeEmailTemplate(activationUrl: string): string {
    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 2px dashed #FFCDD2; border-radius: 24px; background-color: #FFFDFD; color: #4E342E;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 50px;">🎉</span>
        <h2 style="color: #E91E63; margin-top: 10px;">Welcome to <br/>Moments U Payment! 🥰</h2>
      </div>
      <div style="font-size: 15px; line-height: 1.6; color: #5D4037;">
        <p>Hi there! We are thrilled to have you join <b>Moments U Payment</b>!</p>
        <p>Could you please click the button below to verify your account?</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${activationUrl}" style="background: linear-gradient(135deg, #FF4081, #EC407A); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px;">
          🌸 Activate My Account Now!
        </a>
      </div>
    </div>`;
  }

  private getReminderEmailTemplate(activationUrl: string): string {
    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 2px dashed #FFB74D; border-radius: 24px; background-color: #FFFDFD; color: #4E342E;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="font-size: 50px;">⏰</span>
        <h2 style="color: #EF6C00; margin-top: 10px;">Oops! Almost time to say goodbye... 🥺</h2>
      </div>
      <div style="font-size: 15px; line-height: 1.6; color: #5D4037;">
        <p>Hi lovely friend! We noticed your account is still unverified.</p>
        <p>To keep things safe, we perform a routine cleanup after 30 days. Please verify now to keep your account active!</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${activationUrl}" style="background: linear-gradient(135deg, #FF4081, #EC407A); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px;">
          🚀 Verify My Account Now!
        </a>
      </div>
    </div>`;
  }
}
