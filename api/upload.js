export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Vercel no está entregando la variable GITHUB_TOKEN a esta función. Revisa que esté habilitada para Production y vuelve a desplegar." });
  }

  try {
    const { filename, content } = req.body || {};
    if (typeof filename !== "string" || typeof content !== "string" || !content) {
      return res.status(400).json({ error: "Archivo inválido." });
    }

    const safeName = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
    if (!safeName || safeName === "." || safeName === "..") {
      return res.status(400).json({ error: "Nombre inválido." });
    }

    // El navegador envía el contenido en Base64; se decodifica y se vuelve
    // a codificar para que GitHub reciba los bytes originales del archivo.
    const bytes = Buffer.from(content, "base64");
    if (!bytes.length || bytes.length > 2500000) {
      return res.status(413).json({ error: "El archivo está vacío o supera el máximo de 2.5 MB." });
    }

    const path = "uploads/" + Date.now() + "-" + safeName;
    const gh = await fetch("https://api.github.com/repos/scriptsvoidrey/pulis-wed/contents/" + path, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Upload file: " + safeName,
        content: bytes.toString("base64"),
        branch: "main"
      })
    });

    const data = await gh.json().catch(() => ({}));
    if (!gh.ok) {
      console.error("GitHub upload failed:", gh.status, data);
      const detail = typeof data.message === "string" ? data.message : "GitHub no explicó el motivo.";
      let hint = "Comprueba el acceso del token al repositorio.";
      if (gh.status === 401) hint = "GitHub no reconoce el token configurado en Vercel.";
      else if (gh.status === 403) hint = "GitHub denegó la escritura. El token o la cuenta no tienen permiso para escribir en este repositorio.";
      else if (gh.status === 404) hint = "GitHub no encuentra el repositorio o la rama main con las credenciales usadas.";
      else if (gh.status === 409) hint = "GitHub detectó un conflicto con la rama. Inténtalo de nuevo.";
      else if (gh.status === 422) hint = "GitHub rechazó los datos del archivo o la ruta.";
      return res.status(502).json({
        error: "GitHub respondió " + gh.status + ": " + detail + " " + hint
      });
    }

    return res.status(200).json({
      url: "https://raw.githubusercontent.com/scriptsvoidrey/pulis-wed/main/" + path
    });
  } catch (e) {
    console.error("Upload handler error:", e);
    return res.status(500).json({ error: "Error interno al subir el archivo." });
  }
}