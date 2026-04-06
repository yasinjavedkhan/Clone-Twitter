"use client";

import { useCall } from "@/contexts/CallContext";
import AgoraCall from "./AgoraCall";
import CallUI from "./CallUI";

export default function GlobalCallOverlay() {
  const { isCalling, roomName, callType, callStatus, connectedAt, activeOtherUser, endCall } = useCall();

  if (!isCalling || !roomName) return null;

  return (
    <>
      <CallUI 
        status={callStatus === 'connected' ? 'connected' : (callStatus === 'accepted' ? 'accepted' : (callStatus === 'ringing' ? 'ringing' : 'calling'))}
        type={callType}
        otherUser={activeOtherUser}
        connectedAt={connectedAt}
        onEnd={endCall}
      />
      
      {/* Background Agora call logic */}
      <AgoraCall 
        roomName={roomName}
        callType={callType}
      />
    </>
  );
}
