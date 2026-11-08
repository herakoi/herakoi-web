import { Component, createRef, type ErrorInfo, type ReactNode, type RefObject } from "react";
import { BrandMark } from "#src/components/header/BrandMark";
import { shellT } from "#src/i18n/shell";
import { clearHerakoiLocalStorage } from "#src/state/storageReset";
import styles from "./AppErrorBoundary.module.css";

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
    const errorMessage = error instanceof Error ? error.message : shellT("crash.unknownError");
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
        <main className={styles.main}>
          <div className={styles.gradient} />
          <header className={styles.header}>
            <div className={styles.headerStart}>
              <BrandMark
                analyserRef={this.analyserRef}
                dimLogoMark={false}
                uiFadeStyle={{}}
                logoRef={this.logoRef}
              />
            </div>
          </header>

          <section className={styles.section}>
            <article className={styles.card} role="alert" aria-live="assertive">
              <h1 className={styles.title}>{shellT("crash.title")}</h1>
              <p className={styles.body}>{shellT("crash.body")}</p>
              {this.state.errorMessage ? (
                <p className={styles.error}>{this.state.errorMessage}</p>
              ) : null}
              <div className={styles.actions}>
                <button type="button" onClick={this.handleResetStorage} className={styles.primary}>
                  {shellT("crash.resetAndReload")}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={styles.secondary}
                >
                  {shellT("crash.reload")}
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
