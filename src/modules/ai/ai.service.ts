import { prisma } from "../../lib/prisma.js";
import {
    DEVMENTOR_SYSTEM_PROMPT,
    MATCH_SYSTEM_PROMPT,
    buildMatchUserPrompt,
    CODE_SCAN_SYSTEM_PROMPT,
    buildCodeScanUserPrompt,
} from "./ai.knowledge.js";
import type { ChatInput, MatchInput, CodeScanInput } from "./ai.validation.js";
import type {
    ChatResponse,
    ChatMessage,
    MatchResultResponse,
    MatchedMentor,
    MatchedCohort,
    RawMatchOutput,
    CodeScanResponse,
} from "./ai.interface.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Gemini 2.5 Flash as primary endpoint
const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Groq fallback endpoint
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Helper to dynamically generate contextual suggested prompt chips
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

// Function 2: matchMentorsAndCohorts

// Deterministic keyword-matching fallback if LLM calls timeout or fail
function computeKeywordFallbackMatch(
    prompt: string,
    mentors: any[],
    cohorts: any[],
    maxResults: number
): MatchResultResponse {
    const promptWords = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    const scoredMentors: MatchedMentor[] = mentors.map((m) => {
        let score = 50;
        const tags = (m.techStackTags || []).map((t: string) => t.toLowerCase());
        const bio = (m.bio || "").toLowerCase();

        promptWords.forEach((word) => {
            if (tags.some((t: string) => t.includes(word))) score += 20;
            if (bio.includes(word)) score += 10;
        });

        return {
            id: m.userId || m.id,
            name: m.user?.name || "Verified Mentor",
            bio: m.bio,
            experienceLevel: m.experienceLevel,
            techStackTags: m.techStackTags || [],
            matchScore: Math.min(98, score),
            matchReason: `High specialization in relevant stack areas: ${(m.techStackTags || []).slice(0, 3).join(", ")}.`,
            avatarUrl: m.user?.image || null,
        };
    });

    scoredMentors.sort((a, b) => b.matchScore - a.matchScore);

    const scoredCohorts: MatchedCohort[] = cohorts.map((c) => {
        let score = 50;
        const tags = (c.techStackTags || []).map((t: string) => t.toLowerCase());
        const text = `${c.title} ${c.description}`.toLowerCase();

        promptWords.forEach((word) => {
            if (tags.some((t: string) => t.includes(word))) score += 20;
            if (text.includes(word)) score += 10;
        });

        return {
            id: c.id,
            title: c.title,
            description: c.description,
            category: c.techStackTags?.[0] || "Engineering",
            techStackTags: c.techStackTags || [],
            totalCost: c.totalCost,
            matchScore: Math.min(95, score),
            matchReason: `Structured curriculum directly targets your learning objectives.`,
        };
    });

    scoredCohorts.sort((a, b) => b.matchScore - a.matchScore);

    return {
        analysisSummary: `Found matching mentors and cohorts relevant to: "${prompt.slice(0, 60)}..."`,
        recommendedMentors: scoredMentors.slice(0, maxResults),
        recommendedCohorts: scoredCohorts.slice(0, maxResults),
        providerUsed: "fallback",
    };
}

export const matchMentorsAndCohorts = async (
    input: MatchInput
): Promise<MatchResultResponse> => {
    const { prompt, preferredLevel, maxResults = 2 } = input;

    // 1. Fetch Approved Mentors & Published Cohorts from Database
    const [rawMentors, rawCohorts] = await Promise.all([
        prisma.mentorProfile.findMany({
            where: {
                approvalStatus: "APPROVED",
                ...(preferredLevel && preferredLevel !== "ALL"
                    ? { experienceLevel: preferredLevel as any }
                    : {}),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
            take: 12,
        }),
        prisma.cohortProgram.findMany({
            where: {
                status: "PUBLISHED",
                approvalStatus: "APPROVED",
            },
            take: 8,
        }),
    ]);

    // Format candidate summaries for LLM prompt context
    const mentorsContext = rawMentors.map((m) => ({
        id: m.userId || m.id,
        name: m.user?.name || "Verified Mentor",
        experienceLevel: m.experienceLevel,
        techStackTags: m.techStackTags,
        bio: m.bio?.slice(0, 180),
    }));

    const cohortsContext = rawCohorts.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description?.slice(0, 180),
        techStackTags: c.techStackTags,
        totalCost: c.totalCost,
    }));

    const systemPrompt = MATCH_SYSTEM_PROMPT;
    const userPrompt = buildMatchUserPrompt(
        prompt,
        preferredLevel || "ALL",
        mentorsContext,
        cohortsContext,
        maxResults
    );

    // 2. Call AI Provider (Groq fallback or Gemini)
    let parsedResult: RawMatchOutput | null = null;
    let providerUsed: "gemini" | "groq" | "fallback" = "fallback";

    // Attempt Groq (qwen/qwen3.8-27b) first for JSON reliability & speed
    if (GROQ_API_KEY) {
        try {
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "qwen/qwen3.8-27b",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.2, // Low temperature for deterministic JSON output
                    max_tokens: 1000,
                }),
                signal: AbortSignal.timeout(12000),
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                const content = data?.choices?.[0]?.message?.content || "";
                const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
                parsedResult = JSON.parse(cleanJson);
                providerUsed = "groq";
            }
        } catch (err: any) {
            console.warn(`[AI Matcher] Groq ranking call failed: ${err?.message || err}.`);
        }
    }

    // Attempt Gemini if Groq was not available or failed
    if (!parsedResult && GEMINI_API_KEY) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 1000,
                    },
                }),
                signal: AbortSignal.timeout(12000),
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
                parsedResult = JSON.parse(cleanJson);
                providerUsed = "gemini";
            }
        } catch (err: any) {
            console.warn(`[AI Matcher] Gemini ranking call failed: ${err?.message || err}.`);
        }
    }

    // 3. Fallback if AI providers failed to return parseable JSON
    if (!parsedResult) {
        return computeKeywordFallbackMatch(prompt, rawMentors, rawCohorts, maxResults);
    }

    // 4. Merge AI scores back with full database candidate entities
    const mentorMap = new Map(rawMentors.map((m) => [m.userId || m.id, m]));
    const cohortMap = new Map(rawCohorts.map((c) => [c.id, c]));

    const recommendedMentors: MatchedMentor[] = (parsedResult.recommendedMentors || [])
        .map((rm) => {
            const original = mentorMap.get(rm.id);
            if (!original) return null;
            return {
                id: original.userId || original.id,
                name: original.user?.name || "Verified Mentor",
                bio: original.bio,
                experienceLevel: original.experienceLevel,
                techStackTags: original.techStackTags || [],
                matchScore: rm.matchScore || 90,
                matchReason: rm.matchReason || "Matched against your target tech stack.",
                avatarUrl: original.user?.image || null,
            };
        })
        .filter(Boolean) as MatchedMentor[];

    const recommendedCohorts: MatchedCohort[] = (parsedResult.recommendedCohorts || [])
        .map((rc) => {
            const original = cohortMap.get(rc.id);
            if (!original) return null;
            return {
                id: original.id,
                title: original.title,
                description: original.description,
                category: original.techStackTags?.[0] || "Engineering",
                techStackTags: original.techStackTags || [],
                totalCost: original.totalCost,
                matchScore: rc.matchScore || 88,
                matchReason: rc.matchReason || "Curriculum directly relevant to your goal.",
            };
        })
        .filter(Boolean) as MatchedCohort[];

    return {
        analysisSummary: parsedResult.analysisSummary || "Top recommended mentors and cohorts based on your query.",
        recommendedMentors: recommendedMentors.slice(0, maxResults),
        recommendedCohorts: recommendedCohorts.slice(0, maxResults),
        providerUsed,
    };
};

export const aiService = {
    chatWithAssistant,
    matchMentorsAndCohorts,
    scanCodeSnippet: async (input: CodeScanInput): Promise<CodeScanResponse> => {
        return scanCodeSnippet(input);
    },
};

// Function 3: scanCodeSnippet & Static Fallback
function computeStaticCodeScanFallback(
    code: string,
    languageHint: string = "typescript"
): CodeScanResponse {
    const findings: CodeScanResponse["findings"] = [];
    let maintainabilityScore = 90;

    // Rule 1: Detect nested loops
    const lines = code.split("\n");
    let loopDepth = 0;
    let maxLoopDepth = 0;
    let loopLine = 1;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (/\b(for|while)\s*\(/.test(trimmed)) {
            loopDepth++;
            if (loopDepth > maxLoopDepth) {
                maxLoopDepth = loopDepth;
                loopLine = index + 1;
            }
        }
        if (trimmed.includes("}")) {
            loopDepth = Math.max(0, loopDepth - 1);
        }
    });

    if (maxLoopDepth >= 2) {
        maintainabilityScore -= 12;
        findings.push({
            severity: "warning",
            title: "Nested iteration detected (Potential O(N^2) complexity)",
            description: "Nested loops can cause significant performance degradation on large datasets. Consider using a Map/Set lookup.",
            lineRange: `Line ${loopLine}`,
        });
    }

    // Rule 2: Unsafe 'any' types
    const anyMatches = code.match(/:\s*any\b/g);
    if (anyMatches && anyMatches.length > 0) {
        maintainabilityScore -= Math.min(15, anyMatches.length * 5);
        findings.push({
            severity: "warning",
            title: `Loose typing detected (${anyMatches.length} 'any' type usages)`,
            description: "Bypassing TypeScript's compiler checks with 'any' increases runtime vulnerability. Replace with strict interfaces or unknown.",
        });
    }

    // Rule 3: Leftover debug statements
    if (/console\.(log|debug|info)\(/.test(code)) {
        maintainabilityScore -= 5;
        findings.push({
            severity: "suggestion",
            title: "Leftover debugging statements",
            description: "Direct console outputs should be removed or routed through a structured logger before production escrow review.",
        });
    }

    // Rule 4: TODO / FIXME flags
    if (/\/\/\s*(TODO|FIXME)/i.test(code)) {
        findings.push({
            severity: "suggestion",
            title: "Unresolved TODO / FIXME markers found",
            description: "Ensure temporary flags or incomplete logic are resolved before the mentor conducts deep architectural review.",
        });
    }

    if (findings.length === 0) {
        findings.push({
            severity: "suggestion",
            title: "Code structure appears clean",
            description: "No immediate static violations detected. Mentor will focus on architecture and business logic edge cases.",
        });
    }

    return {
        language: languageHint || "TypeScript",
        complexitySummary: {
            timeComplexity: maxLoopDepth >= 2 ? "O(N^2)" : "O(N)",
            spaceComplexity: "O(1)",
            maintainabilityScore: Math.max(40, Math.min(100, maintainabilityScore)),
        },
        findings,
        suggestedMentorFocus: [
            "Verify edge case inputs, concurrency handling, and error boundaries.",
            "Review database queries and async promise propagation.",
        ],
        mentorFocusNotes: "Scrutinize runtime data validation and error recovery flow.",
        providerUsed: "fallback",
    };
}

export const scanCodeSnippet = async (
    input: CodeScanInput
): Promise<CodeScanResponse> => {
    const { code, language = "typescript", context } = input;
    const systemPrompt = CODE_SCAN_SYSTEM_PROMPT;
    const userPrompt = buildCodeScanUserPrompt(code, language, context);

    let parsedResult: any = null;
    let providerUsed: "gemini" | "groq" | "fallback" = "fallback";

    // Step 1: Attempt Groq (qwen/qwen3.8-27b)
    if (GROQ_API_KEY) {
        try {
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "qwen/qwen3.8-27b",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.1,
                    max_tokens: 1500,
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                const content = data?.choices?.[0]?.message?.content || "";
                const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
                parsedResult = JSON.parse(cleanJson);
                providerUsed = "groq";
            }
        } catch (groqErr: any) {
            console.warn(`[AI Scan Fallback] Groq scan failed: ${groqErr?.message || groqErr}. Routing to Gemini...`);
        }
    }

    // Step 2: Attempt Gemini
    if (!parsedResult && GEMINI_API_KEY) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: `${systemPrompt}\n\n${userPrompt}` },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1500,
                    },
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
                parsedResult = JSON.parse(cleanJson);
                providerUsed = "gemini";
            }
        } catch (geminiErr: any) {
            console.warn(`[AI Scan Fallback] Gemini scan failed: ${geminiErr?.message || geminiErr}.`);
        }
    }

    // Step 3: Format result or fallback
    if (parsedResult) {
        const mentorFocusArray: string[] = Array.isArray(parsedResult.suggestedMentorFocus)
            ? parsedResult.suggestedMentorFocus
            : parsedResult.mentorFocusNotes
            ? [parsedResult.mentorFocusNotes]
            : ["Review edge case handling and data validation."];

        return {
            language: parsedResult.language || language || "TypeScript",
            complexitySummary: {
                timeComplexity: parsedResult.complexitySummary?.timeComplexity || "O(N)",
                spaceComplexity: parsedResult.complexitySummary?.spaceComplexity || "O(1)",
                maintainabilityScore:
                    typeof parsedResult.complexitySummary?.maintainabilityScore === "number"
                        ? parsedResult.complexitySummary.maintainabilityScore
                        : 85,
            },
            findings: Array.isArray(parsedResult.findings) ? parsedResult.findings : [],
            suggestedMentorFocus: mentorFocusArray,
            mentorFocusNotes: parsedResult.mentorFocusNotes || mentorFocusArray.join(" "),
            providerUsed,
        };
    }

    return computeStaticCodeScanFallback(code, language);
};

