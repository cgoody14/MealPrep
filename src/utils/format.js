export function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((new Date() - new Date(dateStr)) / 86400000);
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

export function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = d.getDate() - day; // subtract day index to land on Sunday
  return new Date(new Date().setDate(diff)).toISOString().split('T')[0];
}

export function getWeekRange() {
  const sunday = new Date(getWeekStart() + 'T12:00:00');
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(sunday)} – ${fmt(saturday)}`;
}
