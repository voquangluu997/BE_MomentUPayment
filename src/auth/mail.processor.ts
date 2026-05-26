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

    // 🚀 Nhúng thẳng URL từ biến môi trường của bạn
    const baseUrl = process.env.APP_BASE_URL || 'http://192.168.13.125:8001';
    const activationUrl = `${baseUrl}/auth/activate?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: '"Moment U Payment" <onboarding@resend.dev>',
        to: email,
        subject: '✨ Activate your Moment U Payment account, yayyy! ✨',
        // 🌸 CẬP NHẬT: Giao diện và nội dung tiếng Anh siêu dễ thương kèm nhắc nhở 30 ngày
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 2px dashed #FFCDD2; border-radius: 24px; background-color: #FFFDFD; color: #4E342E;">
            
            <div style="text-align: center; margin-bottom: 25px;">
              <span style="font-size: 50px;">🎉</span>
              <h2 style="color: #E91E63; margin-top: 10px; font-weight: 700; letter-spacing: -0.5px;">
                Welcome to <br/>Moment U Payment! 🥰
              </h2>
            </div>

            <div style="font-size: 15px; line-height: 1.6; color: #5D4037;">
              <p>Hi there, lovely friend! We are absolutely thrilled to have you join <b>Moment U Payment</b> to capture and manage your wonderful spending moments! ✨</p>
              
              <p>To keep your account super safe and unlock all of our adorable, handy features, could you please click the pretty pink button right down here?</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationUrl}" style="background: linear-gradient(135deg, #FF4081, #EC407A); color: white; padding: 14px 32px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 50px; display: inline-block; box-shadow: 0 4px 15px rgba(236, 64, 122, 0.3); transition: all 0.3s ease;">
                🌸 Activate My Account Now!
              </a>
            </div>

            <div style="background-color: #FCE4EC; padding: 12px; border-radius: 12px; font-size: 12px; word-break: break-all; color: #880E4F; margin-bottom: 25px;">
              <i>If the button is playing hard to get and doesn't work, just copy and paste this link into your browser:</i><br/>
              <a href="${activationUrl}" style="color: #EC407A; text-decoration: underline;">${activationUrl}</a>
            </div>

            <hr style="border: none; border-top: 1px double #FFCCCC; margin: 25px 0;" />

            <div style="background-color: #FFF3E0; border-left: 4px solid #FFB74D; padding: 15px; border-radius: 0 12px 12px 0; font-size: 13px; color: #E65100;">
              <p style="margin: 0; font-weight: bold; margin-bottom: 5px;">⚠️ Just a tiny, super important note from us:</p>
              <p style="margin: 0; line-height: 1.5;">
                Due to our strict safety and security rules, if an account isn't verified within <b>30 days</b>, we will sadly have to close it down. We really don't want to lose you, so please activate it today! 🥺
              </p>
            </div>

            <div style="text-align: center; margin-top: 35px; font-size: 12px; color: #BCAAA4;">
              <p>Sending you tons of love from the <b>Moment U Payment</b> team 💖</p>
              <p style="font-size: 11px;">This is an automated email, so no need to reply back to us, okay?</p>
            </div>

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
