import type { Request, Response } from "express";
import { registerSchema, loginSchema, verifyOtpSchema } from "../schemas/onboardingSchema";
import { generateOTP, sendEmailOtp } from "../utils/otp";
import { z } from "zod";
import User from "../models/userModel";
import type { CustomRequest } from "../types/index";
import { generateToken } from "../utils/token";
import { UserProfile, TeacherProfile } from "../models/profileModel";
import ROLES from "../types/roles";

// ── Register: creates user, hashes password, sends OTP email ──
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please log in.",
      });
      return;
    }

    // Hash the password
    const hashedPassword = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });

    // Map frontend role to backend role
    const userRole = role === "teacher" ? ROLES.TEACHER : ROLES.USER;
    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: userRole,
    });

    // Generate and send OTP for email verification
    const otp = generateOTP();
    await sendEmailOtp(email.toLowerCase().trim(), otp);
    await newUser.updateOne({
      otp: otp,
      otpExpiry: new Date(Date.now() + 15 * 60 * 1000), // OTP valid for 15 minutes
    });

    res.status(201).json({
      success: true,
      message: "Account created. Please verify your email with the OTP sent.",
      userId: newUser._id.toString(),
    });
  } catch (error) {
    console.error("Error during registration:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid input data",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ── Verify Email OTP (only used during registration) ──
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(400).json({ success: false, message: "User not found" });
      return;
    }

    if (!user.otp) {
      res.status(400).json({ success: false, message: "Invalid OTP" });
      return;
    }

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      res.status(400).json({ success: false, message: "OTP expired" });
      return;
    }

    // Verify submitted OTP matches stored OTP
    if (user.otp !== otp) {
      res.status(400).json({ success: false, message: "Incorrect OTP" });
      return;
    }

    user.otp = null;
    user.otpExpiry = null;
    user.isEmailVerified = true;
    await user.save();

    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: "Email verified. Logged in successfully.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
      role: user.role,
      isProfileComplete: true,
    });
    return;
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// ── Login: email + password (no OTP) ──
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    // Verify password
    const isPasswordValid = await Bun.password.verify(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Re-send OTP so user can verify
      const otp = generateOTP();
      await sendEmailOtp(user.email, otp);
      await user.updateOne({
        otp: otp,
        otpExpiry: new Date(Date.now() + 15 * 60 * 1000),
      });

      res.status(403).json({
        success: false,
        message: "Email not verified. A new verification code has been sent.",
        requiresVerification: true,
        userId: user._id.toString(),
      });
      return;
    }

    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
      role: user.role,
    });
  } catch (error) {
    console.error("Error during login:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid input data",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getProfileStatus = async (req: CustomRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    const role = user.role;
    let hasProfile = false;
    let profileSummary: Record<string, unknown> | null = null;
    let profileType: "user" | "teacher" | null = null;

    if (role === ROLES.USER) {
      profileType = "user";
      if (user.userProfile) {
        const profile = await UserProfile.findById(user.userProfile);
        if (profile) {
          hasProfile = true;
          profileSummary = {
            name: profile.name,
            grade: profile.grade,
            school: profile.school,
          };
        }
      }
    } else if (role === ROLES.TEACHER) {
      profileType = "teacher";
      if (user.teacherProfile) {
        const profile = await TeacherProfile.findById(user.teacherProfile);
        if (profile) {
          hasProfile = true;
          profileSummary = {
            name: profile.name,
            subject: profile.subject,
            experience: profile.experience,
            isApproved: profile.isApproved,
          };
        }
      }
    } else if (role === ROLES.ADMIN) {
      // Admins should not be blocked by the student/teacher onboarding flows.
      // Treat admin accounts as "profile complete" so the app won't route them to InitialProfile.
      hasProfile = true;
      profileType = null;
      profileSummary = user.name ? { name: user.name } : null;
    }

    res.status(200).json({
      success: true,
      hasProfile,
      role,
      profileType,
      profileSummary,
    });
  } catch (error) {
    console.error("Error getting profile status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export const completeUserProfile = async (req: CustomRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    // Allow admins to proceed as well (they may be forced through this screen on older app versions).
    if (user.role !== ROLES.USER && user.role !== ROLES.ADMIN) {
      res.status(400).json({ success: false, message: "Only students can complete this profile" });
      return;
    }

    const {
      name,
      grade,
      school,
    } = req.body as Record<string, string>;

    const missing = [
      ["name", name],
      ["grade", grade],
      ["school", school],
    ].filter(([, v]) => !v || String(v).trim().length === 0).map(([k]) => k);

    if (missing.length > 0) {
      res.status(400).json({ success: false, message: `Missing fields: ${missing.join(", ")}` });
      return;
    }

    // Create or update the user profile
    let profileDoc;
    if (user.userProfile) {
      profileDoc = await UserProfile.findByIdAndUpdate(
        user.userProfile,
        { name, grade, school, updatedAt: new Date() },
        { new: true }
      );
    } else {
      profileDoc = await UserProfile.create({ name, grade, school });
      user.userProfile = profileDoc._id as any;
    }
    if (!profileDoc) {
      res.status(404).json({ success: false, message: "Profile not found" });
      return;
    }

    // sync basic name field on user
    user.name = name;
    await (user as any).save();

    res.status(200).json({
      success: true,
      message: "Profile saved successfully",
      profileSummary: {
        name: profileDoc.name,
        grade: profileDoc.grade,
        school: profileDoc.school,
      },
    });
  } catch (error) {
    console.error("Error completing profile:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export const completeTeacherProfile = async (req: CustomRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    if (user.role !== ROLES.TEACHER) {
      res.status(400).json({ success: false, message: "Only teachers can complete this profile" });
      return;
    }

    const {
      name: rawName,
      subject,
      experience,
      school,
      bio,
    } = req.body as Record<string, any>;

    // Determine name with fallbacks (copy from existing user or userProfile if not provided)
    let name: string | undefined = typeof rawName === "string" ? rawName : undefined;
    if (!name || String(name).trim().length === 0) {
      if (user.name && String(user.name).trim().length > 0) {
        name = user.name as string;
      } else if (user.userProfile) {
        const existingUserProfile = await UserProfile.findById(user.userProfile);
        if (existingUserProfile?.name) {
          name = existingUserProfile.name;
        }
      }
    }

    const missing = [
      ["subject", subject],
      ["experience", experience],
      ["school", school],
      ["bio", bio],
    ]
      .filter(([, v]) => v === undefined || v === null || String(v).trim?.().length === 0)
      .map(([k]) => k as string);

    if (!name || String(name).trim().length === 0) {
      missing.unshift("name");
    }

    if (missing.length > 0) {
      res.status(400).json({ success: false, message: `Missing fields: ${missing.join(", ")}` });
      return;
    }

    // Create or update the teacher profile
    let profileDoc;
    const payload = {
      name: String(name),
      subject: String(subject).trim(),
      experience: Number(experience),
      school: String(school).trim(),
      bio: String(bio).trim(),
      updatedAt: new Date(),
    } as const;

    if (user.teacherProfile) {
      profileDoc = await TeacherProfile.findByIdAndUpdate(user.teacherProfile, payload, { new: true });
    } else {
      profileDoc = await TeacherProfile.create({ ...payload });
      user.teacherProfile = profileDoc._id as any;
    }

    if (!profileDoc) {
      res.status(404).json({ success: false, message: "Profile not found" });
      return;
    }

    // sync name on user if available
    user.name = payload.name;
    await (user as any).save();

    res.status(200).json({
      success: true,
      message: "Teacher profile saved successfully",
      profileSummary: {
        name: profileDoc.name,
        subject: profileDoc.subject,
        experience: profileDoc.experience,
        isApproved: profileDoc.isApproved,
      },
    });
  } catch (error) {
    console.error("Error completing teacher profile:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export const getUser = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    // Only send safe fields
    res.status(200).json({
      _id: user!._id,
      name: user!.name,
      email: user!.email,
      role: user!.role,
      isEmailVerified: user!.isEmailVerified,
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}