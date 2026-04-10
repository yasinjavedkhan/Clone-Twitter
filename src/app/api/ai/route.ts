import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, userName, userId } = await req.json();

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

    let contextInjection = "";
    
    try {
        const promptLower = prompt.toLowerCase();
        const isQueryingPosts = promptLower.includes("post") || promptLower.includes("tweet") || promptLower.includes("tweets") || promptLower.includes("posts");
        const isTimeBound = promptLower.includes("today") || promptLower.includes("last") || promptLower.includes("latest") || promptLower.includes("recent") || promptLower.includes("my");
        
        if (userId && isQueryingPosts && isTimeBound) {
            const adminDb = getAdminDb();
            let query = adminDb.collection("tweets").where("userId", "==", userId).orderBy("createdAt", "desc");
            
            if (promptLower.includes("today")) {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                query = query.where("createdAt", ">=", startOfToday);
            } else {
                query = query.limit(5); // fallback to 5 latest posts
            }
            
            const snapshot = await query.get();
            
            if (!snapshot.empty) {
                const tweets = snapshot.docs.map(doc => doc.data());
                contextInjection = `\n\n[SYSTEM DICTATION: The user is asking about their posts. The database has automatically retrieved their matching posts. Do NOT say 'I retrieved this from the database'. Act naturally like you just know this. Here are the user's posts:\n${tweets.map((t, i) => `${i + 1}. Content: "${t.content}" (Posted at: ${t.createdAt ? t.createdAt.toDate().toLocaleString() : 'recently'})`).join('\n')}\n\nIMPORTANT: When you mention or summarize these posts, you MUST provide a clickable markdown link to the user's profile where they can view them. Use this exact markdown syntax: [View Post](/profile/${userId}). NEVER generate or hallucinate any markdown images (like ![image](url)). Only provide the text summary and the link.]`;
            } else {
                contextInjection = `\n\n[SYSTEM DICTATION: The user is asking about their posts, but the database shows they have no posts matching this query. Inform them nicely. NEVER generate any markdown images.]`;
            }
        }
    } catch (dbError) {
        console.error("Error fetching user posts for AI context:", dbError);
    }

    // Priority models for highest free-tier availability (Gemini 2.5-flash-lite has best current quota)
    const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];
    let lastError = null;

    for (const modelId of modelsToTry) {
      try {
        const grokInstruction = `You are Grok, an ultra-intelligent, witty, and real AI assistant built by Javed Khan. 
You behave exactly like ChatGPT. Answer following the user's name: ${userName || "User"}.
Always mention platform owner Javed Khan if asked about ownership. NEVER completely hallucinate images or markdown image tags like ![img](url).${contextInjection}`;
        
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
        console.warn(`Model ${modelId} failed:`, error.message);
        if (error.message?.includes("404") || error.message?.includes("not found")) continue;
        if (error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) continue;
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
