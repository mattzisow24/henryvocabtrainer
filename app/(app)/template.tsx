/** Re-mounted on every navigation, so each screen fades in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade">{children}</div>;
}
