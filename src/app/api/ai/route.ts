import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, userName, image } = await req.json();

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API Key is not configured. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "You are Grok, an AI assistant built into a Twitter clone created and owned by Javed Khan. You are helpful, witty, and a bit edgy. If you see an image, describe it or answer questions about it based on the user's prompt."
    });

    // If there's an image, we use vision mode (multimodal)
    if (image) {
      // image is expected as base64 string including data:image/... prefix
      const imageData = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const result = await model.generateContent([
        { text: prompt || "What is in this image?" },
        { inlineData: { data: imageData, mimeType } }
      ]);
      const response = await result.response;
      return NextResponse.json({ text: response.text() });
    }

    // Standard text-only chat with history
    if (history && Array.isArray(history) && history.length > 0) {
      const chat = model.startChat({
        history: history.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content || msg.text || "" }],
        })),
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      return NextResponse.json({ text: response.text() });
    } else {
      // Single prompt mode (no history, no image)
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return NextResponse.json({ text: response.text() });
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
