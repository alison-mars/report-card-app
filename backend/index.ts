import express from "express";
import dotenv from "dotenv";
import connectDatabse from "./config/db";
import userRouter from "./routes/userRoutes";
import adminRouter from "./routes/adminRoutes";
import classroomRouter from "./routes/classroomRoutes";
import testRouter from "./routes/testRoutes";
import cors from "cors";
import { Path2D as CanvasPath2D, DOMMatrix as CanvasDOMMatrix, Image as CanvasImage, ImageData as CanvasImageData } from "@napi-rs/canvas";
import fileRoutes from "./routes/fileRoutes";

// Ensure pdfjs-dist has required canvas-like globals in Node
// @ts-ignore
if (!(globalThis as any).Path2D) (globalThis as any).Path2D = CanvasPath2D as unknown as Path2D;
// @ts-ignore
if (!(globalThis as any).DOMMatrix) (globalThis as any).DOMMatrix = CanvasDOMMatrix as unknown as DOMMatrix;
// @ts-ignore
if (!(globalThis as any).Image) (globalThis as any).Image = CanvasImage as unknown as typeof Image;
// @ts-ignore
if (!(globalThis as any).ImageData) (globalThis as any).ImageData = CanvasImageData as unknown as typeof ImageData;
const app = express();

dotenv.config();

connectDatabse();

const allowedOrigins = new Set([
  "https://app.parikshalab.com",
  "https://admin.parikshalab.com",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:19006",
  "http://localhost:3000",
  "http://localhost:5173",
]);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Allow server-to-server tools, curl, health checks, and same-origin requests with no Origin header.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
    "ngrok-skip-browser-warning",
  ],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "25mb" }));
app.get("/", (req, res) => {
  res.send("Hello World");
});
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/classrooms", classroomRouter);
app.use("/api/tests", testRouter);
app.use("/api/file", fileRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});