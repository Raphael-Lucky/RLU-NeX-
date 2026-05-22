import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ✅ Use the faster Flash model
const GEMINI_MODEL = "gemini-2.0-flash";

type ChatMessage = {
  role: string;
  content: string;
};

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

// ✅ Fallback responses are instant — no streaming delay
function generateFallbackResponse(messages: ChatMessage[], firstName: string): string {
  const lastUserMessage = messages[messages.length - 1]?.content || "";
  const lowerMsg = lastUserMessage.toLowerCase();
  const nameStr = firstName ? `, ${firstName}` : "";

  if (
    lowerMsg.includes("who created you") ||
    lowerMsg.includes("who made you") ||
    lowerMsg.includes("who built you") ||
    lowerMsg.includes("your creator")
  ) {
    return "I was created by Raphael Lucky Uke. I'm NEX, an AI assistant built to help with writing, coding, research, brainstorming, explanations, and more.";
  }
  if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
    return `Hey there${nameStr}! I'm NEX, your AI assistant. I'm here to help you with analysis, writing, coding, research, and much more. What can I help you with today?`;
  }
  if (lowerMsg.includes("who are you") || lowerMsg.includes("what are you")) {
    return `I'm Nex${nameStr}, an AI assistant designed to help you with a wide range of tasks — from answering questions and writing content to analyzing data and writing code. How can I assist you?`;
  }
  if (lowerMsg.includes("help")) {
    return `I can help you with${nameStr}:\n\n• **Writing & Editing** — drafts, emails, essays, summaries\n• **Coding** — write, debug, and explain code in any language\n• **Analysis** — data interpretation, research, comparisons\n• **Math** — calculations, problem solving, explanations\n• **Creative tasks** — ideas, brainstorming, storytelling\n\nJust ask me anything and I'll do my best!`;
  }
  if (lowerMsg.includes("thank")) {
    return `You're welcome${nameStr}! Always happy to help. Let me know if there's anything else you need.`;
  }
  if (lowerMsg.includes("code") || lowerMsg.includes("javascript") || lowerMsg.includes("python") || lowerMsg.includes("function")) {
    return `I'd love to help you with coding${nameStr}! Could you share more details about what you're working on? For example:\n\n- What language or framework are you using?\n- What's the specific problem or feature?\n- Any error messages you're seeing?\n\nThe more context you give me, the better I can assist!`;
  }
  if (lowerMsg.includes("email") || lowerMsg.includes("write") || lowerMsg.includes("draft")) {
    return `I can definitely help with writing${nameStr}! To give you the best result, could you tell me:\n\n- Who is the audience?\n- What tone should it have (professional, casual, persuasive)?\n- Any key points you want included?\n\nShare the details and I'll draft it for you!`;
  }
  if (lowerMsg.includes("explain") || lowerMsg.includes("what is") || lowerMsg.includes("how does")) {
    return `Great question${nameStr}! I'll do my best to explain this clearly. Could you share a bit more about what specific aspect you'd like me to focus on? That way I can tailor my explanation to what matters most to you.`;
  }
  return `Thanks for your message${nameStr}! I'm Nex, your AI assistant. I'm currently running in a limited mode, but I can still help with general questions and tasks. For full AI-powered conversations, a Google Generative AI API key needs to be configured.\n\nIn the meantime, feel free to ask me anything and I'll do my best to help!`;
}

async function streamText(content: string): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  const CHUNK_SIZE = 32;

  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        const delta = content.slice(i, i + CHUNK_SIZE);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function convertToGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

// ✅ Fire-and-forget DB write — don't block the stream on DB ops
function saveMessageAsync(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  content: string
): void {
  Promise.all([
    supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content,
    }),
    supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId),
  ]).catch(err => console.error("DB write error:", err));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");

    // ✅ Run auth + body parse in parallel to reduce latency
    const [{ data: { user }, error: authError }, bodyJson] = await Promise.all([
      supabase.auth.getUser(token),
      req.json(),
    ]);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages: rawMessages, conversationId } = bodyJson;
    const messages = Array.isArray(rawMessages) ? rawMessages.slice(-10) : rawMessages;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Run profile fetch + conversation validation in parallel
    const parallelChecks: Promise<unknown>[] = [
      supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    ];

    if (conversationId) {
      parallelChecks.push(
        supabase
          .from("conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle()
      );
    }

    const results = await Promise.all(parallelChecks);
    const profileResult = results[0] as { data: { first_name: string } | null };
    const firstName = profileResult?.data?.first_name || "";

    if (conversationId) {
      const convResult = results[1] as { data: { id: string } | null; error: unknown };
      if (!convResult?.data) {
        return new Response(
          JSON.stringify({ error: "Conversation does not belong to this user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const nameGreeting = firstName
      ? `\n- The user's first name is "${firstName}". Use it naturally and warmly — greet them by name when appropriate. Do not overuse it.`
      : "";

    const systemInstruction = `You are Nex, an AI assistant created by Raphael Lucky Uke. Be helpful, direct, and concise. Answer clearly without filler. If asked who created you, say Raphael Lucky Uke.${nameGreeting}`;

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    let assistantContent = "";

    if (geminiApiKey) {
      try {
        const contents = convertToGeminiContents(messages);

        // ✅ Use streamGenerateContent with SSE for lowest latency first token
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ✅ keepalive ensures the connection stays open on edge
          keepalive: true,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.6,
              topK: 40,
              topP: 0.92,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errText}`);
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async start(controller) {
            const reader = response.body!.getReader();
            // ✅ Accumulate partial SSE lines across chunks
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last (possibly incomplete) line in the buffer
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                  if (!line.startsWith("data: ")) continue;
                  const data = line.slice(6).trim();
                  if (!data) continue;

                  try {
                    const parsed = JSON.parse(data);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      assistantContent += text;
                      // ✅ Flush each delta immediately — no buffering
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`)
                      );
                    }
                  } catch {
                    // Skip malformed JSON chunks
                  }
                }
              }

              // ✅ DB write is fire-and-forget — stream closes instantly
              if (conversationId && assistantContent) {
                saveMessageAsync(supabase, conversationId, assistantContent);
              }

              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            // ✅ Tell proxies/CDNs not to buffer the stream
            "X-Accel-Buffering": "no",
          },
        });
      } catch (err) {
        console.error("Gemini API failed, falling back:", err);
        // Fall through to fallback
      }
    }

    // Fallback path
    assistantContent = generateFallbackResponse(messages, firstName);

    if (conversationId && assistantContent) {
      saveMessageAsync(supabase, conversationId, assistantContent);
    }

    const stream = await streamText(assistantContent);

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Nex chat error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});