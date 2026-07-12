import { useState, useEffect, useRef } from "react";
import { 
  Copy, 
  Check, 
  LogOut, 
  Sun, 
  Moon 
} from "lucide-react";

export default function Header({
  socketConnected,
  peerConnectionState,
  myId,
  roomId,
  setRoomId,
  joinedRoom,
  joinRoom,
  leaveRoom,
  copiedRoom,
  copyRoomLink
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme;
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const copyNodeId = () => {
    if (!myId) return;
    navigator.clipboard.writeText(myId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const [visible, setVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      const isMobile = window.innerWidth < 768; // 768px corresponds to Tailwind md breakpoint

      if (!isMobile) {
        setVisible(true);
        return;
      }

      // Collapse only when scrolling down past 50px
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`sticky top-4 z-50 flex items-center justify-between w-full h-12 rounded-full border border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/85 backdrop-blur-md px-4 shadow-sm transition-all duration-500 ${
      visible ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"
    }`}>
      {/* Left Section: User ID */}
      <div className="flex items-center gap-1.5">
        <span className="hidden sm:inline font-bold tracking-wider text-[10px] uppercase text-neutral-450 dark:text-neutral-500">ID</span>
        {myId ? (
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/50 dark:border-neutral-700/50 px-2 py-0.5 rounded-full text-xs text-neutral-600 dark:text-neutral-300 font-mono shadow-xs">
            <span>{myId.substring(0, 6)}</span>
            <button 
              type="button"
              onClick={copyNodeId}
              className="p-0.5 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Copy User ID"
            >
              {copiedId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">Connecting...</span>
        )}
      </div>

      {/* Right Section: Room controls, subtle connection indicator, theme toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {joinedRoom ? (
          <div className="flex items-center gap-2 bg-neutral-100/50 dark:bg-neutral-950/50 border border-neutral-200/40 dark:border-neutral-800/40 rounded-full pl-2.5 pr-1 py-0.5 text-[11px] font-medium shadow-xs">
            <span className="text-neutral-500 dark:text-neutral-450 font-semibold">{joinedRoom}</span>
            
            <button 
              type="button"
              onClick={copyRoomLink}
              className="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-850 rounded-full transition-colors cursor-pointer"
              title="Copy share link"
            >
              {copiedRoom ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-neutral-400" />}
            </button>

            {/* Subtle Connection status indicator */}
            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase transition-all ${
              peerConnectionState === "connected" 
                ? 'text-emerald-500 bg-emerald-500/10' 
                : peerConnectionState === "connecting"
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-neutral-400 bg-neutral-400/10 dark:text-neutral-500'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                peerConnectionState === "connected" 
                  ? 'bg-emerald-500 animate-pulse' 
                  : peerConnectionState === "connecting"
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-neutral-400 dark:bg-neutral-500'
              }`} />
              <span className="hidden sm:inline">
                {peerConnectionState === "connected" ? "Connected" : peerConnectionState === "connecting" ? "Connecting" : "Waiting"}
              </span>
            </div>

            <button
              type="button"
              onClick={leaveRoom}
              className="bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 active:scale-[0.96] rounded-full p-1 transition-all cursor-pointer"
              title="Leave Room"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800/50 rounded-full pl-2.5 pr-1 py-0.5">
            <input
              type="text"
              className="h-5 w-16 sm:w-24 text-xs bg-transparent border-0 outline-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-semibold"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  joinRoom();
                }
              }}
            />
            <button 
              type="button"
              onClick={joinRoom}
              className="bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-200 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
            >
              Join
            </button>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-850 rounded-full text-neutral-500 dark:text-neutral-400 transition-colors cursor-pointer"
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </header>
  );
}
