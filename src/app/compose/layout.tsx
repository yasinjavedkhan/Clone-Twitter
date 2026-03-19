// This layout intentionally renders without the MainLayout wrapper (no sidebar)
// The compose page is a standalone full-screen experience
export default function ComposeLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
