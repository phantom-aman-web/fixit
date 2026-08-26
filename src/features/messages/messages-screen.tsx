"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useApi, apiFetch } from "@/hooks/use-api";
import { PageContainer, PageHeader, LoadingState, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/store/router";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceIndicator, getPresenceState } from "@/components/shared/presence";
import { Send, MessageSquare, Star, Briefcase, Calendar, Phone, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ContextualSearch, type SearchResultItem } from "@/components/search/contextual-search";
import { scoreItem } from "@/lib/search/ranking";

type Conversation = {
  id: string;
  customerId: string;
  technicianId: string;
  customer: { user: { name: string; lastSeenAt: string; image?: string } };
  technician: { 
    id: string;
    displayName: string; 
    rating: number;
    ratingCount: number;
    completedJobs: number;
    yearsExperience: number;
    bio?: string;
    baseCallOutFee?: number;
    hourlyRate?: number;
    phone?: string;
    user: { lastSeenAt: string; image?: string };
  };
  messages: Message[];
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

export function MessagesScreen() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const role = session?.user?.role;

  const { data, refetch } = useApi<{ conversations: Conversation[] }>(
    ["conversations"],
    "/api/conversations",
    { refetchInterval: 10000, staleTime: 30_000 }
  );
  
  const router = useRouter();
  const initialTechnicianId = router.route.query.technicianId as string | undefined;

  const [activeId, setActiveId] = useState<string | null>(null);
  const processedInitId = useRef<string | null>(null);

  useEffect(() => {
    if (initialTechnicianId && data?.conversations && processedInitId.current !== initialTechnicianId) {
      const existing = data.conversations.find((c) => c.technicianId === initialTechnicianId);
      if (existing) {
        setActiveId(existing.id);
        processedInitId.current = initialTechnicianId;
      } else {
        // Start a new conversation
        apiFetch("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ technicianId: initialTechnicianId }),
        }).then((res) => {
          if (res.conversation) {
            refetch();
            setActiveId(res.conversation.id);
            processedInitId.current = initialTechnicianId;
          }
        });
      }
    }
  }, [initialTechnicianId, data?.conversations, refetch]);

  const conversations = data?.conversations ?? [];
  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <PageContainer>
      <PageHeader title="Messages" description="Chat with your technicians and customers." />
      
      <div className="flex h-[600px] overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        {/* Sidebar */}
        <div className="w-1/3 flex flex-col border-r border-border bg-muted/20">
          <div className="p-3 border-b border-border">
            <ContextualSearch
              queryKey="messages"
              placeholder="Search conversations..."
              onSearch={async (q) => {
                const results: SearchResultItem[] = [];
                for (const c of conversations) {
                  const isTech = role === "TECHNICIAN";
                  const otherName = isTech ? c.customer.user.name : c.technician.displayName;
                  const lastMsg = c.messages[0]?.content || "";
                  
                  const score = scoreItem(q, [
                    { name: "name", value: otherName, weight: 10.0 },
                    { name: "specialty", value: !isTech ? c.technician.bio : "", weight: 5.0 },
                    { name: "message", value: lastMsg, weight: 1.0 },
                  ]);
                  
                  if (score.score > 0) {
                    results.push({
                      id: c.id,
                      title: otherName || "Unknown",
                      subtitle: lastMsg ? (lastMsg.length > 40 ? lastMsg.substring(0, 40) + "..." : lastMsg) : "Conversation",
                      score: score.score + (c.messages.length > 0 ? 5 : 0) // slight recency boost
                    });
                  }
                }
                return results.sort((a, b) => (b.score || 0) - (a.score || 0));
              }}
              onSelect={(item) => setActiveId(item.id)}
            />
          </div>
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations yet.
              </div>
            ) : (
              conversations.map((c) => {
                const isTech = role === "TECHNICIAN";
                const otherName = isTech ? c.customer.user.name : c.technician.displayName;
                const otherLastSeen = isTech ? c.customer.user.lastSeenAt : c.technician.user.lastSeenAt;
                const otherImage = isTech ? c.customer.user.image : c.technician.user.image;
                const finalImage = otherImage ? `/api/uploads/${otherImage}` : undefined;
                const lastMsg = c.messages[0];
                const presence = getPresenceState(otherLastSeen);

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-start gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted ${
                      activeId === c.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar>
                        {finalImage && <AvatarImage src={finalImage} />}
                        <AvatarFallback>{otherName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <PresenceIndicator state={presence} className="absolute bottom-0 right-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate block">{otherName}</span>
                        {(c as any)._count?.messages > 0 && (
                          <span className="ml-2 flex-shrink-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-bold text-white">
                            {(c as any)._count.messages}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate block w-full pr-2">
                        {lastMsg ? lastMsg.content : "No messages yet"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {activeConv ? (
            <ChatArea conversation={activeConv} userId={userId} role={role} />
          ) : (
            <EmptyState icon={MessageSquare} title="No conversation selected" description="Select a conversation from the sidebar to start messaging." />
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function ChatArea({ conversation, userId, role }: { conversation: Conversation; userId?: string; role?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const router = useRouter();

  const isTech = role === "TECHNICIAN";
  const otherName = isTech ? conversation.customer.user.name : conversation.technician.displayName;
  const otherLastSeen = isTech ? conversation.customer.user.lastSeenAt : conversation.technician.user.lastSeenAt;
  const otherImage = isTech ? conversation.customer.user.image : conversation.technician.user.image;
  const finalImage = otherImage ? `/api/uploads/${otherImage}` : undefined;

  const { data } = useApi<{ messages: Message[] }>(
    ["conversations", conversation.id, "messages"],
    `/api/conversations/${conversation.id}/messages`,
    { refetchInterval: 5000, staleTime: 30_000 }
  );

  useEffect(() => {
    if (data?.messages && !sendingRef.current) {
      setMessages((prev) => {
        if (prev.length !== data.messages.length) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          }, 100);
          return data.messages;
        }
        return prev;
      });
    }
  }, [data?.messages]);

  const send = async () => {
    if (!input.trim() || sendingRef.current || !userId) return;
    sendingRef.current = true;
    const content = input.trim();
    setInput("");

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: conversation.id,
      senderId: userId,
      content,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 50);

    try {
      const res = await apiFetch(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      if (res.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
      }
    } catch (e) {
      // Revert optimistic if error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      {/* Header */}
      {isTech ? (
        <div className="flex items-center gap-3 border-b border-border bg-muted/10 p-4">
          <div className="relative">
            <Avatar>
              {finalImage && <AvatarImage src={finalImage} />}
              <AvatarFallback>{otherName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <PresenceIndicator state={getPresenceState(otherLastSeen)} className="absolute bottom-0 right-0" />
          </div>
          <div>
            <h3 className="font-semibold">{otherName}</h3>
            <p className="text-xs text-muted-foreground">{getPresenceState(otherLastSeen)}</p>
          </div>
        </div>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex items-center gap-3 border-b border-border bg-muted/10 p-4 text-left hover:bg-muted/30 transition-colors">
              <div className="relative">
                <Avatar>
                  {finalImage && <AvatarImage src={finalImage} />}
                  <AvatarFallback>{otherName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <PresenceIndicator state={getPresenceState(otherLastSeen)} className="absolute bottom-0 right-0" />
              </div>
              <div>
                <h3 className="font-semibold">{otherName}</h3>
                <p className="text-xs text-muted-foreground">{getPresenceState(otherLastSeen)}</p>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Technician Info</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <Avatar className="h-20 w-20">
                {finalImage && <AvatarImage src={finalImage} />}
                <AvatarFallback className="text-2xl">{otherName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="text-xl font-bold">{otherName}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground">{conversation.technician.rating?.toFixed(1) || 0}</span>
                    <span>({conversation.technician.ratingCount || 0} reviews)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" /> {conversation.technician.completedJobs || 0} jobs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> {conversation.technician.yearsExperience || 0} years exp
                  </span>
                </div>
              </div>
              {conversation.technician.bio && (
                <p className="text-sm text-center mt-2">{conversation.technician.bio}</p>
              )}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {conversation.technician.baseCallOutFee != null && (
                  <Badge variant="outline">Call-out: {formatCurrency(conversation.technician.baseCallOutFee)}</Badge>
                )}
                {conversation.technician.hourlyRate != null && (
                  <Badge variant="outline">Rate: {formatCurrency(conversation.technician.hourlyRate)}/hr</Badge>
                )}
                {conversation.technician.phone && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {conversation.technician.phone}
                  </Badge>
                )}
              </div>
              <Button className="w-full mt-4" variant="outline" onClick={() => router.navigate(`technicians/${conversation.technician.id}`)}>
                View Full Profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
        <div className="flex flex-col gap-3">
          {messages.map((m) => {
            const isMe = m.senderId === userId;
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{m.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMe && m.readAt && " • Read"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background p-4 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button size="icon" onClick={send} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
