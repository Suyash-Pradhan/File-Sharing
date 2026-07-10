import { useEffect, useRef } from "react";
import { Input } from "./ui/input.tsx";
import { Button } from "./ui/button.tsx";
import { MessageSquare, Send } from "lucide-react";

export default function MessagePanel({
  receivedMessages,
  text,
  setText,
  sendMessage,
  peerConnectionState
}) {
  const chatContainerRef = useRef(null);
  
  const textMessages = receivedMessages.filter(msg => msg.type === "text");

  // Auto-scroll chat container to bottom without scrolling window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [textMessages]);

  return (
    <section className="flex flex-col rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-4 shadow-sm h-[480px]">
      <div className="flex items-center justify-between border-b pb-3 mb-3 border-neutral-100 dark:border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold">Secure Messaging</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Direct encrypted chat feed</p>
        </div>
      </div>
      
      {/* Messages scroll feed */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-1 py-2 flex flex-col">
        {textMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-400 dark:text-neutral-500 p-4">
            <MessageSquare className="h-8 w-8 stroke-[1.25] mb-2 opacity-50" />
            <p className="text-sm font-medium">No messages yet</p>
          </div>
        ) : (
          textMessages.map((msg, index) => {
            const isMe = msg.sender === "me";
            return (
              <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  isMe 
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-tr-none shadow-sm font-medium' 
                    : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 rounded-tl-none border border-neutral-200/50 dark:border-neutral-700/50'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.data}</p>
                </div>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">{msg.timestamp || 'Just now'}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Input message strip */}
      <div className="flex gap-2 items-center border-t pt-3 border-neutral-100 dark:border-neutral-800">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={peerConnectionState === "connected" ? "Type a message..." : "Connect to a peer to chat"}
          disabled={peerConnectionState !== "connected"}
          className="bg-transparent"
        />
        <Button 
          onClick={sendMessage}
          disabled={!text.trim() || peerConnectionState !== "connected"}
          className="shrink-0 font-medium hover:cursor-pointer"
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
