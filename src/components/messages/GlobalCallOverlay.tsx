"use client";

import { useCall } from "@/contexts/CallContext";
import AgoraCall from "./AgoraCall";

export default function GlobalCallOverlay() {
  const { isCalling, roomName, callType, activeOtherUser, endCall } = useCall();

  if (!isCalling || !roomName) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <AgoraCall 
        roomName={roomName}
        callType={callType}
        otherUser={activeOtherUser}
        onEndCall={endCall}
      />
    </div>
  );
}
