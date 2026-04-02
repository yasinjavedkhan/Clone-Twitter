import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Model fallback chain: try each model in order if quota exceeded
const MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.0-pro"];

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, userName } = await req.json();

    // Check both private and public key (private is preferred for server routes)
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API Key is not configured." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = `You are Grok, an AI assistant built into a Twitter clone created and owned by Javed Khan. You are helpful, witty, and a bit edgy. The user you are talking to is named ${userName || "User"}. If they ask for their name, tell them it is ${userName || "User"}. If they ask who created or owns this platform, tell them it is Javed Khan.`;

    let lastError: any = null;

    // Try each model in the fallback chain
    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });

        let text: string;

        if (history && Array.isArray(history) && history.length > 0) {
          const chat = model.startChat({
            history: history.map((msg: any) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content || msg.text }],
            })),
            generationConfig: { maxOutputTokens: 1000 },
          });
          const result = await chat.sendMessage(prompt);
          text = result.response.text();
        } else {
          const result = await model.generateContent(prompt);
          text = result.response.text();
        }

        return NextResponse.json({ text });
      } catch (err: any) {
        lastError = err;
        // Only fall through to next model on quota/rate limit errors
        if (err?.message?.includes("429") || err?.message?.includes("quota")) {
          console.warn(`Model ${modelName} quota exceeded, trying next model...`);
          continue;
        }
        // For other errors, fail immediately
        throw err;
      }
    }

    // All models exhausted
    throw lastError;
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to generate AI response",
        details: "Check your API key and usage limits." 
      },
      { status: 500 }
    );
  }
}
