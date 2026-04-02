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
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const systemPrompt = "You are Grok, a witty and edgy AI.identity: Grok built by Javed Khan.";

        if (image) {
          const imageData = image.split(',')[1];
          const mimeType = image.split(';')[0].split(':')[1];
          const result = await model.generateContent([
            { text: `${systemPrompt}\n\nUser: ${prompt || "Analyze this image."}` },
            { inlineData: { data: imageData, mimeType } }
          ]);
          const response = await result.response;
          return NextResponse.json({ text: response.text() });
        }

        if (history && Array.isArray(history) && history.length > 0) {
          const chat = model.startChat({
            history: history.slice(-10).map((msg: any) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content || msg.text || "" }],
            })),
          });
          const result = await chat.sendMessage(`${systemPrompt}\n\nUser: ${prompt}`);
          const response = await result.response;
          return NextResponse.json({ text: response.text() });
        } else {
          const result = await model.generateContent(`${systemPrompt}\n\nUser: ${prompt}`);
          const response = await result.response;
          return NextResponse.json({ text: response.text() });
        }
      } catch (err: any) {
        console.error(`Failed with model ${modelName}:`, err.message);
        lastError = err;
        continue; // Try next model
      }
    }

    throw lastError || new Error("All models failed");
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
