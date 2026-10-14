import { useEffect, useRef, useState } from 'react';
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  User as UserIcon,
  FlipHorizontal,
  RotateCw,
  Maximize2,
  Minimize2,
  RefreshCw,
  MonitorUp,
  ArrowLeftRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    { urls: ['stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] }
  ]
};

export default function CallModal({
  callId,
  isCaller,
  callType,
  remoteUser,
  onEndCall
}: {
  callId: string;
  isCaller: boolean;
  callType: 'video' | 'audio';
  remoteUser: { uid: string; name: string; username?: string; photoURL?: string };
  onEndCall: () => void;
}) {
  const { user, userProfile } = useAuthStore();
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [callDuration, setCallDuration] = useState(0);

  // Video Orientation, Mirroring & Camera Controls (Fixes opposite/inverted/sideways video issues)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLocalMirrored, setIsLocalMirrored] = useState(true);
  const [isRemoteMirrored, setIsRemoteMirrored] = useState(false);
  const [remoteRotation, setRemoteRotation] = useState<0 | 90 | 180 | 270>(0);
  const [isObjectContain, setIsObjectContain] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSwappedView, setIsSwappedView] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEndingRef = useRef<boolean>(false);
  const callStatusRef = useRef<'connecting' | 'connected' | 'ended'>('connecting');
  callStatusRef.current = callStatus;

  // Unified single-slot call toast helper so multiple toasts never stack during calls
  const showCallToast = (msg: string, isError = false) => {
    if (isError) {
      toast.error(msg, { id: 'call-status-toast', duration: 1800 });
    } else {
      toast(msg, { id: 'call-status-toast', duration: 1400 });
    }
  };

  const endCall = async (notifyPeer = true) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    showCallToast("Call ended");
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);

    if (notifyPeer) {
      try {
        await updateDoc(doc(db, 'calls', callId), {
          status: 'ended',
          endedAt: serverTimestamp()
        });

        // If caller hangs up while still ringing/connecting, log a missed_call alert in receiver's inbox
        if (isCaller && callStatusRef.current === 'connecting' && user && remoteUser?.uid) {
          await addDoc(collection(db, 'users', remoteUser.uid, 'inbox'), {
            type: 'missed_call',
            callType,
            senderId: user.uid,
            senderName: userProfile?.name || user.displayName || 'Friend',
            senderUsername: userProfile?.username || '',
            senderPhotoURL: userProfile?.photoURL || user.photoURL || '',
            text: `Missed ${callType} call`,
            timestamp: Date.now()
          }).catch(() => {});
        }
      } catch {}
    }

    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
    }

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch {}
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
    }
    onEndCall();
  };

  // Re-bind video element streams if view is swapped
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = isSwappedView && remoteStreamRef.current
        ? remoteStreamRef.current
        : localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = isSwappedView && localStreamRef.current
        ? localStreamRef.current
        : remoteStreamRef.current;
    }
  }, [isSwappedView, callStatus]);

  useEffect(() => {
    let pc: RTCPeerConnection;
    let localStream: MediaStream;
    let unsubCall: (() => void) | null = null;
    let unsubCandidates: (() => void) | null = null;
    let hasRemoteDescription = false;
    const pendingCandidates: RTCIceCandidateInit[] = [];

    const flushCandidates = async (peerConn: RTCPeerConnection) => {
      while (pendingCandidates.length > 0) {
        const cand = pendingCandidates.shift();
        if (cand) {
          try {
            await peerConn.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn("Error adding queued candidate:", e);
          }
        }
      }
    };

    const startCall = async () => {
      try {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: callType === 'video'
              ? {
                  facingMode: 'user',
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              : false
          });
        } catch (mediaErr) {
          if (callType === 'video') {
            try {
              localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch {
              showCallToast("Camera unavailable, using voice only");
              localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              setIsVideoDisabled(true);
            }
          } else {
            throw mediaErr;
          }
        }
        localStreamRef.current = localStream;

        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = localStream;
        }

        pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            remoteStreamRef.current = event.streams[0];
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(() => {});
            }
            setCallStatus('connected');
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setCallStatus('connected');
          } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            setTimeout(() => {
              if (pc.iceConnectionState === 'failed' && !isEndingRef.current) {
                showCallToast("Connection lost", true);
                endCall(true);
              }
            }, 4000);
          }
        };

        const callDocRef = doc(db, 'calls', callId);
        const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
        const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');

        pc.onicecandidate = (event) => {
          if (event.candidate && !isEndingRef.current) {
            const candidateData = event.candidate.toJSON();
            const targetCol = isCaller ? callerCandidatesCol : receiverCandidatesCol;
            addDoc(targetCol, candidateData).catch(() => {});
          }
        };

        if (isCaller) {
          ringTimeoutRef.current = setTimeout(() => {
            if (callStatusRef.current === 'connecting' && !isEndingRef.current) {
              showCallToast("No answer");
              endCall(true);
            }
          }, 35000);

          const offerDesc = await pc.createOffer();
          await pc.setLocalDescription(offerDesc);

          await updateDoc(callDocRef, {
            offer: { type: offerDesc.type, sdp: offerDesc.sdp },
            status: 'calling'
          });

          unsubCall = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (!hasRemoteDescription && data.answer && !pc.currentRemoteDescription) {
              try {
                const answerDesc = new RTCSessionDescription(data.answer);
                await pc.setRemoteDescription(answerDesc);
                hasRemoteDescription = true;
                await flushCandidates(pc);
                setCallStatus('connected');
              } catch (err) {
                console.error("Error setting answer remote description:", err);
              }
            }

            if (data.status === 'ended' || data.status === 'declined') {
              if (!isEndingRef.current) {
                showCallToast(data.status === 'declined' ? "Call declined" : "Call ended");
                endCall(false);
              }
            }
          });

          unsubCandidates = onSnapshot(receiverCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added' && !isEndingRef.current) {
                const candidateData = change.doc.data() as RTCIceCandidateInit;
                if (hasRemoteDescription && pc.remoteDescription) {
                  pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(console.error);
                } else {
                  pendingCandidates.push(candidateData);
                }
              }
            });
          });
        } else {
          unsubCall = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (!hasRemoteDescription && data.offer && !pc.currentRemoteDescription) {
              try {
                const offerDesc = new RTCSessionDescription(data.offer);
                await pc.setRemoteDescription(offerDesc);
                hasRemoteDescription = true;
                await flushCandidates(pc);

                const answerDesc = await pc.createAnswer();
                await pc.setLocalDescription(answerDesc);

                await updateDoc(callDocRef, {
                  answer: { type: answerDesc.type, sdp: answerDesc.sdp },
                  status: 'ongoing'
                });
                setCallStatus('connected');
              } catch (err) {
                console.error("Error answering call:", err);
              }
            }

            if (data.status === 'ended') {
              if (!isEndingRef.current) {
                showCallToast("Call ended");
                endCall(false);
              }
            }
          });

          unsubCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added' && !isEndingRef.current) {
                const candidateData = change.doc.data() as RTCIceCandidateInit;
                if (hasRemoteDescription && pc.remoteDescription) {
                  pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(console.error);
                } else {
                  pendingCandidates.push(candidateData);
                }
              }
            });
          });
        }
      } catch (err: any) {
        console.error("WebRTC initialization error:", err);
        showCallToast("Call setup error: " + (err?.message || "Media access failed"), true);
        endCall();
      }
    };

    startCall();

    return () => {
      if (unsubCall) unsubCall();
      if (unsubCandidates) unsubCandidates();
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callId, isCaller, callType]);

  useEffect(() => {
    if (callStatus === 'connected') {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const toggleMuteAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  // Switch between Front ('user') and Back ('environment') camera on Mobile
  const handleSwitchCamera = async () => {
    if (callType !== 'video' || isScreenSharing) return;
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
        localStreamRef.current.addTrack(newVideoTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setFacingMode(nextFacingMode);
      setIsLocalMirrored(nextFacingMode === 'user');
      setIsVideoDisabled(false);
      showCallToast(nextFacingMode === 'user' ? 'Front Camera' : 'Rear Camera');
    } catch (err) {
      console.warn('Could not switch camera:', err);
      showCallToast('Could not switch camera on this device', true);
    }
  };

  // Toggle Screen Sharing during a Video Call
  const handleToggleScreenShare = async () => {
    if (callType !== 'video') return;
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
      setIsLocalMirrored(facingMode === 'user');
      showCallToast('Screen sharing stopped');
    } else {
      try {
        const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true
        });
        const screenTrack = displayStream.getVideoTracks()[0];
        if (!screenTrack) return;

        screenStreamRef.current = displayStream;
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }
        setIsScreenSharing(true);
        setIsLocalMirrored(false);

        screenTrack.onended = () => {
          handleToggleScreenShare();
        };
        showCallToast('Sharing your screen');
      } catch {
        // User cancelled screen picker
      }
    }
  };

  const handleRotateRemoteVideo = () => {
    setRemoteRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  };

  const formatDuration = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const mainVideoMirror = isSwappedView ? isLocalMirrored : isRemoteMirrored;
  const mainVideoRotation = isSwappedView ? 0 : remoteRotation;
  const pipVideoMirror = isSwappedView ? isRemoteMirrored : isLocalMirrored;
  const pipVideoRotation = isSwappedView ? remoteRotation : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-3 sm:p-6 text-white select-none pt-safe pb-safe">
      {/* Top Header Bar */}
      <div className="w-full flex flex-wrap justify-between items-center gap-2 z-20 max-w-4xl pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-primary/20 border border-white/20 flex-shrink-0">
            {remoteUser.photoURL ? (
              <img src={remoteUser.photoURL} alt={remoteUser.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-full h-full p-2 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-lg leading-tight">{remoteUser.name}</h3>
            <p className="text-xs text-white/70 flex items-center gap-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {callStatus === 'connected' 
                ? formatDuration(callDuration) 
                : isCaller ? 'Calling...' : 'Connecting...'}
            </p>
          </div>
        </div>

        {/* Video Orientation & Mirroring Quick Fix Bar */}
        {callType === 'video' && (
          <div className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-white/15 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setIsRemoteMirrored((prev) => !prev);
                showCallToast(!isRemoteMirrored ? 'Mirrored remote video' : 'Standard orientation');
              }}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                isRemoteMirrored
                  ? 'bg-primary text-white shadow'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
              }`}
              title="Flip / Mirror Remote Face (Fix opposite face)"
            >
              <FlipHorizontal size={15} />
              <span className="hidden sm:inline">Flip Face</span>
            </button>

            <button
              type="button"
              onClick={handleRotateRemoteVideo}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                remoteRotation !== 0
                  ? 'bg-primary text-white shadow'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
              }`}
              title="Rotate Remote Video 90° (Fix sideways orientation)"
            >
              <RotateCw size={15} />
              <span className="hidden sm:inline">{remoteRotation ? `${remoteRotation}°` : 'Rotate'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsObjectContain((prev) => !prev)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                isObjectContain
                  ? 'bg-primary text-white shadow'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
              }`}
              title={isObjectContain ? "Fill Screen" : "Fit Full Uncropped Video"}
            >
              {isObjectContain ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              <span className="hidden sm:inline">{isObjectContain ? 'Fill' : 'Fit'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Center Video / Avatar Area */}
      <div className="relative w-full max-w-4xl flex-1 my-3 flex items-center justify-center rounded-3xl overflow-hidden bg-surface/40 border border-white/10 shadow-2xl">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          style={{
            transform: `${mainVideoMirror ? 'scaleX(-1)' : 'scaleX(1)'} rotate(${mainVideoRotation}deg)`
          }}
          className={
            callType === 'video' && callStatus === 'connected'
              ? `w-full h-full transition-transform duration-200 ${isObjectContain ? 'object-contain bg-black' : 'object-cover'}`
              : 'absolute w-px h-px opacity-0 pointer-events-none'
          }
        />

        {(callType === 'audio' || callStatus !== 'connected') && (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-8 z-10">
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-primary/50 overflow-hidden shadow-2xl bg-surface flex items-center justify-center">
                {remoteUser.photoURL ? (
                  <img src={remoteUser.photoURL} alt={remoteUser.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-bold text-primary">
                    {(remoteUser.name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {callStatus === 'connecting' && (
                <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-30 pointer-events-none"></div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{remoteUser.name}</h2>
              <p className="text-sm text-text-secondary mt-1">
                {callStatus === 'connected' ? 'HD Voice Call Connected' : isCaller ? 'Ringing...' : 'Connecting...'}
              </p>
            </div>
          </div>
        )}

        {/* Local Picture-in-Picture Video */}
        {callType === 'video' && (
          <div 
            onClick={() => setIsSwappedView((prev) => !prev)}
            title="Tap to swap main & self video"
            className="absolute bottom-4 right-4 sm:top-4 sm:bottom-auto sm:right-4 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-white/30 hover:border-primary shadow-2xl bg-black/85 z-20 cursor-pointer group transition-all"
          >
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{
                transform: `${pipVideoMirror ? 'scaleX(-1)' : 'scaleX(1)'} rotate(${pipVideoRotation}deg)`
              }}
              className={`w-full h-full object-cover transition-transform duration-200 ${isVideoDisabled ? 'hidden' : 'block'}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-white/60 p-2 text-center bg-surface/90">
                <VideoOff size={24} className="mb-1 text-white/40" />
                <span>Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] text-white/80">
              <span>{isSwappedView ? remoteUser.name.split(' ')[0] : 'You'}</span>
              <ArrowLeftRight size={10} className="opacity-70 group-hover:opacity-100" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Buttons */}
      <div className="w-full max-w-lg flex items-center justify-center gap-3 sm:gap-4 py-3 px-4 sm:px-6 bg-surface/85 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-2xl z-20 mb-1">
        <button
          type="button"
          onClick={toggleMuteAudio}
          className={`p-3.5 sm:p-4 rounded-full transition-all active:scale-95 shadow-md ${
            isAudioMuted 
              ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {callType === 'video' && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3.5 sm:p-4 rounded-full transition-all active:scale-95 shadow-md ${
              isVideoDisabled 
                ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isVideoDisabled ? "Turn on Camera" : "Turn off Camera"}
          >
            {isVideoDisabled ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}

        {callType === 'video' && !isVideoDisabled && (
          <button
            type="button"
            onClick={handleSwitchCamera}
            className="p-3.5 sm:p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-md"
            title="Switch Front / Back Camera"
          >
            <RefreshCw size={20} />
          </button>
        )}

        {callType === 'video' && !isVideoDisabled && (
          <button
            type="button"
            onClick={() => setIsLocalMirrored((prev) => !prev)}
            className={`p-3.5 sm:p-4 rounded-full transition-all active:scale-95 shadow-md ${
              !isLocalMirrored
                ? 'bg-primary/30 text-primary border border-primary/50'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Toggle Self-Preview Mirroring"
          >
            <FlipHorizontal size={20} />
          </button>
        )}

        {callType === 'video' && typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices || {}) && (
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`hidden sm:flex p-3.5 sm:p-4 rounded-full transition-all active:scale-95 shadow-md ${
              isScreenSharing
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            <MonitorUp size={20} />
          </button>
        )}

        <button
          type="button"
          onClick={() => endCall(true)}
          className="p-3.5 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-xl active:scale-95 hover:scale-105"
          title="End Call"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}
