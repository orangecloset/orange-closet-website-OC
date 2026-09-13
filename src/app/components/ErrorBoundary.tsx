import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled app error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center text-black">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-gray-500">
            An unexpected error occurred while rendering this page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="border border-black px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-black hover:text-white"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
