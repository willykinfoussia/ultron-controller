type ToastProps = {
  message: string | null;
  kind?: "info" | "error" | "success";
};

export function Toast({ message }: ToastProps) {
  if (!message) {
    return null;
  }
  return <div className="toast">{message}</div>;
}
