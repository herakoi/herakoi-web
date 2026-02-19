import { Component, createRef, type ErrorInfo, type ReactNode, type RefObject } from "react";
import { BrandMark } from "#src/components/header/BrandMark";
import { clearHerakoiLocalStorage } from "#src/state/storageReset";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  private readonly analyserRef: RefObject<AnalyserNode | null> = { current: null };
  private readonly logoRef = createRef<HTMLButtonElement>();

  public override state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const errorMessage = error instanceof Error ? error.message : "Unknown runtime error";
    return { hasError: true, errorMessage };
  }

  public override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Application crashed:", error, errorInfo);
  }

  private handleResetStorage = () => {
    clearHerakoiLocalStorage();
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
          <header className="absolute left-2 right-2 top-3 z-10 sm:left-1 sm:right-4 sm:top-4">
            <div className="justify-self-start">
              <BrandMark
                analyserRef={this.analyserRef}
                dimLogoMark={false}
                uiFadeStyle={{}}
                logoRef={this.logoRef}
              />
            </div>
          </header>

          <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-20">
            <article
              className="w-full max-w-xl rounded-xl border border-border/70 bg-card/95 p-6 shadow-card backdrop-blur"
              role="alert"
              aria-live="assertive"
            >
              <h1 className="text-lg font-semibold">Errore di configurazione</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                L&apos;app si è bloccata durante il caricamento. Potrebbe esserci uno stato locale
                non più compatibile con l&apos;ultima versione.
              </p>
              {this.state.errorMessage ? (
                <p className="mt-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {this.state.errorMessage}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={this.handleResetStorage}
                  className="inline-flex items-center rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Reset local storage e ricarica
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center rounded-md border border-border/70 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/40"
                >
                  Ricarica senza reset
                </button>
              </div>
            </article>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
