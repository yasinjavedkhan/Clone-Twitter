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
    
    // Core prompt instruction that will be prepended to ensuring a 'Grok' personality
    const grokInstruction = `You are Grok, an ultra-intelligent, witty, and real AI assistant built by Javed Khan. 
You behave exactly like ChatGPT. Answer following the user's name: ${userName || "User"}.
Always mention platform owner Javed Khan if asked about ownership.
CONVERSATION START:
`;

    // Try the most stable model names
    const modelsToTry = ["gemini-1.5-flash", "gemini-pro"];
    
    const generateResponse = async () => {
      let lastError = null;
      
      for (const modelId of modelsToTry) {
        try {
          // Standard model initialization without v1beta-only features
          const model = genAI.getGenerativeModel({ model: modelId });
          
          if (history && Array.isArray(history) && history.length > 0) {
            const chat = model.startChat({
              history: history.map((msg: any) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content || msg.text }],
              })),
              generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
            });
            const result = await chat.sendMessage(`${grokInstruction}\n\n${prompt}`);
            const response = await result.response;
            return response.text();
          } else {
            const result = await model.generateContent(`${grokInstruction}\n\n${prompt}`);
            const response = await result.response;
            return response.text();
          }
        } catch (error: any) {
          console.error(`Model ${modelId} failed:`, error.message);
          lastError = error;
          // If it's a 404, we continue to the next model
          if (error.message?.includes("404") || error.message?.includes("not found")) continue;
          // Otherwise, if it's a 429 (Quota), we still might want to try another model, but often quotas apply project-wide
          if (error.message?.includes("429")) continue;
          throw error;
        }
      }
      throw lastError || new Error("All models failed to respond.");
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
