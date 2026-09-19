/**
 * Injects the floating "Job Jet" action button into a shadow root so the
 * host page's CSS can never clash with (or override) our styling.
 */

const HOST_ID = "job-jet-floating-root";

export function mountFloatingButton(onClick: () => void): void {
  if (document.getElementById(HOST_ID)) return; // already mounted

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.position = "fixed";
  host.style.zIndex = "2147483647"; // max z-index, sits above everything
  host.style.bottom = "24px";
  host.style.right = "24px";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 18px;
      border-radius: 999px;
      background: linear-gradient(135deg, #4ade80, #16a34a);
      color: white;
      font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(23, 23, 26, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(23, 23, 26, 0.28);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: white;
    }
  `;

  const button = document.createElement("button");
  button.className = "btn";
  button.innerHTML = `<span class="dot"></span><span>Fill with Job Jet</span>`;
  button.addEventListener("click", onClick);

  shadow.appendChild(style);
  shadow.appendChild(button);
}

export function unmountFloatingButton(): void {
  document.getElementById(HOST_ID)?.remove();
}
