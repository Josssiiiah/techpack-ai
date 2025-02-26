"use client";

import type { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { ChatHeader } from "@/components/chat-header";
import type { Vote } from "@/lib/db/schema";
import { fetcher, generateUUID } from "@/lib/utils";

import { Artifact } from "./artifact";
import { MultimodalInput } from "./multimodal-input";
import { Messages } from "./messages";
import { VisibilityType } from "./visibility-selector";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate("/api/history");
    },
    onError: (error) => {
      toast.error("An error occured, please try again!");
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      {isArtifactVisible ? (
        <PanelGroup direction="horizontal" className="h-dvh w-full">
          <Panel defaultSize={40} minSize={30}>
            <div className="flex flex-col min-w-0 h-dvh bg-background">
              <ChatHeader
                chatId={id}
                selectedModelId={selectedChatModel}
                selectedVisibilityType={selectedVisibilityType}
                isReadonly={isReadonly}
              />

              <Messages
                chatId={id}
                isLoading={isLoading}
                votes={votes}
                messages={messages}
                setMessages={setMessages}
                reload={reload}
                isReadonly={isReadonly}
                isArtifactVisible={isArtifactVisible}
              />

              <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
                {!isReadonly && (
                  <MultimodalInput
                    chatId={id}
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    isLoading={isLoading}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    setMessages={setMessages}
                    append={append}
                  />
                )}
              </form>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 hover:w-1.5 bg-border hover:bg-primary transition-all" />

          <Panel defaultSize={60} minSize={40}>
            <div className="h-dvh w-full relative">
              <Artifact
                chatId={id}
                input={input}
                setInput={setInput}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                stop={stop}
                attachments={attachments}
                setAttachments={setAttachments}
                append={append}
                messages={messages}
                setMessages={setMessages}
                reload={reload}
                votes={votes}
                isReadonly={isReadonly}
                useResizableLayout={true}
              />
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex flex-col min-w-0 h-dvh bg-background">
          <ChatHeader
            chatId={id}
            selectedModelId={selectedChatModel}
            selectedVisibilityType={selectedVisibilityType}
            isReadonly={isReadonly}
          />

          <Messages
            chatId={id}
            isLoading={isLoading}
            votes={votes}
            messages={messages}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
          />

          <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
            {!isReadonly && (
              <MultimodalInput
                chatId={id}
                input={input}
                setInput={setInput}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                stop={stop}
                attachments={attachments}
                setAttachments={setAttachments}
                messages={messages}
                setMessages={setMessages}
                append={append}
              />
            )}
          </form>
        </div>
      )}

      {!isArtifactVisible && (
        <Artifact
          chatId={id}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          attachments={attachments}
          setAttachments={setAttachments}
          append={append}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          votes={votes}
          isReadonly={isReadonly}
          useResizableLayout={false}
        />
      )}
    </>
  );
}
