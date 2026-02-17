// This file is for Firebase Cloud Functions deployment
// For local development, the API runs on: http://localhost:3301/api/generate
// This is kept as reference for future Firebase deployment

// To deploy to Firebase:
// 1. Install Firebase CLI: npm install -g firebase-tools
// 2. Run: firebase deploy --only functions

// Uncomment below when deploying to Firebase and have firebase-functions installed:
/*
import { onRequest } from "firebase-functions/v2/https";
import { Request, Response } from "express";

export const api = onRequest(
  {
    region: "us-central1",
    cors: true,
  },

  async (req: Request, res: Response) => {
    try {
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const { prompt } = req.body;

      if (!prompt) {
        res.status(400).json({ error: "No prompt provided" });
        return;
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const data: any = await geminiRes.json();
      console.log("GEMINI RAW RESPONSE:", JSON.stringify(data));

      if (!geminiRes.ok) {
        console.error("Gemini Error:", data);
        res.status(500).json({ error: data.error?.message || "Gemini failed" });
        return;
      }

      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

      res.json({ answer: reply });

    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({ error: "Server failed" });
    }
  }
);
*/
