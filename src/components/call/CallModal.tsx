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
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  User as UserIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
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
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const isEndingRef = useRef<boolean>(false);

  const endCall = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    toast("Call ended", { id: 'call-status-toast' });
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'ended',
        endedAt: serverTimestamp()
      });
    } catch {}

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    onEndCall();
  };

  useEffect(() => {
    let pc: RTCPeerConnection;
    let localStream: MediaStream;

    const startCall = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
        });
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
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setCallStatus('connected');
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected') {
            setCallStatus('connected');
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
          const offerDesc = await pc.createOffer();
          await pc.setLocalDescription(offerDesc);

          await updateDoc(callDocRef, {
            offer: { type: offerDesc.type, sdp: offerDesc.sdp },
            status: 'calling'
          });

          const unsubCall = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.answer) {
              const answerDesc = new RTCSessionDescription(data.answer);
              pc.setRemoteDescription(answerDesc).catch(console.error);
              setCallStatus('connected');
            }
            if (data?.status === 'ended' || data?.status === 'declined') {
              if (!isEndingRef.current) {
                isEndingRef.current = true;
                toast(data.status === 'declined' ? "Call declined" : "Call ended", { id: 'call-status-toast' });
                endCall();
              }
            }
          });

          const unsubCandidates = onSnapshot(receiverCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added' && !isEndingRef.current) {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate).catch(console.error);
              }
            });
          });

          return () => {
            unsubCall();
            unsubCandidates();
          };
        } else {
          const unsubCall = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.offer) {
              const offerDesc = new RTCSessionDescription(data.offer);
              await pc.setRemoteDescription(offerDesc);

              const answerDesc = await pc.createAnswer();
              await pc.setLocalDescription(answerDesc);

              await updateDoc(callDocRef, {
                answer: { type: answerDesc.type, sdp: answerDesc.sdp },
                status: 'ongoing'
              });
              setCallStatus('connected');
            }
            if (data?.status === 'ended') {
              if (!isEndingRef.current) {
                isEndingRef.current = true;
                toast("Call ended", { id: 'call-status-toast' });
                endCall();
              }
            }
          });

          const unsubCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added' && !isEndingRef.current) {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate).catch(console.error);
              }
            });
          });

          return () => {
            unsubCall();
            unsubCandidates();
          };
        }
      } catch (err: any) {
        console.error("WebRTC initialization error:", err);
        toast.error("Call setup error: " + (err?.message || "Media access failed"), { id: 'call-status-toast' });
        endCall();
      }
    };

    startCall();

    return () => {
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

  const formatDuration = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 sm:p-6 text-white select-none">
      {/* Top Header Bar */}
      <div className="w-full flex justify-between items-center z-20 max-w-2xl pt-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/20 border border-white/20">
            {remoteUser.photoURL ? (
              <img src={remoteUser.photoURL} alt={remoteUser.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-full h-full p-2 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg">{remoteUser.name}</h3>
            <p className="text-xs text-white/70 flex items-center gap-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {callStatus === 'connected' 
                ? formatDuration(callDuration) 
                : isCaller ? 'Calling...' : 'Connecting...'}
            </p>
          </div>
        </div>

        <div className="text-xs bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 uppercase tracking-wider font-semibold">
          {callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
        </div>
      </div>

      {/* Main Center Video / Avatar Area */}
      <div className="relative w-full max-w-3xl flex-1 my-4 flex items-center justify-center rounded-3xl overflow-hidden bg-surface/50 border border-white/10 shadow-2xl">
        {/* Remote Video Element */}
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${callType === 'audio' || callStatus !== 'connected' ? 'hidden' : 'block'}`}
        />

        {/* Remote Audio Fallback Avatar */}
        {(callType === 'audio' || callStatus !== 'connected') && (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
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
                {callStatus === 'connected' ? 'Voice Call Connected' : isCaller ? 'Ringing...' : 'Connecting...'}
              </p>
            </div>
          </div>
        )}

        {/* Local Picture-in-Picture Video (Self Preview) */}
        {callType === 'video' && (
          <div className="absolute top-4 right-4 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black/80 z-20">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-white/60 p-2 text-center bg-surface/90">
                <VideoOff size={24} className="mb-1 text-white/40" />
                <span>Camera Off</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Buttons */}
      <div className="w-full max-w-md flex items-center justify-center gap-4 sm:gap-6 py-3 px-6 bg-surface/80 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-2xl z-20 mb-2">
        <button
          type="button"
          onClick={toggleMuteAudio}
          className={`p-4 rounded-full transition-all active:scale-95 shadow-md ${
            isAudioMuted 
              ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isAudioMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {callType === 'video' && (
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all active:scale-95 shadow-md ${
              isVideoDisabled 
                ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isVideoDisabled ? "Turn on Camera" : "Turn off Camera"}
          >
            {isVideoDisabled ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        <button
          type="button"
          onClick={endCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-xl active:scale-95 hover:scale-105"
          title="End Call"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
