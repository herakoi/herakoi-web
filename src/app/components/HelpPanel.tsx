export const HelpPanelContent = () => {
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How it works
        </h3>
        <p className="text-sm text-foreground">
          Grant camera permission so hand tracking can start. Keep your hands in view of the camera
          to drive the sound.
        </p>
        <p className="text-sm text-muted-foreground">
          Each detected fingertip samples the current image. Hue maps to pitch (frequency) and value
          maps to loudness (gain).
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          About us
        </h3>
        <p className="text-sm text-muted-foreground">
          Herakoi explores image sonification through hand-guided sampling. Read the paper at{" "}
          <a
            className="text-primary underline underline-offset-2"
            href="https://arxiv.org/abs/2412.09152"
            target="_blank"
            rel="noreferrer"
          >
            arXiv:2412.09152
          </a>{" "}
          and see the open-source code on{" "}
          <a
            className="text-primary underline underline-offset-2"
            href="https://github.com/herakoi/herakoi-web"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          . Contributions are welcome.
        </p>
      </div>
    </div>
  );
};
