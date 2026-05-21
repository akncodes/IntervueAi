import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://n8n-production-7cbf9.up.railway.app/webhook-test/generate-interview";

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Generate interview questions proxy
app.post("/generate", async (req, res) => {
  try {
    const { role, level, techstack, amount, type, profile } = req.body;

    console.log(`Processing generate request for: ${role} (${level}) - ${amount} questions`);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        level,
        techstack,
        amount,
        type,
        profile,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n responded with status ${response.status}:`, errorText);
      res.status(response.status).json({
        success: false,
        error: `n8n webhook error: ${response.statusText}`,
      });
      return;
    }

    const data = await response.json();
    console.log("Successfully received response from n8n:", data);

    res.json({
      success: true,
      questions: data.questions,
    });
  } catch (error: any) {
    console.error("Error calling n8n webhook:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Internal Server Error proxying to n8n",
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 IntervueAI Express Middleware listening on port ${PORT}`);
  console.log(`🔗 Proxying generation requests to: ${N8N_WEBHOOK_URL}`);
});
