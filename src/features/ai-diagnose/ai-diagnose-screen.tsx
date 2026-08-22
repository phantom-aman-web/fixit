"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { PageContainer, PageHeader, LoadingState, EmptyState } from "@/components/shared/states";
import { ConfidenceBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, AlertTriangle, CheckCircle2, ArrowRight, Bot, User, MessageSquarePlus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured?: any;
  confidence?: string;
  safetyFlag?: boolean;
}

interface Interpretation {
  equipment: { category: string | null; type?: string | null; brand?: string | null; model?: string | null } | null;
  symptoms: string[];
  observations: string[];
  summary: string;
  reply?: string;
  confidence: number;
  uncertainty: string[];
  clarifyingQuestions: any[];
  escalationRequired: boolean;
  safetyConcerns: string[];
}

export function AIDiagnoseScreen() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [isKnownDomain, setIsKnownDomain] = useState(true);
  
  // Chat history state
  const [chats, setChats] = useState<{ id: string; title: string; updatedAt: string; diagnosticSessionId: string | null }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history list on mount
  useEffect(() => {
    async function loadChats() {
      try {
        const res = await apiFetch<{ chats: any[] }>("/api/ai/chats");
        setChats(res.chats);
      } catch (e) {
        console.error("Failed to load chats", e);
      } finally {
        setLoadingChats(false);
      }
    }
    if (session?.user) {
      loadChats();
    }
  }, [session]);

  // Save messages to current chat whenever messages change
  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;
    const save = async () => {
      try {
        await apiFetch(`/api/ai/chats/${currentChatId}`, {
          method: "PATCH",
          body: JSON.stringify({ messagesJson: JSON.stringify(messages) }),
        });
      } catch (e) {
        console.error("Failed to save chat history", e);
      }
    };
    const timeout = setTimeout(save, 1000);
    return () => clearTimeout(timeout);
  }, [messages, currentChatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChat = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ chat: any }>(`/api/ai/chats/${id}`);
      setCurrentChatId(id);
      setSessionId(res.chat.diagnosticSessionId);
      setInterpretation(null); // Clear interpretation when loading past chats (unless we want to re-run it)
      
      let parsed = [];
      try {
        parsed = JSON.parse(res.chat.messagesJson);
      } catch (e) {}
      setMessages(parsed);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setInterpretation(null);
    setSessionId(null);
    setEscalated(false);
  }, []);

  const handleInterpret = useCallback(async (text: string, activeChatId: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ interpretation: Interpretation | null; safety: any; fellBack: boolean; fallbackReason?: string; isKnownDomain?: boolean }>("/api/ai/interpret", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setIsKnownDomain(res.isKnownDomain ?? false);
      if (res.interpretation) {
        setInterpretation(res.interpretation);
        setEscalated(res.safety.decision === "ESCALATE");
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: (res.interpretation!.reply || res.interpretation!.summary) + (res.fellBack ? "\n\n(AI was unavailable — showing a basic summary. You can continue with the guided diagnostic.)" : ""),
            structured: res.interpretation,
            confidence: res.interpretation!.confidence >= 0.7 ? "high" : res.interpretation!.confidence >= 0.4 ? "medium" : "low",
          },
        ]);
        if (res.safety.decision === "ESCALATE") {
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `⚠️ Safety concern detected: ${res.safety.reason}\n\nWe recommend professional service. You can proceed to find a technician.`,
              safetyFlag: true,
            },
          ]);
        }
      } else {
        toast.error(res.fallbackReason || "AI interpretation failed. You can still use the guided diagnostic.");
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I couldn't analyze your problem right now. You can still use the guided diagnostic flow.",
          },
        ]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input.trim() };
    const text = input.trim();
    setInput("");

    // Start a new chat history if this is the first message
    let activeChatId = currentChatId;
    if (!activeChatId) {
       try {
         const title = text.length > 25 ? text.substring(0, 25) + "..." : text;
         const res = await apiFetch<{ chat: any }>("/api/ai/chats", { 
           method: "POST",
           body: JSON.stringify({ title, messagesJson: JSON.stringify([userMsg]) })
         });
         activeChatId = res.chat.id;
         setCurrentChatId(activeChatId);
         setChats(prev => [{...res.chat, title}, ...prev]);
       } catch (e) {
         console.error("Failed to create chat", e);
       }
    }

    if (!sessionId) {
      const pastUserText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
      const fullContext = pastUserText ? `${pastUserText}\n${text}` : text;
      
      setMessages((m) => [...m, userMsg]);
      await handleInterpret(fullContext, activeChatId!);
    } else {
      setMessages((m) => [...m, userMsg]);
      // Conversational follow-up.
      setLoading(true);
      try {
        const res = await apiFetch<{ response: any; fellBack: boolean }>("/api/ai/converse", {
          method: "POST",
          body: JSON.stringify({ sessionId, message: text }),
        });
        if (res.response) {
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: res.response.reply,
              structured: res.response.extractedInfo,
              confidence: res.response.confidence,
              safetyFlag: res.response.safetyFlag,
            },
          ]);
        } else {
          setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: "I'm having trouble responding right now. You can continue with the guided diagnostic." }]);
        }
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    }
  }, [input, loading, sessionId, handleInterpret, messages, currentChatId]);

  const requestTechnician = useCallback(async () => {
    if (!interpretation?.equipment?.category) {
      toast.error("Could not determine equipment category.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ sessionId: string; problemId: string; preFilledAnswers: number; state: any }>("/api/ai/start-session", {
        method: "POST",
        body: JSON.stringify({ interpretation }),
      });
      setSessionId(res.sessionId);
      
      if (currentChatId) {
        await apiFetch(`/api/ai/chats/${currentChatId}`, {
          method: "PATCH",
          body: JSON.stringify({ diagnosticSessionId: res.sessionId }),
        });
      }

      const repairRes = await apiFetch<{ request: any }>("/api/repair-requests", {
        method: "POST",
        body: JSON.stringify({ problemId: res.problemId, sessionId: res.sessionId }),
      });

      toast.success("Repair request created — finding matching technicians.");
      navigate(`technicians?requestId=${repairRes.request.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [interpretation, currentChatId]);

  const startGuidedDiagnosis = useCallback(async () => {
    if (!interpretation?.equipment?.category) {
      toast.error("Could not determine equipment category. Try the guided flow instead.");
      navigate("diagnose");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ sessionId: string; problemId: string; preFilledAnswers: number; state: any }>("/api/ai/start-session", {
        method: "POST",
        body: JSON.stringify({ interpretation }),
      });
      setSessionId(res.sessionId);
      
      // Link the chat to the new diagnostic session
      if (currentChatId) {
        await apiFetch(`/api/ai/chats/${currentChatId}`, {
          method: "PATCH",
          body: JSON.stringify({ diagnosticSessionId: res.sessionId }),
        });
      }

      if (res.preFilledAnswers > 0) {
        toast.success(`AI pre-filled ${res.preFilledAnswers} answer(s) from your description. The diagnosis is already underway.`);
      }
      navigate(`diagnose/session/${res.sessionId}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [interpretation, currentChatId]);

  if (session?.user.role === undefined && !session) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="AI-assisted diagnosis"
        description="Describe your problem in your own words. FixIt will understand it, then guide you through safe troubleshooting."
      />

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Button className="w-full" variant="outline" onClick={handleNewChat}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
          
          <Card className="flex flex-1 flex-col overflow-hidden h-[540px]">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm">Recent Chats</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {loadingChats ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                ) : chats.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No past chats.</div>
                ) : (
                  chats.map(chat => (
                    <Button 
                      key={chat.id} 
                      variant={currentChatId === chat.id ? "secondary" : "ghost"} 
                      className="w-full justify-start text-left truncate text-xs font-normal" 
                      onClick={() => loadChat(chat.id)}
                    >
                      <MessageSquare className="mr-2 h-3 w-3 shrink-0" />
                      <span className="truncate">{chat.title}</span>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Conversation */}
        <div className="lg:col-span-2">
          <Card className="flex h-[600px] flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Diagnostic assistant
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-normal text-accent-foreground">AI-assisted · Safety-checked</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden p-6 pt-0">
              <ScrollArea className="flex-1 min-h-0" ref={scrollRef as any}>
                <div className="space-y-4 pr-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                      <Bot className="mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Describe what's wrong. For example:
                      </p>
                      <p className="mt-2 text-sm italic text-muted-foreground">
                        "My washing machine makes a loud grinding noise during the spin cycle."
                      </p>
                    </div>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                      {m.role === "assistant" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : m.safetyFlag ? "bg-destructive/10 border border-destructive/30" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        {m.confidence && m.role === "assistant" && (
                          <p className="mt-2 text-xs opacity-70">Confidence: {m.confidence.replaceAll("_", " ")}</p>
                        )}
                      </div>
                      {m.role === "user" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-sm">
                        <span className="animate-pulse">Analyzing…</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2 shrink-0">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe the problem…"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={loading}
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="h-auto">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Interpretation panel */}
        <div className="lg:col-span-1 space-y-4">
          {interpretation ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Understanding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {interpretation.equipment && (
                    <div>
                      <p className="text-xs text-muted-foreground">Equipment</p>
                      <p className="font-medium">
                        {[
                          interpretation.equipment.brand,
                          interpretation.equipment.model,
                          interpretation.equipment.type || interpretation.equipment.category?.replace(/_/g, " "),
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    </div>
                  )}
                  {interpretation.symptoms.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Symptoms</p>
                      <ul className="mt-1 space-y-1">
                        {interpretation.symptoms.map((s, i) => (
                          <li key={i} className="font-medium">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">AI confidence</p>
                    <ConfidenceBadge probability={interpretation.confidence} />
                  </div>
                  {interpretation.safetyConcerns.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Safety concerns</AlertTitle>
                      <AlertDescription>{interpretation.safetyConcerns.join(", ")}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {interpretation.clarifyingQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Clarifying questions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {interpretation.clarifyingQuestions.slice(0, 3).map((q, i) => (
                      <div key={i}>
                        <p className="font-medium">{q.question}</p>
                        {q.suggestedOptions && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {q.suggestedOptions.map((o: string, j: number) => (
                              <button
                                key={j}
                                onClick={() => setInput(o)}
                                className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                              >
                                {o}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {escalated ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Professional service recommended</AlertTitle>
                  <AlertDescription>
                    Based on what you described, we recommend finding a qualified technician rather than attempting DIY troubleshooting.
                  </AlertDescription>
                  <Button className="mt-3 w-full" onClick={() => navigate("technicians")}>
                    Find a technician <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Alert>
              ) : (
                interpretation.equipment?.category && (
                  isKnownDomain ? (
                    <Button className="w-full" onClick={startGuidedDiagnosis} disabled={loading}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Start guided diagnosis
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        We don't have step-by-step guides for this equipment yet. You can keep troubleshooting with the AI above, or request a technician directly.
                      </p>
                      <Button className="w-full" variant="outline" onClick={requestTechnician} disabled={loading}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Request a Technician
                      </Button>
                    </div>
                  )
                )
              )}
            </>
          ) : sessionId ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Diagnosis started</AlertTitle>
              <AlertDescription>
                This chat is linked to an active diagnostic session.
              </AlertDescription>
              <Button className="mt-3 w-full" onClick={() => navigate(`diagnose/session/${sessionId}`)}>
                Resume session <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Alert>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="How this works"
              description="Describe your problem in plain language. FixIt's AI will understand it, then route you into a structured diagnostic session with safe troubleshooting steps."
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
