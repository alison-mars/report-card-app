import z from "zod";

export const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    role: z.enum(["student", "teacher"]).optional(),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

export const verifyOtpSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(4, "OTP must be exactly 4 characters long"),
});

export const completeProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.email(),
    age: z.enum(["18-30", "30-50", "50+"], {
        message: "Please select a valid age group"
    }),
    gender: z.enum(["male", "female", "other"], {
        message: "Please select a valid gender"
    }),
});