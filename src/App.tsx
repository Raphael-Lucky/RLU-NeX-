import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useChat } from "./hooks/useChat";
import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [firstName, setFirstName] = useState("");

  const {
    conversations,
    searchQuery,
    setSearchQuery,
    isSearchingMessages,
    activeConversation,
    messages,
    isLoading,
    isTyping,
    streamingContent,
    loadConversations,
    selectConversation,
    startNewConversation,
    sendMessage,
    stopStreaming, // ← add this
    deleteConversation,
    pinConversation,
    renameConversation,
  } = useChat(session?.user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadConversations();
      (async () => {
        const { data } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data?.first_name) setFirstName(data.first_name);
      })();
    }
  }, [session, loadConversations]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (initialLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0d0d0f]">
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0d0f]">
      <Sidebar
        conversations={conversations}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={isSearchingMessages}
        activeConversation={activeConversation}
        onSelect={selectConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
        onPin={pinConversation}
        onRename={renameConversation}
        onLoad={loadConversations}
        firstName={firstName}
        onSignOut={handleSignOut}
      />
      <ChatArea
        conversation={activeConversation}
        messages={messages}
        isLoading={isLoading}
        isTyping={isTyping}
        streamingContent={streamingContent}
        onSend={sendMessage}
        onStop={stopStreaming} // ← add this
        firstName={firstName}
      />
    </div>
  );
}
