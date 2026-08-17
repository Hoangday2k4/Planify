import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const generateRandomPassword = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const caps = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const symbols = '!@#$%^&*';

  let pass = '';
  // Ensure at least one lowercase, one uppercase, one number, and one symbol
  pass += chars[Math.floor(Math.random() * chars.length)];
  pass += caps[Math.floor(Math.random() * caps.length)];
  pass += nums[Math.floor(Math.random() * nums.length)];
  pass += symbols[Math.floor(Math.random() * symbols.length)];

  const allChars = chars + caps + nums + symbols;
  for (let i = 0; i < 4; i++) {
    pass += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle
  return pass.split('').sort(() => 0.5 - Math.random()).join('');
};

export const sendResetPasswordEmail = async (to: string, newPassword: string) => {
  const mailOptions = {
    from: `"Planify Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: '[Planify] Yêu cầu đặt lại mật khẩu',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h2 style="color: #2563eb; margin-bottom: 16px;">Khôi phục mật khẩu Planify</h2>
        <p>Xin chào,</p>
        <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên hệ thống Planify.</p>
        <p>Dưới đây là mật khẩu tạm thời mới được hệ thống tạo ngẫu nhiên cho bạn:</p>
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 18px; font-weight: bold; text-align: center; color: #1e293b; letter-spacing: 1px; margin: 20px 0;">
          ${newPassword}
        </div>
        <p style="color: #64748b; font-size: 13px;">Vì lý do bảo mật, vui lòng đăng nhập ngay và đổi mật khẩu của bạn trong mục Cài đặt.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8;">Đây là email tự động từ hệ thống Planify. Vui lòng không trả lời email này.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
