const getIceServers = () => {
    const servers = [
        {
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            urls: 'stun:stun.relay.metered.ca:80'
        }
    ];

    const turnUrlString = import.meta.env.VITE_TURN_SERVER_URL;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_PASSWORD;

    if (turnUrlString && turnUsername && turnCredential) {
        // Support comma-separated URLs
        const turnUrls = turnUrlString.split(',').map(url => url.trim());
        servers.push({
            urls: turnUrls,
            username: turnUsername,
            credential: turnCredential
        });
    }

    return servers;
};

class RTCService {
    constructor() {
        this.pc = new RTCPeerConnection({
            iceServers: getIceServers()
        })
        this.dataChannel = null;
        this.onMessage = null;
        this.uplodeAbortcontroller = null;
        this.iceQueue = [];

        this.pc.onconnectionstatechange = () => {
            console.log("State:", this.pc.connectionState);

            if (this.pc.connectionState === "connected") {
                console.log("✅ Connection established");
            }
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.pc.connectionState);
            }
        };
        this.pc.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.bindDataChannelHandlers(this.dataChannel);
        };
        this.pc.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidate) {
                this.onIceCandidate(event.candidate);
            }
        };
    }

    bindDataChannelHandlers(channel) {
        let receivedBuffers = [];
        let fileMeta = null;
        let receivedSize = 0;

        channel.onmessage = (event) => {
            //  TEXT + META (JSON)
            if (typeof event.data === "string") {
                const msg = JSON.parse(event.data);
                console.log("Received message:", msg);

                if (msg.type === "text") {
                    this.onMessage?.(msg);
                    return;
                }

                if (msg.type === "file-meta") {
                    fileMeta = msg;
                    receivedSize = 0;
                    receivedBuffers = [];
                    return;
                }

                if (msg.type === "file-end") {
                    const blob = new Blob(receivedBuffers, {
                        type: fileMeta.fileType
                    });

                    const url = URL.createObjectURL(blob);

                    this.onMessage?.({
                        type: "file",
                        url,
                        name: fileMeta.name
                    });

                    receivedBuffers = [];
                    return;
                }
                if (msg.type === "file-cancelled") {
                    console.log("File transfer cancelled by sender");
                    fileMeta = null;
                    receivedSize = 0;
                    receivedBuffers = [];
                    this.onMessage?.(msg);
                    return;
                }
            }

            //  BINARY CHUNKS
            else {
                receivedBuffers.push(event.data);
                receivedSize += event.data.byteLength;

                const progress = (receivedSize / fileMeta.size) * 100;
                this.onMessage?.({
                    type: 'file-progress',
                    progress: progress.toFixed(2),
                    name: fileMeta.name
                })

            }
        };
    }
    async sendFile(file, onProgress) {
        const chunkSize = 16 * 1024;
        const maxbuffer = 64 * 1024;
        let offset = 0;
        let startTime = Date.now();
        let lastUpdateTime = Date.now();
        let lastOffset = 0;
        this.uplodeAbortcontroller = new AbortController();
        const abortController = this.uplodeAbortcontroller;

        // metadata
        this.dataChannel.send(JSON.stringify({
            type: "file-meta",
            name: file.name,
            size: file.size,
            fileType: file.type
        }));

        const reader = new FileReader();
        return new Promise((resolve, reject) => {

            if (abortController.signal.aborted) {
                reject(new Error("Upload cancelled"));
                return;
            }

            abortController.signal.addEventListener('abort', () => {
                reader.abort();
                this.dataChannel.send(JSON.stringify({ type: 'file-cancelled' }))
                reject(new Error("Upload cancelled"));
            })

            const readSlice = (o) => {
                
                if (abortController.signal.aborted) {
                    return;
                }
                const slice = file.slice(o, o + chunkSize);
                reader.readAsArrayBuffer(slice);
            };

            reader.onload = async (e) => {
                if (abortController.signal.aborted) {
                    return;
                }
                while (this.dataChannel.bufferedAmount > maxbuffer) {
                    await new Promise(r => setTimeout(r, 10));
                    if (abortController.signal.aborted) {
                        return
                    }
                }

                if (abortController.signal.aborted) {
                    return;
                }
                this.dataChannel.send(e.target.result);
                offset += e.target.result.byteLength;
                console.log(`Sent ${offset} of ${file.size} bytes`);

                const now = Date.now();
                const timeDiff = (now - lastUpdateTime) / 1000;

                if (timeDiff >= 0.5) {
                    const bytesSent = offset - lastOffset;
                    const speedBps = bytesSent / timeDiff;
                    const speedMbps = (speedBps * 8) / (1024 * 1024);

                    const remainingBytes = file.size - offset;
                    const timeRemaining = remainingBytes / speedBps;

                    lastUpdateTime = now;
                    lastOffset = offset;

                    if (onProgress) {
                        const progress = (offset / file.size) * 100;
                        const speedKBps = speedBps / 1024;
                        onProgress({
                            progress: progress.toFixed(2),
                            speedKBps: speedKBps.toFixed(2),
                            speedMbps: speedMbps.toFixed(2),
                            timeRemaining: timeRemaining.toFixed(0),
                            uploaded: offset,
                            total: file.size
                        });
                    }
                }

                if (abortController.signal.aborted) {
                    return;
                }

                if (offset < file.size) {
                    readSlice(offset);
                } else {
                    this.dataChannel.send(JSON.stringify({ type: "file-end" }));
                    console.log(" File sent");
                    this.uplodeAbortcontroller = null;
                    resolve();
                }
            }
            reader.onerror = (err) => {
                console.error("File read error:", err);
                reject(err);
            }
            reader.onabort = () => {
                reject(new Error("Upload cancelled"));
            }

            if (abortController.signal.aborted) {
                return;
            }


            readSlice(0);
        })
    }
    cancelUpload() {
        if (this.uplodeAbortcontroller) {
            this.uplodeAbortcontroller.abort();
        }
    }


    createDataChannel() {
        this.dataChannel = this.pc.createDataChannel('chat');
        this.bindDataChannelHandlers(this.dataChannel);
    }
    async createOffer() {
        this.createDataChannel();
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        return offer;
    }
    async createAnswer(offer) {
        await this.pc.setRemoteDescription(offer);
        await this.processQueuedCandidates();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        return answer;
    }
    async setRemoteAnswer(answer) {
        await this.pc.setRemoteDescription(answer);
        await this.processQueuedCandidates();
    }
    async addIceCandidate(candidate) {
        if (!candidate) return;
        if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
            try {
                await this.pc.addIceCandidate(candidate);
            } catch (e) {
                console.error("Error adding ice candidate:", e);
            }
        } else {
            this.iceQueue.push(candidate);
        }
    }
    async processQueuedCandidates() {
        while (this.iceQueue.length > 0) {
            const candidate = this.iceQueue.shift();
            try {
                await this.pc.addIceCandidate(candidate);
            } catch (e) {
                console.error("Error adding queued ice candidate:", e);
            }
        }
    }
    closeConnection() {
        if (this.dataChannel) {
            try {
                this.dataChannel.close();
            } catch (e) {
                console.error("Error closing data channel:", e);
            }
            this.dataChannel = null;
        }
        if (this.pc) {
            try {
                this.pc.close();
            } catch (e) {
                console.error("Error closing peer connection:", e);
            }
        }
        // Re-initialize PeerConnection
        this.pc = new RTCPeerConnection({
            iceServers: [{
                urls: 'stun:stun.l.google.com:19302'
            }]
        });
        this.iceQueue = [];
        this.pc.onconnectionstatechange = () => {
            console.log("State:", this.pc.connectionState);
            if (this.pc.connectionState === "connected") {
                console.log("✅ Connection established");
            }
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.pc.connectionState);
            }
        };
        this.pc.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.bindDataChannelHandlers(this.dataChannel);
        };
        this.pc.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidate) {
                this.onIceCandidate(event.candidate);
            }
        };
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange("new");
        }
    }

    send(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(message);
        }
    }

}
export default RTCService;