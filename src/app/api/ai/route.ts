import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { prompt, history } = await req.json();

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API Key is not configured. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // If we have history, we use the chat method for context-aware conversation
    if (history && Array.isArray(history) && history.length > 0) {
      const chat = model.startChat({
        history: history.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content || msg.text }],
        })),
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      return NextResponse.json({ text });
    } else {
      // Single prompt mode
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return NextResponse.json({ text });
    }
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
