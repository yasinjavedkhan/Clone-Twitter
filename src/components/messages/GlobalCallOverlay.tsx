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
  const [isVideoOff, setIsVideoOff] = useState(false);

  if (!isCalling || !roomName) return null;

  // Map internal CallContext status ('calling' | 'ringing' | 'connected' | 'ended') 
  // to CallUI status ('calling' | 'ringing' | 'connected' | 'ended' | 'incoming')
  const getUIStatus = () => {
      if (callStatus === 'connected') return 'connected';
      if (callStatus === 'ringing') return 'ringing';
      if (callStatus === 'calling') return 'calling';
      if (callStatus === 'ended') return 'ended';
      return 'calling';
  };

  return (
    <>
      <CallUI 
        status={getUIStatus()}
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
        isVideoOff={isVideoOff}
        onToggleCamera={() => setIsVideoOff(!isVideoOff)}
      />
      
      {/* Background Agora call logic */}
      <AgoraCall 
        roomName={roomName}
        callType={callType}
        isSpeakerActive={isSpeakerActive}
        isHoldActive={isHoldActive}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
      />
    </>
  );
}
