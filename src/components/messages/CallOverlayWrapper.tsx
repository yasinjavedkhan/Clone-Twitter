"use client";

import nextDynamic from "next/dynamic";

const IncomingCallOverlay = nextDynamic(() => import("./IncomingCallOverlay"), { ssr: false });
const GlobalCallOverlay = nextDynamic(() => import("./GlobalCallOverlay"), { ssr: false });

export default function CallOverlayWrapper() {
  return (
    <>
      <IncomingCallOverlay />
      <GlobalCallOverlay />
    </>
  );
}
