import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches render errors and shows a recoverable fallback instead of a blank screen. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <p className="text-3xl">😵</p>
          <h1 className="mt-4 text-[18px]/[24px] font-semibold text-fg">
            Something went wrong
          </h1>
          <p className="mt-1 max-w-sm text-[14px]/[20px] text-subtle">
            An unexpected error crashed this view. Your music keeps playing.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-5 cursor-pointer rounded-full bg-fg px-6 py-2.5 text-[14px]/[20px] font-semibold text-[#171719] transition-transform hover:scale-105"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
