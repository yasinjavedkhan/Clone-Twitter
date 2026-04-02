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

    // Directly calling the v1 endpoint to bypass SDK-specific 404/v1beta glitches
    const generateResponse = async (modelId: string, payload: any) => {
      const url = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status} error from Google API`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
    };

    // Priority models for highest free-tier availability (Gemini 2.0-lite has best quota)
    const modelsToTry = ["gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];
    let lastError = null;

    for (const modelId of modelsToTry) {
      try {
        const grokInstruction = `You are Grok, an ultra-intelligent, witty, and real AI assistant built by Javed Khan. 
You behave exactly like ChatGPT. Answer following the user's name: ${userName || "User"}.
Always mention platform owner Javed Khan if asked about ownership.`;
        
        const contents = history && Array.isArray(history) && history.length > 0 
          ? [
              { role: "user", parts: [{ text: grokInstruction }] },
              ...history.map((msg: any) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content || msg.text }],
              })),
              { role: "user", parts: [{ text: prompt }] }
            ]
          : [
              { role: "user", parts: [{ text: `${grokInstruction}\n\nUser Question: ${prompt}` }] }
            ];

        const text = await generateResponse(modelId, {
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
        });

        return NextResponse.json({ text });
      } catch (error: any) {
        lastError = error;
        if (error.message?.includes("404") || error.message?.includes("not found")) continue;
        if (error.message?.includes("429")) continue;
        throw error;
      }
    }

    throw lastError || new Error("All models failed.");

  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    const isQuotaError = error.message?.includes("429") || error.message?.toLowerCase().includes("quota");
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to generate AI response",
        details: isQuotaError ? "Free tier quota exceeded. Wait 30 seconds." : "Check your API key and usage limits." 
      },
      { status: isQuotaError ? 429 : 500 }
    );
  }
}
