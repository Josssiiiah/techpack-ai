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
import { FieldFiller } from "./field-filler";

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

              <div className="flex-1 overflow-y-auto">
                <div className="pb-[200px] pt-4 md:pt-10">
                  <div className="relative mx-auto max-w-2xl px-4">
                    <Messages
                      chatId={id}
                      messages={messages}
                      isLoading={isLoading}
                      votes={votes}
                      reload={reload}
                      setMessages={setMessages}
                      isReadonly={isReadonly}
                      isArtifactVisible={isArtifactVisible}
                    />

                    {!isReadonly && <FieldFiller chatId={id} append={append} />}
                  </div>
                </div>
              </div>

              <div className="fixed inset-x-0 bottom-0 w-full bg-gradient-to-b from-muted/30 from-0% to-muted/30 to-50% duration-300 ease-in-out animate-in dark:from-background/10 dark:from-10% dark:to-background/80 peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]">
                <div className="mx-auto sm:max-w-2xl sm:px-4">
                  <div className="px-4 py-2 space-y-4 border-t shadow-lg bg-background sm:rounded-t-xl sm:border md:py-4">
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
                      append={append}
                      setMessages={setMessages}
                    />
                  </div>
                </div>
              </div>
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

          <div className="flex-1 overflow-y-auto">
            <div className="pb-[200px] pt-4 md:pt-10">
              <div className="relative mx-auto max-w-2xl px-4">
                <Messages
                  chatId={id}
                  messages={messages}
                  isLoading={isLoading}
                  votes={votes}
                  reload={reload}
                  setMessages={setMessages}
                  isReadonly={isReadonly}
                  isArtifactVisible={isArtifactVisible}
                />

                {!isReadonly && <FieldFiller chatId={id} append={append} />}
              </div>
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 w-full bg-gradient-to-b from-muted/30 from-0% to-muted/30 to-50% duration-300 ease-in-out animate-in dark:from-background/10 dark:from-10% dark:to-background/80 peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]">
            <div className="mx-auto sm:max-w-2xl sm:px-4">
              <div className="px-4 py-2 space-y-4 border-t shadow-lg bg-background sm:rounded-t-xl sm:border md:py-4">
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
                  append={append}
                  setMessages={setMessages}
                />
              </div>
            </div>
          </div>
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
