import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateRandomPassword, sendResetPasswordEmail } from '../services/emailService';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string) => {
  if (!phone) return true;
  const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
  return phoneRegex.test(phone.trim());
};

const validatePasswordStrength = (password: string) => {
  if (password.length < 6) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
};

export const register = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password, phone, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ username, email và password.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Định dạng email không hợp lệ.' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại Việt Nam không hợp lệ (phải bắt đầu bằng 0 và có 10 chữ số).' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Mật khẩu phải tối thiểu 6 ký tự, bao gồm cả chữ cái và chữ số.' });
    }

    // Kiểm tra username hoặc email tồn tại
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username hoặc Email đã được đăng ký sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        phone,
        avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
        role: 'USER'
      }
    });

    // Tạo token cho user đăng ký mới
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Đăng ký tài khoản thành công.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email/username và mật khẩu.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Đăng nhập thành công.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        role: user.role,
        shareToken: user.shareToken,
        shareExpiresAt: user.shareExpiresAt
      }
    });
  } catch (error: any) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        role: user.role,
        shareToken: user.shareToken,
        shareExpiresAt: user.shareExpiresAt
      }
    });
  } catch (error: any) {
    console.error('Lỗi lấy thông tin user:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực.' });
    }

    const userId = req.user.id;
    const { username, email, phone, avatar, password } = req.body;

    if (!username || !email) {
      return res.status(400).json({ message: 'Username và Email không được để trống.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Định dạng email không hợp lệ.' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ message: 'Số điện thoại Việt Nam không hợp lệ (phải bắt đầu bằng 0 và có 10 chữ số).' });
    }

    // Kiểm tra trùng lặp với tài khoản khác
    const checkDuplicate = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { username },
              { email }
            ]
          }
        ]
      }
    });

    if (checkDuplicate) {
      return res.status(400).json({ message: 'Username hoặc Email đã được sử dụng bởi tài khoản khác.' });
    }

    const updateData: any = {
      username,
      email,
      phone,
      avatar
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    const token = jwt.sign(
      { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Cập nhật hồ sơ thành công.',
      token,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        role: updatedUser.role,
        shareToken: updatedUser.shareToken,
        shareExpiresAt: updatedUser.shareExpiresAt
      }
    });
  } catch (error: any) {
    console.error('Lỗi cập nhật hồ sơ:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực.' });
    }

    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập mật khẩu cũ và mật khẩu mới.' });
    }

    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({ message: 'Mật khẩu mới phải tối thiểu 6 ký tự, bao gồm cả chữ cái và chữ số.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không chính xác.' });
    }

    // Hash mật khẩu mới và cập nhật
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.status(200).json({ message: 'Thay đổi mật khẩu thành công.' });
  } catch (error: any) {
    console.error('Lỗi đổi mật khẩu:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const toggleShareToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { enable, expiresAt } = req.body;

    let shareToken = null;
    let shareExpiresAt = null;
    if (enable) {
      const crypto = require('crypto');
      shareToken = crypto.randomBytes(16).toString('hex');
      shareExpiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { shareToken, shareExpiresAt }
    });

    res.status(200).json({
      message: enable ? 'Đã bật chia sẻ lịch biểu.' : 'Đã tắt chia sẻ lịch biểu.',
      shareToken: updatedUser.shareToken,
      shareExpiresAt: updatedUser.shareExpiresAt
    });
  } catch (error: any) {
    console.error('Lỗi cấu hình chia sẻ lịch:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email.' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng với email này.' });
    }

    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    try {
      await sendResetPasswordEmail(email, newPassword);
    } catch (mailErr) {
      console.error('Lỗi gửi mail đặt lại mật khẩu:', mailErr);
      return res.status(500).json({ message: 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.' });
    }

    res.status(200).json({
      message: 'Đặt lại mật khẩu thành công. Mật khẩu mới đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư.'
    });
  } catch (error: any) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const uploadAvatar = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'Vui lòng chọn file để tải lên.' });
    }
    const avatarUrl = `/uploads/${file.filename}`;
    res.status(200).json({ avatarUrl });
  } catch (error) {
    console.error('Lỗi upload avatar:', error);
    res.status(500).json({ message: 'Lỗi server khi upload avatar.' });
  }
};

