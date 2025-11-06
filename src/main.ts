import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Expected #app root to exist before bootstrapping.");
}

app.innerHTML = `
  <main class="hero">
    <h1>Hello, Herakoi</h1>
    <p>The modern toolchain is live with Vite, pnpm, and TypeScript.</p>
    <ul class="hero__list">
      <li>Fast rebuilds come from Vite's dev server.</li>
      <li>Strict typing keeps our MediaPipe experiments safer.</li>
      <li>Biome and PostCSS are wired in for consistent styling.</li>
    </ul>
  </main>
`;
