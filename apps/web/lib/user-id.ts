// Choose a stable id for API calls
export function getPreferredUserId(email?: string) {
  if (email && email.includes("@")) return email;

  if (typeof window !== "undefined") {
    const key = "flux_user";
    let v = localStorage.getItem(key);
    if (!v) {
      v = `dev_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, v);
    }
    return v;
  }
  return "dev";
}
