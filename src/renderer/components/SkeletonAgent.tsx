export default function SkeletonAgent() {
  return (
    <div className="agent-card agent-card--skeleton">
      <div className="agent-card-header">
        <div className="agent-card-avatar shimmer" />
        <div className="agent-card-meta">
          <div className="shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
          <div className="shimmer" style={{ width: 50, height: 10, borderRadius: 4, marginTop: 6 }} />
        </div>
      </div>
      <div className="agent-card-preview">
        <div className="shimmer" style={{ width: "100%", height: 12, borderRadius: 4 }} />
        <div className="shimmer" style={{ width: "70%", height: 12, borderRadius: 4, marginTop: 6 }} />
      </div>
    </div>
  );
}
