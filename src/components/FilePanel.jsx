import { useState, useRef } from "react";
import { Button } from "./ui/button.tsx";
import { Progress } from "./ui/progress.tsx";
import { UploadCloud, FileText, Download } from "lucide-react";

export default function FilePanel({
  receivedMessages,
  peerConnectionState,
  isUploading,
  uploadStats,
  recivedProgress,
  handleSendFile,
  handleCancelUpload
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileMessages = receivedMessages.filter(msg => msg.type === "file");

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section className="flex flex-col rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-4 shadow-sm h-[480px]">
      <div className="flex items-center justify-between border-b pb-3 mb-3 border-neutral-100 dark:border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold">File Transfer</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-4 overflow-y-auto pr-1">

        {/* Drag and Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (peerConnectionState === "connected") setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && peerConnectionState === "connected") handleSendFile(file);
          }}
          onClick={() => {
            if (peerConnectionState === "connected" && !isUploading) {
              fileInputRef.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-3 group relative min-h-[140px] shrink-0 ${isDragging
            ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800/50'
            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50'
            } ${peerConnectionState !== "connected" ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={peerConnectionState !== "connected" || isUploading}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) handleSendFile(file);
            }}
          />

          <div className="rounded-full bg-white dark:bg-neutral-800 p-2.5 shadow-sm border border-neutral-100 dark:border-neutral-700/50 transition-colors group-hover:bg-neutral-100 dark:group-hover:bg-neutral-750">
            <UploadCloud className="h-6 w-6 stroke-[1.25] text-neutral-500 dark:text-neutral-400 group-hover:scale-105 transition-transform" />
          </div>

          <div>
            <p className="text-xs font-semibold">
              {peerConnectionState !== "connected"
                ? "Direct connection required to send files"
                : "Drag & drop file or click to browse"}
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
              Send photos, documents, and videos directly to peer
            </p>
          </div>
        </div>

        {/* Active Transfer State */}
        {(isUploading || recivedProgress.progress > 0) && (
          <div className="space-y-3 shrink-0">
            {/* Upload Info */}
            {isUploading && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Uploading file
                  </span>
                  <button
                    onClick={handleCancelUpload}
                    className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 uppercase tracking-wide hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1">
                  <Progress value={uploadStats.progress} className="h-1.5" />
                  <div className="flex justify-between text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>{Math.round(uploadStats.progress)}%</span>
                    <span>{formatSize(uploadStats.uploaded)} / {formatSize(uploadStats.total)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-neutral-100 dark:border-neutral-800 pt-2 font-mono text-neutral-500 dark:text-neutral-400">
                  <div>Speed: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{uploadStats.speedMbps || 0} Mbps</span></div>
                  <div>ETA: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{uploadStats.timeRemaining > 0 ? formatTime(uploadStats.timeRemaining) : "Calculating..."}</span></div>
                </div>

                <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-2 border border-amber-200/50 dark:border-amber-800/20 text-center font-medium">
                  ⚠️ Keep this tab active or file sending will pause
                </div>
              </div>
            )}

            {/* Download Info */}
            {recivedProgress.progress > 0 && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Receiving file
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 max-w-[120px] truncate">{recivedProgress.name}</span>
                </div>

                <div className="space-y-1">
                  <Progress value={Number(recivedProgress.progress)} className="h-1.5" />
                  <div className="flex justify-between text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>{Math.round(Number(recivedProgress.progress))}%</span>
                    <span>Incoming Data</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transferred Files History */}
        <div className="flex-1 flex flex-col min-h-[140px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">Transferred Files Log</p>
          {fileMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-xl bg-neutral-50/30 border-neutral-200 dark:border-neutral-800/80 dark:bg-neutral-900/30 text-neutral-400 dark:text-neutral-500">
              <FileText className="h-6 w-6 stroke-[1.25] mb-1.5 opacity-40" />
              <p className="text-xs font-medium">Log empty</p>
              <p className="text-[10px] max-w-[200px] mt-0.5">Files exchanged in this session will be listed here.</p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 max-h-[180px]">
              {fileMessages.map((msg, index) => {
                const isMe = msg.sender === "me";
                return (
                  <div key={index} className="flex items-center justify-between rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-xs transition-shadow hover:shadow-sm">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800 p-2 text-neutral-600 dark:text-neutral-300 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-xs font-medium truncate pr-2 text-neutral-850 dark:text-neutral-100">{msg.name}</p>
                        <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
                          {isMe ? "Sent File" : "Received File"} {msg.size ? `• ${formatSize(msg.size)}` : ""}
                        </p>
                      </div>
                    </div>
                    {!isMe && msg.url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 hover:cursor-pointer rounded-lg"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = msg.url;
                          a.download = msg.name;
                          a.click();
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
