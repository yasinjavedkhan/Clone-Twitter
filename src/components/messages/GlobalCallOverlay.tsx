"use client";

import { useCall } from "@/contexts/CallContext";
import AgoraCall from "./AgoraCall";

export default function GlobalCallOverlay() {
  const { isCalling, roomName, callType, callStatus, activeOtherUser, endCall } = useCall();

  if (!isCalling || !roomName) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col h-screen w-screen overflow-hidden">
      <AgoraCall 
        roomName={roomName}
        callType={callType}
        callStatus={callStatus}
        otherUser={activeOtherUser}
        onEndCall={endCall}
      />
    </div>
  );
}
