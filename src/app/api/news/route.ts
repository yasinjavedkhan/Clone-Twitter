import { NextResponse } from "next/server";
import Parser from "rss-parser";

const parser = new Parser();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "TOP";
    
    // Map internal categories to Google News topic IDs
    const topicMap: Record<string, string | null> = {
        "TOP": null, // Special case for headlines
        "WORLD": "WORLD",
        "NATION": "NATION",
        "BUSINESS": "BUSINESS",
        "TECHNOLOGY": "TECHNOLOGY",
        "ENTERTAINMENT": "ENTERTAINMENT",
        "SPORTS": "SPORTS",
        "SCIENCE": "SCIENCE",
        "HEALTH": "HEALTH"
    };

    const topicId = topicMap[category.toUpperCase()];
    
    let url = "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en";
    if (topicId) {
        url = `https://news.google.com/rss/headlines/section/topic/${topicId}?hl=en-IN&gl=IN&ceid=IN:en`;
    }

    try {
        const feed = await parser.parseURL(url);
        
        const articles = feed.items.map(item => {
            // Extract a cleaner image if possible or use a default based on source
            // Note: Google News RSS doesn't always provide easy image URLs in the main fields
            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                source: item.creator || feed.title,
                content: item.contentSnippet || item.content,
                id: item.guid,
            };
        });

        return NextResponse.json({ 
            success: true, 
            category,
            title: feed.title,
            articles 
        });
    } catch (error) {
        console.error("News API Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: "Failed to fetch news" 
        }, { status: 500 });
    }
}
