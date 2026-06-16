export const SessionStatus = () => {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-border/50 shadow-lg text-[10px] text-muted-foreground flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Auto-saving...
      </div>
    </div>
  );
};