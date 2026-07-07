import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import RTCService from "./service/rtcService.js";
import { Field, FieldLabel } from "./components/ui/field.tsx";
import { Input } from "./components/ui/input.tsx";
import { Button } from "./components/ui/button.tsx";
// import { Menubar } from "./components/ui/menubar.tsx";
import { Progress } from "@/components/ui/progress";

const socket = io(import.meta.env.VITE_SIGNALING_SERVER_URL || "http://localhost:5000");
console.log("Backend URL:", import.meta.env.VITE_SIGNALING_SERVER_URL);
console.log("Socket connected:", socket.connected);

socket.on("connect", () => {
  console.log("Connected to:", socket.io.uri);
});

export default function Chat() {
  const rtcRef = useRef(null);
  const targetRef = useRef("");
  const [recivedProgress, setRecivedProgress] = useState({
    progress: 0,
    name: ""
  });

  const [myId, setMyId] = useState("");
  const [uploadStats, setUploadStats] = useState({
    progress: 0,
    speedMbps: 0,
    timeRemaining: 0
  });
  const [isUploading, setIsUploading] = useState(false);
  const [roomId, setRoomId] = useState("room1");
  const [text, setText] = useState("");
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [progress, setProgress] = useState(0);

  if (!rtcRef.current) {
    rtcRef.current = new RTCService();
  }

  const rtc = rtcRef.current;

  useEffect(() => {
    const handleMe = (id) => {
      setMyId(id);
    };

    // 🔥 when someone joins → create offer
    const handleUserJoined = async (userId) => {
      console.log("User joined:", userId);

      targetRef.current = userId;

      const offer = await rtc.createOffer();

      socket.emit("offer", {
        offer,
        to: userId,
      });
    };

    // 🔥 receive offer → send answer
    const handleOffer = async ({ offer, from }) => {
      console.log("Received offer from:", from);

      targetRef.current = from;

      const answer = await rtc.createAnswer(offer);

      socket.emit("answer", {
        answer,
        to: from,
      });
    };

    // 🔥 receive answer
    const handleAnswer = async ({ answer }) => {
      console.log("Received answer");
      await rtc.setRemoteAnswer(answer);
    };

    // 🔥 receive ICE
    const handleIceCandidate = ({ candidate, from }) => {
      targetRef.current = from;
      rtc.addIceCandidate(candidate);
    };

    // 🔥 send ICE
    rtc.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: targetRef.current,
        });
      }
    };

    rtc.onMessage = (message) => {
      if (message.type === "text") {
        setReceivedMessages((prev) => [...prev, {
          type: "text",
          data: message.data
        }]);
      }

      if (message.type === "file") {
        setReceivedMessages((prev) => [...prev, {
          type: "file",
          name: message.name,
          url: message.url
        }]);

        // const a = document.createElement("a");
        // a.href = message.url;
        // a.download = message.name;
        // a.click();
      }

      if (message.type === "file-progress") {
        setRecivedProgress({
          progress: message.progress,
          name: message.name
        });
      }
      if (message.type === 'file-cancelled') {
        console.log("File transfer cancelled by sender");
        setRecivedProgress({
          progress: 0,
          name: ""
        })
      };
    };

    const handleUserLeft = (userId) => {
      console.log("User left:", userId);
      if (targetRef.current === userId) {
        targetRef.current = "";
        rtc.closeConnection();
        // Reset states
        setProgress(0);
        setIsUploading(false);
        setUploadStats({
          progress: 0,
          speedMbps: 0,
          timeRemaining: 0
        });
        setRecivedProgress({
          progress: 0,
          name: ""
        });
      }
    };

    socket.on("me", handleMe);
    socket.on("user:joinedRoom", handleUserJoined);
    socket.on("user:leftRoom", handleUserLeft);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("me", handleMe);
      socket.off("user:joinedRoom", handleUserJoined);
      socket.off("user:leftRoom", handleUserLeft);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      rtc.onMessage = null;
    };
  }, []);

  // ✅ JOIN ROOM
  const joinRoom = () => {
    socket.emit("user:joinRoom", roomId);
  };

  // ✅ SEND MESSAGE
  const sendMessage = () => {
    rtc.send(JSON.stringify({
      type: "text",
      data: text
    }));
  };

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

    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-3 rounded-md border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">My ID</p>
            <p className="text-sm font-medium">{myId || "Not connected"}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              className="sm:w-48"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID"
            />
            <Button className="hover:cursor-pointer" onClick={joinRoom}>Join room</Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <h1>debug</h1>
          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Text</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
              <Button className="hover:cursor-pointer" onClick={sendMessage}>Send</Button>
            </div>
            <div className="space-y-4 p-4">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a message"
              />
              <Field>
                <FieldLabel htmlFor="textarea-disabled">Inbox</FieldLabel>
                <div className="mt-3 space-y-2">
                  {receivedMessages.map((msg, index) => (
                    console.log("Received file message:", msg.type),
                    <div key={index} className="rounded-md border bg-background/70 p-2">
                      {msg.type === "text" && (
                        <p className="text-sm whitespace-pre-wrap">{msg.data}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Files</p>
                <p className="text-xs text-muted-foreground">Transfer</p>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <Progress value={progress} className="w-full" />
              <div className="text-xs text-muted-foreground">
                Sending: {Math.round(progress)}%
              </div>
              <div className="rounded-md border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                Receiving: {recivedProgress.name || "-"} {recivedProgress.progress ? `(${recivedProgress.progress}%)` : ""}
              </div>
              <Input
                type="file"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) rtc.sendFile(file, (p) => {
                    setProgress(Number(p.progress) || 0);
                    setUploadStats(p);
                    setIsUploading(true);
                  }).then(() => {
                    console.log("File sent successfully");
                    setUploadStats({ progress: 0, speedMbps: 0, timeRemaining: 0 });
                    setIsUploading(false);

                  }).catch((err) => {
                    console.error("File send error:", err);
                    setUploadStats({ progress: 0, speedMbps: 0, timeRemaining: 0 });
                    setIsUploading(false);

                  });
                }}
              />
              <Progress value={uploadStats.progress} className="w-full" />

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Progress: {Math.round(uploadStats.progress)}%</div>
                <div>Speed: {uploadStats.speedKBps || 0} KB/s</div>
                <div>Network: {uploadStats.speedMbps || 0} Mbps</div>
                <div>
                  {uploadStats.timeRemaining > 0 &&
                    `Time left: ${formatTime(uploadStats.timeRemaining)}`
                  }
                </div>
              </div>

              {
                isUploading && (

                  <Button
                    onClick={() => {

                      rtc.cancelUpload();
                      setIsUploading(false)
                      setProgress(0);

                    }
                    }
                  >Cancel</Button>
                )
              }
              <div className="space-y-2">
                {receivedMessages.map((msg, index) => (
                  msg.type === "file" && (
                    <div key={index} className="rounded-md border bg-background/70 p-2">
                      <p className="text-sm font-medium">📁 {msg.name}</p>
                      <button
                        className="mt-2 rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = msg.url;
                          a.download = msg.name;
                          a.click();
                        }}
                      >
                        Download
                      </button>
                    </div>
                  )
                ))}
              </div>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}