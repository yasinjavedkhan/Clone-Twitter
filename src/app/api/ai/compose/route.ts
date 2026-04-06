import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: Request) {
    try {
        const { content, promptType } = await req.json();

        if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
        }

        let systemPrompt = "";
        if (promptType === "improve") {
            systemPrompt = `You are a social media expert. Refine the following tweet content to be more engaging, concise, and impactful while maintaining its original meaning. Fix any grammar or spelling mistakes. Output ONLY the refined text without quotes or explanations. Content: "${content}"`;
        } else {
            systemPrompt = `You are a social media expert. Generate a short, engaging tweet based on this idea/prompt: "${content}". Use a natural, human tone. Output ONLY the tweet text without quotes or explanations.`;
        }

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text().trim().replace(/^"|"$/g, '');

        return NextResponse.json({ text });
    } catch (error: any) {
        console.error("Gemini AI error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate AI content" }, { status: 500 });
    }
}
