import { createRoot } from "react-dom/client"

function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Localmail</h1>
      <p>Development scaffold running.</p>
    </div>
  )
}

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(<App />)
}
