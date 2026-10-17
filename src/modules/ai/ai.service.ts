import { DEVMENTOR_SYSTEM_PROMPT } from "./ai.knowledge.js";
import type { ChatInput } from "./ai.validation.js";
import type { ChatResponse, ChatMessage } from "./ai.interface.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Gemini 2.5 Flash as primary endpoint
const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Groq fallback endpoint
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Helper to dynamically generate contextual suggested prompt chips
 */
function generateSuggestedPrompts(answer: string): string[] {
    const lower = answer.toLowerCase();

    if (lower.includes("credit") || lower.includes("bdt") || lower.includes("bkash")) {
        return [
            "How do I top up credits with bKash?",
            "How do mentor payouts work?",
            "Can I get a refund on credits?",
        ];
    }

    if (lower.includes("review") || lower.includes("quick") || lower.includes("deep")) {
        return [
            "What is the difference between Quick & Deep reviews?",
            "What happens if a mentor misses the 2h SLA?",
            "How do I submit code for review?",
        ];
    }

    if (lower.includes("sprint") || lower.includes("mentor") || lower.includes("session")) {
        return [
            "How do I book a 1-on-1 sprint?",
            "Can I choose my sprint session days?",
            "Find me a mentor for Next.js",
        ];
    }

    return [
        "How does DevCredits escrow work?",
        "Find top mentors for fullstack development",
        "How do modular cohorts work?",
    ];
}


// 1. Call Primary Provider: Google Gemini 2.5 Flash
async function callGeminiChat(
    message: string,
    history: ChatMessage[] = []
): Promise<string> {
    const contents = [
        ...history.map((h) => ({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
        })),
        {
            role: "user",
            parts: [{ text: message }],
        },
    ];

    const payload = {
        system_instruction: {
            parts: [{ text: DEVMENTOR_SYSTEM_PROMPT }],
        },
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
        },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
        throw new Error("Empty candidate response returned by Gemini API");
    }

    return candidateText.trim();
}


// 2. Call Fallback Provider: Groq (llama-3.3-70b-versatile)
async function callGroqChat(
    message: string,
    history: ChatMessage[] = []
): Promise<string> {
    const messages = [
        { role: "system", content: DEVMENTOR_SYSTEM_PROMPT },
        ...history.map((h) => ({
            role: h.role === "model" ? "assistant" : "user",
            content: h.content,
        })),
        { role: "user", content: message },
    ];

    const payload = {
        model: "qwen/qwen3.8-27b",
        messages,
        temperature: 0.7,
        max_tokens: 1200,
    };

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000), // 12 second timeout
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const candidateText = data?.choices?.[0]?.message?.content;

    if (!candidateText) {
        throw new Error("Empty completion returned by Groq API");
    }

    return candidateText.trim();
}

// 3. Static Offline Safety Net (If both providers fail or network is unreachable)
function getStaticFallbackResponse(message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes("credit") || lower.includes("bdt") || lower.includes("cost")) {
        return (
            "### DevCredits & Pricing\n\n" +
            "- **Exchange Rate**: 1 DevCredit = **৳4.00 BDT**.\n" +
            "- **bKash Top-Up**: Students can instantly add credits to their DevWallet via bKash (packages: 50, 100, 250, 500, 1000 Cr).\n" +
            "- **Escrow Protection**: Credits are kept in platform escrow until mentorship sessions or code reviews are delivered."
        );
    }

    if (lower.includes("review") || lower.includes("code")) {
        return (
            "### DevMentor Code Reviews\n\n" +
            "- **Quick Review**: 10 Credits (৳40 BDT) • **2-Hour SLA** (Single functions, quick bug hunting).\n" +
            "- **Deep Review**: 50 Credits (৳200 BDT) • **24-Hour SLA** (Full architecture, security, and optimization).\n" +
            "- If a mentor fails to meet the SLA, credits are immediately returned to your wallet."
        );
    }

    return (
        "### DevMentor AI Assistant\n\n" +
        "Welcome to DevMentor! Here are key areas I can assist you with:\n" +
        "- **1-on-1 Sprints**: Custom mentorship scheduled per session (50 Cr / session).\n" +
        "- **Curated Cohorts**: Multi-session engineering bootcamps with flexible session enrollment.\n" +
        "- **Code Reviews**: Quick (2h SLA / 10 Cr) & Deep (24h SLA / 50 Cr).\n" +
        "- **DevCredits**: 1 Credit = ৳4.00 BDT via bKash."
    );
}

//  Function 1: chatWithAssistant(input: ChatInput): Promise<ChatResponse>
export const chatWithAssistant = async (
    input: ChatInput
): Promise<ChatResponse> => {
    const { message, history = [] } = input;

    // Step 1: Attempt Gemini 2.5 Flash (Primary)
    if (GEMINI_API_KEY) {
        try {
            const answer = await callGeminiChat(message, history as ChatMessage[]);
            return {
                answer,
                suggestedPrompts: generateSuggestedPrompts(answer),
                providerUsed: "gemini",
            };
        } catch (geminiError: any) {
            console.warn(
                `[AI Fallback] Primary Gemini 2.5 Flash call failed: ${geminiError?.message || geminiError}. Attempting Groq fallback...`
            );
        }
    } else {
        console.warn(
            "[AI Service] GEMINI_API_KEY is missing from environment variables."
        );
    }

    // Step 2: Attempt Groq (Fallback)
    if (GROQ_API_KEY) {
        try {
            const answer = await callGroqChat(message, history as ChatMessage[]);
            return {
                answer,
                suggestedPrompts: generateSuggestedPrompts(answer),
                providerUsed: "groq",
            };
        } catch (groqError: any) {
            console.warn(
                `[AI Fallback] Groq fallback failed: ${groqError?.message || groqError}. Using offline fallback knowledge...`
            );
        }
    } else {
        console.warn(
            "[AI Service] GROQ_API_KEY is missing from environment variables."
        );
    }

    // Step 3: Graceful Offline Fallback
    const fallbackAnswer = getStaticFallbackResponse(message);
    return {
        answer: fallbackAnswer,
        suggestedPrompts: generateSuggestedPrompts(fallbackAnswer),
        providerUsed: "fallback",
    };
};

export const aiService = {
    chatWithAssistant,
};
