"use client";

import { useState } from "react";
import { useCall } from "@/contexts/CallContext";
import AgoraCall from "./AgoraCall";
import CallUI from "./CallUI";

export default function GlobalCallOverlay() {
  const { isCalling, roomName, callType, callStatus, connectedAt, activeOtherUser, endCall } = useCall();
  const [isSpeakerActive, setIsSpeakerActive] = useState(true);
  const [isHoldActive, setIsHoldActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (!isCalling || !roomName) return null;

  return (
    <>
      <CallUI 
        status={callStatus === 'connected' ? 'connected' : (callStatus === 'accepted' ? 'accepted' : (callStatus === 'ringing' ? 'ringing' : 'calling'))}
        type={callType}
        otherUser={activeOtherUser}
        connectedAt={connectedAt}
        onEnd={endCall}
        isSpeakerActive={isSpeakerActive}
        onToggleSpeaker={() => setIsSpeakerActive(!isSpeakerActive)}
        isHoldActive={isHoldActive}
        onToggleHold={() => setIsHoldActive(!isHoldActive)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
      />
      
      {/* Background Agora call logic */}
      <AgoraCall 
        roomName={roomName}
        callType={callType}
        isSpeakerActive={isSpeakerActive}
        isHoldActive={isHoldActive}
        isMuted={isMuted}
      />
    </>
  );
}
