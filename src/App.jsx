import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import RTCService from "./service/rtcService.js";
import Header from "./components/Header.jsx";
import MessagePanel from "./components/MessagePanel.jsx";
import FilePanel from "./components/FilePanel.jsx";

const socket = io(import.meta.env.VITE_SIGNALING_SERVER_URL || "http://localhost:5000");

export default function Chat() {
  const rtcRef = useRef(null);
  const targetRef = useRef("");

  // Connection states
  const [socketConnected, setSocketConnected] = useState(false);
  const [peerConnectionState, setPeerConnectionState] = useState("new");
  const [myId, setMyId] = useState("");
  const [roomId, setRoomId] = useState("room1");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [copiedRoom, setCopiedRoom] = useState(false);

  // File Transfer states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    progress: 0,
    speedKBps: 0,
    speedMbps: 0,
    timeRemaining: 0,
    uploaded: 0,
    total: 0
  });
  const [recivedProgress, setRecivedProgress] = useState({
    progress: 0,
    name: ""
  });
  const [progress, setProgress] = useState(0);

  // Chat states
  const [text, setText] = useState("");
  const [receivedMessages, setReceivedMessages] = useState([]);

  if (!rtcRef.current) {
    rtcRef.current = new RTCService();
  }

  const rtc = rtcRef.current;

  useEffect(() => {
    const handleMe = (id) => {
      setMyId(id);
    };

    const handleConnect = () => {
      setSocketConnected(true);
      setMyId(socket.id);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setMyId("");
      setJoinedRoom("");
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

    // Bind RTC Service callbacks
    rtc.onIceCandidate = (candidate) => {
      if (candidate) {
        socket.emit("ice-candidate", {
          candidate,
          to: targetRef.current,
        });
      }
    };

    rtc.onConnectionStateChange = (state) => {
      setPeerConnectionState(state);
      if (state === "disconnected" || state === "failed" || state === "closed") {
        setIsUploading(false);
        setUploadStats({
          progress: 0,
          speedKBps: 0,
          speedMbps: 0,
          timeRemaining: 0,
          uploaded: 0,
          total: 0
        });
        setRecivedProgress({
          progress: 0,
          name: ""
        });
      }
    };

    rtc.onMessage = (message) => {
      if (message.type === "text") {
        setReceivedMessages((prev) => [...prev, {
          sender: "peer",
          type: "text",
          data: message.data,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }

      if (message.type === "file") {
        setReceivedMessages((prev) => [...prev, {
          sender: "peer",
          type: "file",
          name: message.name,
          url: message.url
        }]);
        setRecivedProgress({
          progress: 0,
          name: ""
        });
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
        });
      }
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
          speedKBps: 0,
          speedMbps: 0,
          timeRemaining: 0,
          uploaded: 0,
          total: 0
        });
        setRecivedProgress({
          progress: 0,
          name: ""
        });
      }
    };

    // Socket.io event registrations
    socket.on("me", handleMe);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("user:joinedRoom", handleUserJoined);
    socket.on("user:leftRoom", handleUserLeft);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    // Initial state setup
    setSocketConnected(socket.connected);
    if (socket.connected) {
      setMyId(socket.id);
    }
    setPeerConnectionState(rtc.pc.connectionState);

    // Query parameter room joining
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setRoomId(roomParam);
      const checkAndJoin = () => {
        if (socket.connected) {
          socket.emit("user:joinRoom", roomParam);
          setJoinedRoom(roomParam);
        } else {
          setTimeout(checkAndJoin, 150);
        }
      };
      checkAndJoin();
    }

    return () => {
      socket.off("me", handleMe);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("user:joinedRoom", handleUserJoined);
      socket.off("user:leftRoom", handleUserLeft);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      rtc.onMessage = null;
      rtc.onConnectionStateChange = null;
      rtc.onIceCandidate = null;
    };
  }, []);

  // ✅ JOIN ROOM
  const joinRoom = () => {
    if (roomId.trim()) {
      socket.emit("user:joinRoom", roomId);
      setJoinedRoom(roomId);
    }
  };

  // ✅ LEAVE ROOM
  const leaveRoom = () => {
    rtc.closeConnection();
    socket.disconnect();
    socket.connect();
    setJoinedRoom("");
    setReceivedMessages([]);
    setProgress(0);
    setIsUploading(false);
    setUploadStats({
      progress: 0,
      speedKBps: 0,
      speedMbps: 0,
      timeRemaining: 0,
      uploaded: 0,
      total: 0
    });
    setRecivedProgress({
      progress: 0,
      name: ""
    });
  };

  // ✅ SEND MESSAGE
  const sendMessage = () => {
    if (!text.trim()) return;
    rtc.send(JSON.stringify({
      type: "text",
      data: text
    }));
    setReceivedMessages((prev) => [...prev, {
      sender: "me",
      type: "text",
      data: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setText("");
  };

  // ✅ SEND FILE
  const handleSendFile = (file) => {
    if (!file || isUploading) return;
    setIsUploading(true);
    setProgress(0);
    setUploadStats({
      progress: 0,
      speedKBps: 0,
      speedMbps: 0,
      timeRemaining: 0,
      uploaded: 0,
      total: file.size
    });
    rtc.sendFile(file, (p) => {
      setProgress(Number(p.progress) || 0);
      setUploadStats({
        progress: Number(p.progress) || 0,
        speedKBps: Number(p.speedKBps) || 0,
        speedMbps: Number(p.speedMbps) || 0,
        timeRemaining: Number(p.timeRemaining) || 0,
        uploaded: Number(p.uploaded) || 0,
        total: Number(p.total) || file.size
      });
    }).then(() => {
      console.log("File sent successfully");
      setReceivedMessages((prev) => [...prev, {
        sender: "me",
        type: "file",
        name: file.name,
        size: file.size
      }]);
      setUploadStats({ progress: 0, speedKBps: 0, speedMbps: 0, timeRemaining: 0, uploaded: 0, total: 0 });
      setIsUploading(false);
      setProgress(0);
    }).catch((err) => {
      console.error("File send error:", err);
      setUploadStats({ progress: 0, speedKBps: 0, speedMbps: 0, timeRemaining: 0, uploaded: 0, total: 0 });
      setIsUploading(false);
      setProgress(0);
    });
  };

  // ✅ CANCEL UPLOAD
  const handleCancelUpload = () => {
    rtc.cancelUpload();
    setIsUploading(false);
    setProgress(0);
    setUploadStats({ progress: 0, speedKBps: 0, speedMbps: 0, timeRemaining: 0, uploaded: 0, total: 0 });
  };

  // ✅ COPY ROOM SHARE LINK
  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${joinedRoom}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 font-sans text-neutral-900 dark:text-neutral-50 antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">

        {/* Header component */}
        <Header
          socketConnected={socketConnected}
          peerConnectionState={peerConnectionState}
          myId={myId}
          roomId={roomId}
          setRoomId={setRoomId}
          joinedRoom={joinedRoom}
          joinRoom={joinRoom}
          leaveRoom={leaveRoom}
          copiedRoom={copiedRoom}
          copyRoomLink={copyRoomLink}
        />



        {/* Main Content Area */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Message Panel Component */}
          <MessagePanel
            receivedMessages={receivedMessages}
            text={text}
            setText={setText}
            sendMessage={sendMessage}
            peerConnectionState={peerConnectionState}
          />

          {/* File Panel Component */}
          <FilePanel
            receivedMessages={receivedMessages}
            peerConnectionState={peerConnectionState}
            isUploading={isUploading}
            uploadStats={uploadStats}
            recivedProgress={recivedProgress}
            handleSendFile={handleSendFile}
            handleCancelUpload={handleCancelUpload}
          />

        </div>

      </div>
    </div>
  );
}