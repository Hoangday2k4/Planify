import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
      port: parseInt(process.env.EMAIL_PORT || '2525'),
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
      },
    });
  }
  return transporter;
};

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    // Nếu chưa cấu hình email user/pass, ta chỉ mô phỏng (log ra console) để tránh crash
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`[Mail Simulation] 
      TO: ${to}
      SUBJECT: ${subject}
      BODY: ${text}
      ----------------------------------------`);
      return;
    }

    const currentTransporter = getTransporter();
    const info = await currentTransporter.sendMail({
      from: '"Planify App" <no-reply@planify.com>',
      to,
      subject,
      text,
      html,
    });

    console.log(`[Mail Server] Email gửi thành công: ${info.messageId}`);
  } catch (error) {
    console.error('[Mail Server] Lỗi khi gửi email:', error);
  }
};
