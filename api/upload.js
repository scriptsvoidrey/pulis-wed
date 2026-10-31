export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "Falta configurar GITHUB_TOKEN en Vercel." });
  try {
    const { filename, content } = req.body || {};
    if (typeof filename !== "string" || typeof content !== "string" || !content) {
      return res.status(400).json({ error: "Archivo inválido." });
    }
    const safeName = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
    if (!safeName || safeName === "." || safeName === "..") return res.status(400).json({ error: "Nombre inválido." });
    const bytes = Buffer.from(content, "base64");
    if (!bytes.length || bytes.length > 2500000) return res.status(413).json({ error: "Máximo 2.5 MB." });
    const path = "uploads/" + Date.now() + "-" + safeName;
    const gh = await fetch("https://api.github.com/repos/scriptsvoidrey/pulis-wed/contents/" + path, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Upload file: " + safeName, content: bytes.toString("base64"), branch: "main" })
    });
    const data = await gh.json();
    if (!gh.ok) {
      console.error("GitHub API error", gh.status, data);
      return res.status(502).json({ error: "GitHub rechazó el archivo. Revisa los permisos de GITHUB_TOKEN." });
    }
    return res.status(200).json({ url: "https://raw.githubusercontent.com/scriptsvoidrey/pulis-wed/main/" + path });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno al subir." });
  }
}