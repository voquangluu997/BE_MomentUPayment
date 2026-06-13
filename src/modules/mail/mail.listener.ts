import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

declare const fetch: any;

@Injectable()
export class MailProcessor {
  // Hoặc đổi tên thành MailListener tùy ý bạn
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
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    });
  }

  private async sendViaResend(
    to: string,
    subject: string,
    htmlContent: string,
    from?: string,
  ) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');

    const payload = {
      from: from || process.env.MAIL_FROM || 'onboarding@resend.dev',
      to: [to],
      subject,
      html: htmlContent,
    };
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(payload);

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }
    return data;
  }

  // 🚀 Đã chuyển đổi sang Event Listener nền (async: true giúp chạy non-blocking)
  @OnEvent('mail.send-activation', { async: true })
  async handleSendMail(payload: {
    email: string;
    token: string;
    type: 'welcome' | 'reminder';
  }) {
    const { email, token, type } = payload;

    // 1. Chuẩn bị URL
    const baseUrl =
      process.env.APP_BASE_URL || 'https://be-momentupayment.onrender.com';
    const activationUrl = `${baseUrl}/auth/activate?token=${token}`;

    // 2. Xác định nội dung dựa trên loại email
    const isReminder = type === 'reminder';
    const subject = isReminder
      ? '⚠️ Urgent: Your Moments U Payment account will be closed soon!'
      : '✨ Activate your Moments U Payment account, yayyy! ✨';

    const htmlContent = isReminder
      ? this.getReminderEmailTemplate(activationUrl)
      : this.getWelcomeEmailTemplate(activationUrl);

    // keep test recipient hard-coded per request
    const to = 'voquangluu997@gmail.com';
    const from =
      process.env.MAIL_FROM || '"Moments U Payment" <onboarding@resend.dev>';

    try {
      if (process.env.RESEND_API_KEY) {
        console.log(`✉️ Sending (Resend): [${type}] email sent to [${to}]`);
        await this.sendViaResend(to, subject, htmlContent, from as string);
        console.log(`✉️ Success (Resend): [${type}] email sent to [${to}]`);
        return;
      }
      console.log(`✉️ Sending (smtp): [${type}] email sent to [${to}]`);

      await this.transporter.sendMail({
        from,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`✉️ Success (SMTP): [${type}] email sent to [${to}]`);
    } catch (error) {
      console.error(`❌ Failed to send [${type}] email to [${to}]:`, error);
      throw error;
    }
  }

  // 🚀 Đã chuyển đổi sang Event Listener nền cho tác vụ Quên mật khẩu
  @OnEvent('mail.send-reset-password', { async: true })
  async handleSendResetPassword(payload: { email: string; otp: string }) {
    const { email, otp } = payload;
    const from =
      process.env.MAIL_FROM || '"Moments U Payment" <onboarding@resend.dev>';
    const to = 'voquangluu997@gmail.com';

    const html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px;">
          <h2>Hello there!</h2>
          <p>Someone requested to reset your password. If it was you, please use this code:</p>
          <div style="font-size: 32px; font-weight: bold; color: #E91E63; text-align: center; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `;

    try {
      if (process.env.RESEND_API_KEY) {
        await this.sendViaResend(
          to,
          '🔑 Your Security Code for Moments U Payment',
          html,
          from as string,
        );
        console.log(`✉️ Reset OTP sent (Resend) to: ${to}`);
        return;
      }

      await this.transporter.sendMail({
        from,
        to,
        subject: '🔑 Your Security Code for Moments U Payment',
        html,
      });
      console.log(`✉️ Reset password OTP sent (SMTP) to: ${to}`);
    } catch (error) {
      console.error(`❌ Failed to send reset OTP to [${to}]:`, error);
      throw error;
    }
  }

  // --- Các hàm template riêng biệt giữ nguyên ---
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
