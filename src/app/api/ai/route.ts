import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, userName } = await req.json();

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API Key is not configured. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Using the high-performance gemini-1.5-flash model for ChatGPT-like speed and intelligence
    const modelId = "gemini-1.5-flash";
    
    const systemInstruction = `You are Grok, a world-class AI assistant built by Javed Khan. 
You provide intelligent, helpful, and witty responses just like ChatGPT, but with a unique personality. 
You are context-aware, meaning you remember previous messages in the conversation.
The user's name is ${userName || "User"}. 
If asked about who created you or this platform, always credit Javed Khan.
Be concise but thorough, and use a friendly, state-of-the-art tone.`;

    let model;
    try {
      model = genAI.getGenerativeModel({ model: modelId, systemInstruction });
    } catch (e) {
      console.warn("Primary model initialization failed, falling back to gemini-pro");
      model = genAI.getGenerativeModel({ model: "gemini-pro", systemInstruction });
    }

    const generateResponse = async () => {
      try {
        if (history && Array.isArray(history) && history.length > 0) {
          const chat = model.startChat({
            history: history.map((msg: any) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content || msg.text }],
            })),
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
            },
          });

          const result = await chat.sendMessage(prompt);
          const response = await result.response;
          return response.text();
        } else {
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            systemInstruction
          });
          const response = await result.response;
          return response.text();
        }
      } catch (error: any) {
        if (error.message?.includes("404") || error.message?.includes("not found")) {
          console.warn("Retrying with gemini-pro fallback...");
          const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
          const result = await fallbackModel.generateContent(prompt);
          const response = await result.response;
          return response.text();
        }
        throw error;
      }
    };

    const text = await generateResponse();
    return NextResponse.json({ text });

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
