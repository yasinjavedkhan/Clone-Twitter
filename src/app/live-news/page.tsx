"use client";

import { useState, useEffect } from "react";
import { 
    Tv, 
    Globe, 
    TrendingUp, 
    Newspaper, 
    Smartphone, 
    Flame,
    ExternalLink,
    Clock,
    Share2,
    Play,
    ChevronRight,
    Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface NewsArticle {
    id: string;
    title: string;
    link: string;
    pubDate: string;
    source: string;
    content?: string;
}

const CATEGORIES = [
    { id: "TOP", label: "Headlines", icon: Flame },
    { id: "WORLD", label: "World", icon: Globe },
    { id: "BUSINESS", label: "Business", icon: TrendingUp },
    { id: "TECHNOLOGY", label: "Tech", icon: Smartphone },
    { id: "SPORTS", label: "Sports", icon: Newspaper },
    { id: "ENTERTAINMENT", label: "Entertainment", icon: Tv },
];

export default function LiveNewsPage() {
    const [activeCategory, setActiveCategory] = useState("TOP");
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleShareNews = (article: NewsArticle) => {
        const shareContent = `${article.title}\n\nRead more: ${article.link}`;
        router.push(`/compose/post?content=${encodeURIComponent(shareContent)}`);
    };

    const summarizeText = (text: string) => {
        if (!text) return "";
        // Remove HTML tags that might come from RSS
        const clean = text.replace(/<[^>]*>?/gm, '');
        // Aggressively truncate to the first 2-3 sentences or first 200 chars for 'important words' feel
        const sentences = clean.split(/[.!?]/);
        const summary = sentences.slice(0, 2).join('. ') + '.';
        return summary.length > 20 ? summary : clean.substring(0, 150) + "...";
    };

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/news?category=${activeCategory}`);
                const data = await res.json();
                if (data.success) {
                    setArticles(data.articles);
                }
            } catch (err) {
                console.error("Error fetching news:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [activeCategory]);

    if (!isMounted) return null;

    return (
        <div className="flex flex-col min-h-screen border-r border-[var(--tw-border-main)] bg-[var(--tw-bg-main)] text-[var(--tw-text-main)]">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-[var(--tw-bg-main)]/80 backdrop-blur-md border-b border-[var(--tw-border-main)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Newspaper className="w-6 h-6 text-indigo-500" />
                    <h1 className="text-xl font-bold tracking-tight">Live News</h1>
                </div>
                <button className="p-2 hover:bg-[var(--tw-text-main)]/5 rounded-full transition">
                    <Search className="w-5 h-5 text-[var(--tw-text-muted)]" />
                </button>
            </header>

            {/* Content Feed starts directly now */}

            {/* Category Tabs */}
            <div className="sticky top-[64px] z-20 bg-[var(--tw-bg-main)]/90 backdrop-blur-sm border-b border-[var(--tw-border-main)] px-2 overflow-x-auto scrollbar-hide">
                <div className="flex min-w-max p-2 gap-1">
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setExpandedId(null); // Reset expansion on category change
                                }}
                                className={cn(
                                    "px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-2 group relative",
                                    isActive 
                                        ? "text-indigo-500" 
                                        : "text-[var(--tw-text-muted)] hover:text-indigo-500"
                                )}
                            >
                                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "scale-110")} />
                                <span className="font-bold text-[15px]">{cat.label}</span>
                                {isActive && (
                                    <motion.div 
                                        layoutId="activeTab"
                                        className="absolute bottom-1 left-4 right-4 h-0.5 bg-indigo-500 rounded-full"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Feed */}
            <main className="flex-grow p-4 sm:p-6 overflow-hidden">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-[var(--tw-text-main)]/5 h-48 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 items-start"
                    >
                        {articles.map((article, idx) => {
                            const isExpanded = expandedId === article.id;
                            return (
                                <motion.article 
                                    key={article.id || idx}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={cn(
                                        "group relative bg-[var(--tw-bg-main)] border border-[var(--tw-border-main)] rounded-2xl p-5 hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] transition-all duration-300 shadow-sm group",
                                        isExpanded && "md:col-span-2 border-indigo-500/50 bg-indigo-500/[0.03] shadow-lg"
                                    )}
                                >
                                    <div className="flex flex-col gap-3 h-full">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                                    <Globe className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <span className="text-[13px] font-bold text-indigo-500 uppercase tracking-tight">
                                                    {article.source}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[12px] text-[var(--tw-text-muted)]">
                                                <Clock className="w-3 h-3" />
                                                {article.pubDate ? new Date(article.pubDate).toLocaleDateString() : "Recently"}
                                            </div>
                                        </div>
                                        
                                        <h3 className={cn(
                                            "text-lg font-bold leading-tight transition-colors",
                                            isExpanded ? "text-indigo-400 text-xl" : "line-clamp-3 group-hover:text-indigo-400"
                                        )}>
                                            {article.title}
                                        </h3>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="py-4 px-1 flex flex-col gap-4">
                                                        <div className="bg-indigo-500/5 border-l-2 border-indigo-500 p-4 rounded-r-xl">
                                                            <p className="text-[15px] leading-relaxed text-[var(--tw-text-main)] italic">
                                                                "{summarizeText(article.content || "")}"
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <a 
                                                                href={article.link} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-full hover:bg-indigo-600 transition flex items-center gap-2"
                                                            >
                                                                Read Full Story
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="mt-auto flex items-center justify-between pt-4 border-t border-[var(--tw-border-main)] group-hover:border-indigo-500/20">
                                            <button 
                                                onClick={() => setExpandedId(isExpanded ? null : article.id)}
                                                className="flex items-center gap-2 text-sm font-bold text-indigo-500 hover:text-indigo-400 transition"
                                            >
                                                {isExpanded ? "Show Less" : "Quick Summary"}
                                                <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                                            </button>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleShareNews(article)}
                                                    className="p-2 hover:bg-indigo-500/10 rounded-full transition text-[var(--tw-text-muted)] hover:text-indigo-500"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </button>
                                                <button className="p-2 hover:bg-indigo-500/10 rounded-full transition text-[var(--tw-text-muted)] hover:text-indigo-500">
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </motion.div>
                )}
                
                {!loading && articles.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--tw-text-muted)]">
                        <Newspaper className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-bold">No news available</h3>
                        <p className="mt-2 max-w-xs mx-auto">We couldn't find any breaking stories for this category right now. Please try another one.</p>
                    </div>
                )}
            </main>

            {/* CSS for scrollbar hiding */}
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
